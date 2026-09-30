import { writeFileSync } from "node:fs";
import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import type { HookWindow, ProbePoint, SlotInfo } from "./support/hooks";
import { cardRegion, outlineGap, pixelDiff, shoot, type CardRegion, type Image } from "./support/pixels";
import { pointerTo } from "./support/input";

// The flight (docs/coil-input-model.md section 3, "Flight handoff"): a clicked
// card flies into its modal as itself and back. Behind ?coildebug=flight the
// flight can be held still at each end, so both sides of every swap between
// the coil's mesh and the flown card are captured and compared:
//   open   the flown card mounts over the mesh, then the mesh hides
//   close  the mesh shows under the landed card, then the flown card clears
// At each swap the card region must not change: mean difference under 2 of
// 255 and the edge moving under 0.5px. Then the scene resumes on the frame
// after the landing without a jump.

type Target = "front photo" | "back-facing photo" | "work card" | "card in the bottom fade";

const INSIDE_MEAN_MAX = 2;
const EDGE_MOVE_MAX_PX = 0.5;

function flat(outline: ProbePoint[][]) {
  return outline.flatMap((edge) => edge.slice(0, -1));
}

function signedArea(quad: readonly ProbePoint[]) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// The best on-screen slot for a target kind, or null; the card's center must
// pick that card (nothing covers it there).
async function pickTarget(page: Page, target: Target): Promise<SlotInfo | null> {
  const { slots, seam, picks } = await page.evaluate(() => {
    const w = window as HookWindow;
    const slots = w.__coilFlight!.scene.slots();
    return {
      slots,
      seam: w.__coilFlight!.scene.seam(),
      picks: slots.map((s) => w.__coil!.api.cardAt(s.center.x, s.center.y)?.slot ?? -1),
    };
  });
  const { width, height } = page.viewportSize()!;
  let best: { score: number; slot: SlotInfo } | null = null;
  slots.forEach((slot, i) => {
    const { x, y } = slot.center;
    if (!(x > 80 && x < width - 80 && y > 80 && y < height - 20) || picks[i] !== slot.slot) return;
    const front = signedArea(slot.quad) > 0;
    const inSeam = y > height * (1 - seam);
    const area = Math.abs(signedArea(slot.quad));
    let score: number | null = null;
    if (target === "front photo" && slot.kind === "photo" && front && !inSeam && slot.depth > 0.6) score = slot.depth + area / 1e6;
    if (target === "back-facing photo" && slot.kind === "photo" && !front && !inSeam) score = area;
    if (target === "work card" && slot.kind === "work" && front && !inSeam && slot.depth > 0.3) score = slot.depth + area / 1e6;
    if (target === "card in the bottom fade" && front && y > height * (1 - seam * 0.8)) score = y;
    if (score !== null && (!best || score > best.score)) best = { score, slot };
  });
  return (best as { slot: SlotInfo } | null)?.slot ?? null;
}

// What is on screen: the modal is always hidden (it sits between the mesh and
// the flown card), the custom cursor too; the mesh and the flown card as asked.
async function setView(page: Page, slot: number, { mesh, flown }: { mesh: boolean; flown: boolean }) {
  await page.evaluate(
    ({ slot, mesh, flown }) => {
      const w = window as HookWindow;
      let style = document.getElementById("e2e-flight-view");
      if (!style) {
        style = document.createElement("style");
        style.id = "e2e-flight-view";
        style.textContent = "[role=dialog]{visibility:hidden!important} .z-\\[100\\]{visibility:hidden!important}";
        document.head.appendChild(style);
      }
      const layer = document.querySelector<HTMLElement>("[data-flying-tile]");
      // Opacity, not visibility: a descendant that sets its own visibility
      // (the sharp photo copy does) would still show under a hidden parent.
      if (layer) layer.style.opacity = flown ? "" : "0";
      w.__coilFlight!.scene.hide(mesh ? null : slot);
    },
    { slot, mesh, flown },
  );
}

