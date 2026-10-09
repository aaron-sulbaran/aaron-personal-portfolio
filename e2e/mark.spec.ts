import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { HOLD } from "@/lib/mark/constants";
import { FILL_BOTTOM, FILL_TOP } from "@/lib/mark/geometry";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { noWebglContext } from "./support/webgl";

// The top-left mark (components/mark): a click still scrolls to the top; a
// 650ms hold strikes and opens the card and swallows the click it ends with;
// an early release tastes the fill and drains; Enter or Space held does the
// same from the keyboard; reduced motion opens the card on the static mark.
// The cursor's ring paints the same fill as the mark.
//
// The mark is DOM and GSAP only, so every test runs twice: with the scene, and
// with WebGL taken away in the page (the hero still, as Aaron's own browser
// shows it).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const Y = 600;
const CLOSE = siteContent.modals.closeAriaLabel;
const mark = (page: Page) => page.locator("[data-mark-trigger]");
const card = (page: Page) => page.getByRole("dialog", { name: siteContent.mark.dialogLabel });
const progress = async (page: Page) => Number(await mark(page).getAttribute("data-hold-progress"));
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const menuPill = (page: Page) => page.getByRole("button", { name: siteContent.menu.ariaLabelOpen });
const menuPanel = (page: Page) => page.getByRole("dialog", { name: siteContent.menu.dialogLabel });
const surfaceOpacity = (page: Page) => card(page).locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity);

// How far the page sits from #connect's resting scroll: its top less its
// scroll margin, or the bottom of the page if that comes first.
const offConnect = (page: Page) =>
  page.evaluate(() => {
    const section = document.getElementById("connect")!;
    const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    const resting = Math.min(window.scrollY + section.getBoundingClientRect().top - margin, document.documentElement.scrollHeight - window.innerHeight);
    return Math.abs(window.scrollY - resting);
  });

async function markBox(page: Page) {
  const box = await mark(page).boundingBox();
  if (!box) throw new Error("the mark is not on screen");
  return box;
}