// The flown card's drawn outline, where the scene draws it (the probe's
// flown(); builds before the scene drew the flown card had none).
async function flownOutline(page: Page) {
  const flown = await page.evaluate(() => {
    const scene = (window as HookWindow).__coilFlight!.scene;
    return typeof scene.flown === "function" ? scene.flown() : null;
  });
  return flown ? flat(flown.outline) : null;
}

async function clickAt(cdp: CDPSession, { x, y }: ProbePoint) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

type Swap = { name: string; before: Image; after: Image };

// The one visible swap at each end. The handoff runs both of its steps inside
// one frame (open: draw the flown card, hide the mesh; close: show the mesh,
// clear the flown card), so the frame before shows only one of them and the
// frame after only the other; a state with both or neither never reaches the
// screen, and the probe's marks prove the pairing below.
async function captureSwap(page: Page, slot: number, region: CardRegion, end: "open" | "close") {
  const view = async (mesh: boolean, flown: boolean) => {
    await setView(page, slot, { mesh, flown });
    return shoot(page, region.box);
  };
  const meshOnly = await view(true, false);
  const flownOnly = await view(false, true);
  const neither = await view(false, false);
  const swap: Swap =
    end === "open"
      ? { name: "open: the mesh hands over to the flown card", before: meshOnly, after: flownOnly }
      : { name: "close: the landed card hands back to the mesh", before: flownOnly, after: meshOnly };
  // Back to what the flight itself shows now: the flown card, the mesh hidden.
  await setView(page, slot, { mesh: false, flown: true });
  return { swap, neither };
}

async function assertSwap({ name, before, after }: Swap, neither: Image, region: CardRegion) {
  const diff = pixelDiff(before, after, neither, region);
  const info = test.info();
  const tag = name.split(":")[0];
  // Both sides and the measures stay beside the test's other output, for a failure to be read.
  for (const [side, image] of [["before", before], ["after", after], ["neither", neither]] as const) {
    if (image.png) writeFileSync(info.outputPath(`${tag}-${side}.png`), image.png);
  }
  writeFileSync(info.outputPath(`${tag}-measures.json`), JSON.stringify({ region, diff }, null, 1));
  expect(diff.pixels, `${name}: pixels inside the card`).toBeGreaterThan(500);
  expect(diff.edgePixels, `${name}: strong edge pixels measured`).toBeGreaterThan(50);
  expect.soft(diff.insideMean, `${name}: mean difference inside the card, of 255`).toBeLessThan(INSIDE_MEAN_MAX);
  expect.soft(diff.edgeMovePx, `${name}: edge movement (99th percentile over the edge), px`).toBeLessThan(EDGE_MOVE_MAX_PX);
}

const TARGETS: Target[] = ["front photo", "back-facing photo", "work card", "card in the bottom fade"];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`flight, ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const target of TARGETS) {
      test(`${target}: every swap is seamless and the scene resumes without a jump`, async ({ page, cdp }) => {
        await openHome(page, { debug: "flight" });
        await expect.poll(() => pickTarget(page, target), { timeout: 20_000, message: `a ${target} on screen` }).not.toBeNull();
        const card = (await pickTarget(page, target))!;
        const slot = card.slot;
        await page.evaluate((slot) => {
          const flight = (window as HookWindow).__coilFlight!;
          flight.scene.follow(slot);
          flight.rate = 0;
          flight.holdLanding = true;
        }, slot);

        // Open: the pointer onto the card's live center, the scene picks it, a click.
        const center = await page.evaluate((slot) => (window as HookWindow).__coilFlight!.scene.slot(slot)!.center, slot);
        await pointerTo(cdp, center);
        await page.waitForFunction((slot) => (window as HookWindow).__coil!.hovered() === slot, slot);
        const offsetAtClick = await page.evaluate(() => (window as HookWindow).__coil!.offset());
        await clickAt(cdp, center);
        await page.waitForFunction(
          () => !!document.querySelector("[data-flying-tile]") && (window as HookWindow).__coilFlight!.log.some((m) => m.name === "clone-mount"),
        );

        // Held at t = 0: the flown card on the seat.
        const seat = (await page.evaluate((slot) => (window as HookWindow).__coilFlight!.scene.slot(slot), slot))!;
        const flownAtOpen = await flownOutline(page);
        expect.soft(flownAtOpen && outlineGap(flownAtOpen, flat(seat.outline)), "open: flown outline to mesh outline, px").toBeLessThan(EDGE_MOVE_MAX_PX);
        const openRegion = cardRegion(flat(seat.outline), page.viewportSize()!);
        const open = await captureSwap(page, slot, openRegion, "open");
        await assertSwap(open.swap, open.neither, openRegion);
        const opened = await page.evaluate(() => (window as HookWindow).__coilFlight!.log);
        const mounted = opened.findLast((m) => m.name === "clone-mount");
        const hidden = opened.findLast((m) => m.name === "mesh-hide");
        expect.soft(hidden?.frame, "the mesh hides on the frame the flown card mounts").toBe(mounted?.frame);

        // Out to the modal, then close with one Escape; the landing is held on the home quad.
        await page.evaluate(() => {
          (window as HookWindow).__coilFlight!.rate = 1;
        });
        await page.waitForFunction(() => (window as HookWindow).__coilFlight!.log.some((m) => m.name === "clone-parked"));
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => {
          const flight = (window as HookWindow).__coilFlight!;
          const home = flight.log.some((m) => m.name === "clone-frame" && m.data?.phase === "closing" && m.data?.t === 1);
          return home && !document.querySelector("[role=dialog]");
        });
        // Held home, the card's lift keeps easing toward the pointer's hover
        // every frame (as the landing will draw it); both sides of the swap
        // are shot once it has come to rest, so they are one moment.
        await page.waitForFunction(() => {
          const hover = (window as HookWindow).__coilFlight!.scene.state().hover ?? 0;
          return hover < 1e-4 || hover > 1 - 1e-4;
        });
        const rest = (await page.evaluate((slot) => (window as HookWindow).__coilFlight!.scene.slot(slot), slot))!;
        const flownAtHome = await flownOutline(page);
        expect.soft(flownAtHome && outlineGap(flownAtHome, flat(rest.outline)), "close: flown outline to mesh outline, px").toBeLessThan(EDGE_MOVE_MAX_PX);
        const closeRegion = cardRegion(flat(rest.outline), page.viewportSize()!);
        const close = await captureSwap(page, slot, closeRegion, "close");
        await assertSwap(close.swap, close.neither, closeRegion);

        // Release the landing: the mesh shows and the flown card clears in one
        // frame, and the scene's first live frame is the next one, one frame's
        // step on, with the coil where the click left it.
        const mark = await page.evaluate(() => {
          const flight = (window as HookWindow).__coilFlight!;
          const at = flight.log.length;
          flight.holdLanding = false;
          return at;
        });
        await page.waitForFunction(
          (mark) => (window as HookWindow).__coilFlight!.log.slice(mark).some((m) => m.name === "scene-frame"),
          mark,
        );
        const log = await page.evaluate((mark) => (window as HookWindow).__coilFlight!.log.slice(mark), mark);
        const shown = log.find((m) => m.name === "mesh-show");
        const cleared = log.find((m) => m.name === "clone-unmount");
        const live = log.find((m) => m.name === "scene-frame");
        expect(shown && cleared && live, "landing marks").toBeTruthy();
        expect(cleared!.frame, "the flown card clears on the frame the mesh shows").toBe(shown!.frame);
        expect(live!.frame - shown!.frame, "frames from the landing to the first live frame").toBe(1);
        expect(Number(live!.data!.dt), "first live frame's step, s").toBeLessThanOrEqual(1 / 60 + 1e-6);
        expect(Math.abs(Number(live!.data!.offset) - offsetAtClick), "coil offset jump across the flight, cards").toBeLessThan(0.1);
      });
    }
  });
}