async function pointAtMark(page: Page) {
  const box = await markBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function holdMark(page: Page, ms: number) {
  await pointAtMark(page);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

for (const mode of ["scene", "no-webgl"] as const) {
  test.describe(mode, () => {
    if (mode === "no-webgl") test.beforeEach(({ page }) => page.addInitScript(noWebglContext));

    async function open(page: Page) {
      if (mode === "scene") return openHome(page);
      await page.goto("/");
      await settled(page);
      await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
    }

    test(`mark: hover grows it 10px from its corner, and a click still scrolls to the top with no card (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      const side = Math.round((await markBox(page)).width);
      const grown = String((side + 10) / side).replace(".", "\\.");
      await pointAtMark(page);
      await expect(mark(page).locator("span").first()).toHaveAttribute("style", new RegExp(`scale\\(${grown}\\)`));
      await mark(page).click();
      await expect.poll(() => scrollY(page)).toBeLessThan(2);
      await sleep(1000);
      await expect(card(page)).toHaveCount(0);
    });

    test(`mark: a 700ms hold strikes and opens the card, and swallows the click it ends with (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await holdMark(page, 700);
      const dialog = card(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "cel");
      await expect.poll(() => dialog.locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
      await expect(dialog.getByRole("link", { name: siteContent.mark.cta.label }).locator("svg")).not.toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await expect.poll(() => page.evaluate(() => document.querySelector<SVGElement>("[data-mark-ring]")?.style.opacity ?? "0")).toBe("0");
      await dialog.getByRole("button", { name: CLOSE }).click();
      await expect(dialog).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await mark(page).click();
      await expect.poll(() => scrollY(page)).toBeLessThan(2);
    });

    test(`mark: letting go at 300ms opens nothing and the fill drains @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await page.mouse.down();
      await sleep(300);
      const mid = await page.evaluate(() => ({
        fill: Number(document.querySelector<HTMLElement>("[data-mark-trigger]")!.dataset.holdProgress),
        arc: Number(document.querySelector<SVGElement>("[data-mark-ring]")!.dataset.ringArc),
      }));
      await page.mouse.up();
      expect(mid.fill).toBeGreaterThan(0.3);
      expect(mid.fill).toBeLessThan(0.75);
      expect(Math.abs(mid.arc / 360 - mid.fill)).toBeLessThan(0.002);
      await expect.poll(() => progress(page)).toBe(0);
      await sleep(600);
      await expect(card(page)).toHaveCount(0);
    });

    // Each frame reads the mark's rise clip, the ring's arc and the ring's wash
    // back from the DOM; all three are one progress, close on one frame at
    // HOLD.holdMs, and the card opens only after that, past the discharge.
    test(`mark: the ring's arc and wash fill with the mark and close on the same frame @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await expect(page.locator("[data-mark-ring]")).toHaveCount(1);
      await page.evaluate(
        ([top, bottom]) => {
          const rise = document.querySelector<SVGRectElement>("[data-mark-trigger] clipPath rect")!;
          const ring = document.querySelector<SVGSVGElement>("[data-mark-ring]")!;
          const wash = ring.querySelector<SVGRectElement>("clipPath rect")!;
          const rec = { samples: [] as { t: number; mark: number; arc: number; wash: number }[], pressedAt: 0, openedAt: 0 };
          Object.assign(window, { __sync: rec });
          window.addEventListener("pointerdown", () => (rec.pressedAt = performance.now()), { once: true, capture: true });
          const start = performance.now();
          const tick = () => {
            const t = performance.now();
            if (!rec.openedAt && document.querySelector("[data-mark-strike]")) rec.openedAt = t;
            if (!rec.openedAt) rec.samples.push({ t, mark: (bottom - Number(rise.getAttribute("y"))) / (bottom - top), arc: Number(ring.dataset.ringArc) / 360, wash: 1 - Number(wash.getAttribute("y")) / 100 });
            if (t - start < 2500) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
        [FILL_TOP, FILL_BOTTOM],
      );
      await holdMark(page, HOLD.holdMs + HOLD.dischargeMs + 200);
      await expect(card(page)).toBeVisible();
      type Sample = { t: number; mark: number; arc: number; wash: number };
      const { samples, pressedAt, openedAt } = await page.evaluate(() => (window as unknown as { __sync: { samples: Sample[]; pressedAt: number; openedAt: number } }).__sync);
      const during = samples.filter((s) => s.t >= pressedAt);
      expect(during.length).toBeGreaterThan(20);
      for (const s of during) {
        expect(Math.abs(s.arc - s.mark)).toBeLessThan(0.001);
        expect(Math.abs(s.wash - s.mark)).toBeLessThan(1e-6);
      }
      const markFull = during.findIndex((s) => s.mark > 1 - 1e-6);
      const washFull = during.findIndex((s) => s.wash > 1 - 1e-6);
      expect(markFull).toBeGreaterThan(0);
      expect(washFull).toBe(markFull);
      expect(during[markFull].arc).toBe(1);
      expect(during[markFull - 1].mark).toBeLessThan(1);
      const fullAt = during[markFull].t - pressedAt;
      expect(fullAt).toBeGreaterThanOrEqual(HOLD.holdMs - 5);
      expect(fullAt).toBeLessThan(HOLD.holdMs + 60);
      expect(openedAt - during[markFull].t).toBeGreaterThanOrEqual(HOLD.dischargeMs - 20);
    });

    test(`mark: a scroll under a parked pointer tucks the mark and the ring goes with it @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await expect(page.locator("[data-mark-ring]")).toHaveCount(1);
      await page.evaluate(() => {
        const rec = { moves: 0 };
        Object.assign(window, { __moves: rec });
        window.addEventListener("mousemove", () => rec.moves++);
      });
      // Headroom tucks after a long enough scroll down; wheel until it starts.
      for (let i = 0; i < 4 && (await markBox(page)).y > 0; i++) {
        await page.mouse.wheel(0, 400);
        await sleep(250);
      }
      await expect.poll(async () => (await mark(page).boundingBox())?.y ?? 0).toBeLessThan(-40);
      await expect(page.locator("[data-mark-ring]")).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { __moves: { moves: number } }).__moves.moves)).toBe(0);
    });

    test(`mark: a quick tap shows at least 0.3 of the fill for 200ms, then drains (${mode})`, async ({ page }) => {
      await open(page);
      await pointAtMark(page);
      await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>("[data-mark-trigger]")!;
        const rec = { samples: [] as [number, number][], releasedAt: 0 };
        Object.assign(window, { __tap: rec });
        window.addEventListener("pointerup", () => (rec.releasedAt = performance.now()), { once: true });
        const start = performance.now();
        const tick = () => {
          rec.samples.push([performance.now(), Number(el.dataset.holdProgress)]);
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.down();
      await page.mouse.up();
      await sleep(1600);
      const { samples, releasedAt } = await page.evaluate(() => (window as unknown as { __tap: { samples: [number, number][]; releasedAt: number } }).__tap);
      const tasted = samples.filter(([t]) => t - releasedAt >= 110 && t - releasedAt <= 270).map(([, fill]) => fill);
      expect(tasted.length).toBeGreaterThan(5);
      expect(Math.min(...tasted)).toBeGreaterThanOrEqual(0.299);
      expect(samples.at(-1)?.[1]).toBe(0);
    });

    test(`mark: Enter held opens the card, its repeat cannot close it, Escape does and focus returns to the mark (${mode})`, async ({ page }) => {
      await open(page);
      await mark(page).focus();
      await page.keyboard.down("Enter");
      await expect(card(page)).toBeVisible();
      await expect(page.locator("[data-mark-ring]")).toHaveCount(0);
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.down("Enter");
      await page.keyboard.up("Enter");
      await sleep(300);
      await expect(card(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(card(page)).toHaveCount(0);
      await expect(mark(page)).toBeFocused();
    });

    test(`mark: Escape cancels a keyboard hold, and Space held opens the card without its release pressing Close (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await mark(page).focus();
      await page.keyboard.down("Enter");
      await sleep(300);
      await page.keyboard.press("Escape");
      await sleep(500);
      await page.keyboard.up("Enter");
      await sleep(400);
      await expect(card(page)).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await page.keyboard.down("Space");
      await expect(card(page)).toBeVisible();
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.up("Space");
      await sleep(300);
      await expect(card(page)).toBeVisible();
    });

    test(`mark: a hold with the Menu open closes the Menu, opens the card on Close, and Escape returns to the mark (${mode})`, async ({ page }) => {
      await open(page);
      await menuPill(page).click();
      await expect(menuPanel(page)).toBeVisible();
      await holdMark(page, 700);
      await expect(card(page)).toBeVisible();
      await expect(menuPanel(page)).toHaveCount(0);
      await expect(menuPill(page)).toHaveAttribute("aria-expanded", "false");
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await sleep(600);
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(card(page)).toHaveCount(0);
      await expect(mark(page)).toBeFocused();
    });

    test(`mark: Say hi closes the card and the page lands at #connect (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await holdMark(page, 700);
      await expect.poll(() => surfaceOpacity(page), { timeout: 4000 }).toBe("1");
      expect(await offConnect(page)).toBeGreaterThan(100);
      await card(page).getByRole("link", { name: siteContent.mark.cta.label }).click();
      await expect(card(page)).toHaveCount(0);
      await expect.poll(() => offConnect(page), { timeout: 10_000 }).toBeLessThan(3);
      await sleep(500);
      expect(await offConnect(page)).toBeLessThan(3);
      expect(new URL(page.url()).hash).toBe(siteContent.mark.cta.href);
    });

    test.describe("reduced motion", () => {
      test.use({ contextOptions: { reducedMotion: "reduce" } });

      test(`mark: the hold opens the card on the static mark, with no strike (${mode})`, async ({ page }) => {
        await page.goto("/");
        await settled(page);
        await holdMark(page, 700);
        const dialog = card(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "static");
        await expect(dialog.locator('[data-part="cel"], [data-cel-night], [data-cel-flash]')).toHaveCount(0);
        await expect(dialog.locator('[data-card="surface"]')).toHaveCSS("opacity", "1");
      });
    });
  });
}
