import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, waitForScene } from "./support/coil";
import { cardRow } from "./support/cards";
import { noWebgl2Api } from "./support/webgl";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { DEFAULT_KNOBS } from "@/lib/home/dealKnobs";
import { promptPlan } from "@/lib/home/clickPrompt";
import { CARD_OPENED_KEY } from "@/lib/home/firstOpen";

// The "Click a card to open it" moment (docs/superpowers/plans/2026-11-18-click-a-card-production.md).
// On a first visit's deal the resting line plays big where it rests (under the Work list from 768 px
// wide, under the page title on a phone) as the Coil lands. It is read alone beside the lit Coil: the
// page's title, labels and lists wait and come in half way through its shrink. It then rests as the
// line, and a card opened once, ever, ends the prompt for good.
//
// The page's own sampler (watchPrompt) records one row per animation frame from before the page's
// scripts run, so every time below is what the visitor saw, measured from the moment the deal began
// (marks.dealing: the click the plan's milliseconds count from).

const { prompt, progress } = siteContent.columns;
const PLAN = promptPlan(DEFAULT_KNOBS);
const P = COIL.deal.prompt;
const CAP_MS = COIL.deal.cutscene.capMs;
const OPENED_ONE = progress(1, 14);
const DEBUG = "flight";

type Box = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };
type PromptFrame = { t: number; opacity: number; box: Box | null; host: string };
type PromptLog = { frames: PromptFrame[]; marks: Record<string, number>; lockOff: number | null; stampAt: number | null };
type PromptWindow = Window & { __prompt: PromptLog; __coil?: { visibleQuads?: () => Point[][] } };

// The sampler, installed before any script of the page (so it is on the first frame of a fresh load
// too). The overlay and the hosts mount after hydration, so every read is guarded. The mutation
// observer watches `document`, not the html element, which does not exist yet when an init script runs.
async function watchPrompt(page: Page) {
  await page.addInitScript(() => {
    const log: PromptLog = { frames: [], marks: {}, lockOff: null, stampAt: null };
    (window as unknown as PromptWindow).__prompt = log;
    let lockSeen = false;
    new MutationObserver(() => {
      const root = document.documentElement;
      const deal = root.dataset.deal;
      if (deal && !(deal in log.marks)) log.marks[deal] = performance.now();
      if (root.hasAttribute("data-deal-lock")) lockSeen = true;
      else if (lockSeen && log.lockOff === null) log.lockOff = performance.now();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-deal", "data-deal-lock"] });
    const sample = () => {
      const overlay = document.querySelector<HTMLElement>("[data-prompt-stage]");
      const text = overlay?.querySelector<HTMLElement>("[data-prompt-text]");
      let opacity = 0;
      let box: Box | null = null;
      if (overlay && text) {
        const style = getComputedStyle(overlay);
        opacity = style.visibility === "hidden" ? 0 : Number(style.opacity);
        const r = text.getBoundingClientRect();
        box = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
      const host = Array.from(document.querySelectorAll<HTMLElement>("#work [data-prompt-host]")).find((h) => h.getClientRects().length > 0);
      log.frames.push({ t: performance.now(), opacity, box, host: host?.dataset.prompt ?? "" });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

const readLog = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as PromptWindow).__prompt)) as PromptLog);
const html = (page: Page) => page.locator("html");
const dealLink = (page: Page) => page.getByRole("link", { name: siteContent.intro.teaser.deal });
const restingHost = (page: Page) => page.locator("#work [data-prompt-host]:visible");
const restingLine = (page: Page) => restingHost(page).locator("[data-prompt-line]");
// The count's line: the same spot as the prompt from 768 px wide, the foot under the columns on a phone.
const countLine = (page: Page) => page.locator("#work [data-card-progress]:visible p");
const lastTitle = (page: Page) => page.locator("#work [data-deal-title]:visible").last();
const dialog = (page: Page) => page.locator('[role="dialog"]');
const rel = (log: PromptLog, t: number) => t - log.marks.dealing;

// The product of the opacities from the element up: what the visitor sees.
const seenOpacity = (locator: Locator) =>
  locator.evaluate((el) => {
    let o = 1;
    for (let node: Element | null = el; node; node = node.parentElement) o *= Number(getComputedStyle(node).opacity);
    return o;
  });
const overlayOpacity = (page: Page) =>
  page.evaluate(() => {
    const overlay = document.querySelector("[data-prompt-stage]");
    if (!overlay) return 0;
    const style = getComputedStyle(overlay);
    return style.visibility === "hidden" ? 0 : Number(style.opacity);
  });
const dimState = (page: Page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("[data-prompt-dim]")!);
    return { opacity: cs.visibility === "hidden" ? 0 : Number(cs.opacity), pointer: cs.pointerEvents, image: cs.backgroundImage, filter: cs.backdropFilter || "none", z: Number(cs.zIndex) };
  });

async function expectLineShown(page: Page, text: string) {
  await expect(restingLine(page)).toHaveText(text, { timeout: 5000 });
  await expect.poll(() => seenOpacity(restingLine(page)), { timeout: 4000 }).toBe(1);
}

async function expectDealt(page: Page) {
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
}

// The page as it is once the moment is over: nothing of the big line or the dim, every list in.
async function expectPageIn(page: Page) {
  await expectDealt(page);
  await expect.poll(() => seenOpacity(lastTitle(page)), { timeout: 3000 }).toBe(1);
  await expect.poll(() => overlayOpacity(page), { timeout: 2000 }).toBe(0);
  await expect.poll(async () => (await dimState(page)).opacity, { timeout: 2000 }).toBe(0);
}

// The latest sampled frame has the host landed (the first such frame is in the log by then).
const waitForLanded = (page: Page) =>
  page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.frames.at(-1)?.host === "landed", null, { timeout: 15_000 });
// The big line is at full strength now (not: was once).
const waitForFull = (page: Page) =>
  page.waitForFunction(() => ((window as unknown as PromptWindow).__prompt.frames.at(-1)?.opacity ?? 0) >= 0.99, null, { timeout: 15_000, polling: "raf" });
const waitForHome = (page: Page) => page.waitForFunction(() => document.documentElement.dataset.home === "ready", null, { timeout: 30_000 });
const waitForLockOff = (page: Page, timeout = 10_000) =>
  page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.lockOff !== null, null, { timeout });
// The moment of a test's own input, on the page's clock. Stamped, not listened for: the cutscene's lock
// swallows a wheel with stopImmediatePropagation, so a listener would only see one that got through.
const stamp = (page: Page) => page.evaluate(() => ((window as unknown as PromptWindow).__prompt.stampAt = performance.now()));

// A first visit's deal from page 1's foot, by the button.
async function dealFromFoot(page: Page) {
  await watchPrompt(page);
  await openHome(page, { debug: DEBUG, at: "foot" });
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
}

function expectNeverShown(log: PromptLog) {
  expect(log.frames.filter((f) => f.opacity > 0).length, "frames with the big line showing").toBe(0);
}

// When the first of the page's labels is first seen, on the page's clock.
const firstLabelSeenAt = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const label = [...document.querySelectorAll<HTMLElement>("#work [data-deal-label]")].find((element) => element.getClientRects().length > 0)!;
        const tick = () => (Number(getComputedStyle(label).opacity) > 0.02 ? resolve(performance.now()) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
  );

type Hold = {
  frames: number;
  touching: number; // frames in which the big line's box met a card
  minAir: number; // the least air between them, px (60: none within 60)
  box: { left: number; top: number; right: number; bottom: number };
  line: { left: number; top: number; bottom: number };
  listBottom: number; // the Work list's foot (0 on a phone, whose line sits under the page title)
  titleBottom: number;
  columnsTop: number;
  stageBottom: number;
  pill: { left: number; top: number; right: number; bottom: number } | null; // the Music pill, when it is shown
  textPx: number;
  linePx: number;
  titlePx: number;
  dim: number;
  dimPointer: string;
  dimZ: number;
  dimImage: string;
  dimFilter: string;
  pageShown: number; // the most any of the page title, the labels and the lists showed
  vw: number;
  vh: number;
};

// Every frame from now (the line at full strength) until its shrink begins or it is gone: the line's
// box against the cards as drawn, and how much of the waiting page showed.
const measureHold = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Hold>((resolve) => {
        type Pt = { x: number; y: number };
        const axes = (shape: Pt[]) => shape.map((a, i) => ({ x: -(shape[(i + 1) % shape.length].y - a.y), y: shape[(i + 1) % shape.length].x - a.x }));
        const meet = (a: Pt[], b: Pt[]) =>
          [...axes(a), ...axes(b)].every((axis) => {
            const pa = a.map((p) => p.x * axis.x + p.y * axis.y);
            const pb = b.map((p) => p.x * axis.x + p.y * axis.y);
            return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
          });
        const grown = (box: DOMRect, by: number): Pt[] => [
          { x: box.left - by, y: box.top - by },
          { x: box.right + by, y: box.top - by },
          { x: box.right + by, y: box.bottom + by },
          { x: box.left - by, y: box.bottom + by },
        ];
        const shown = <T extends Element>(selector: string) => [...document.querySelectorAll<T>(selector)].find((element) => element.getClientRects().length > 0) ?? null;
        const edges = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        const coil = (window as unknown as PromptWindow).__coil!;
        const stage = document.querySelector<HTMLElement>("[data-prompt-stage]")!;
        const text = document.querySelector<HTMLElement>("[data-prompt-text]")!;
        const title = shown<HTMLElement>("#work [data-page-title]")!;
        const host = shown<HTMLElement>("#work [data-prompt-host]")!;
        const line = host.querySelector<HTMLElement>("[data-prompt-line]")!;
        const pill = shown<HTMLElement>("[data-pill]");
        const dim = getComputedStyle(document.querySelector("[data-prompt-dim]")!);
        const first = text.getBoundingClientRect();
        const lineBox = line.getBoundingClientRect();
        // What the visitor sees of an element: the product of the opacities from it up.
        const seen = (element: Element | null) => {
          let opacity = 1;
          for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
          return opacity;
        };
        const page2 = [title, ...document.querySelectorAll("#work [data-deal-label], #work [data-deal-title]")].filter((element) => element.getClientRects().length > 0);
        const out: Hold = {
          frames: 0,
          touching: 0,
          minAir: 60,
          box: edges(first),
          line: { left: lineBox.left, top: lineBox.top, bottom: lineBox.bottom },
          listBottom: host.hasAttribute("data-card-progress") ? (host.previousElementSibling?.getBoundingClientRect().bottom ?? 0) : 0,
          titleBottom: title.getBoundingClientRect().bottom,
          columnsTop: shown<HTMLElement>("#work h3[data-deal-label]")!.getBoundingClientRect().top,
          stageBottom: document.querySelector("[data-coil-stage]")!.getBoundingClientRect().bottom,
          pill: pill ? edges(pill.getBoundingClientRect()) : null,
          textPx: parseFloat(getComputedStyle(text).fontSize),
          linePx: parseFloat(getComputedStyle(line).fontSize),
          titlePx: parseFloat(getComputedStyle(title).fontSize),
          dim: dim.visibility === "hidden" ? 0 : Number(dim.opacity),
          dimPointer: dim.pointerEvents,
          dimZ: Number(dim.zIndex),
          dimImage: dim.backgroundImage,
          dimFilter: dim.backdropFilter || "none",
          pageShown: 0,
          vw: document.documentElement.clientWidth,
          vh: window.innerHeight,
        };
        const tick = () => {
          const style = getComputedStyle(stage);
          if (style.visibility === "hidden" || Number(style.opacity) < 0.99 || new DOMMatrix(style.transform).a < 0.9995) return resolve(out);
          out.pageShown = Math.max(out.pageShown, ...page2.map(seen));
          const box = text.getBoundingClientRect();
          const quads = coil.visibleQuads!();
          out.frames += 1;
          if (quads.some((quad) => meet(grown(box, 0), quad))) out.touching += 1;
          let air = 0;
          while (air < 60 && !quads.some((quad) => meet(grown(box, air + 1), quad))) air += 1;
          out.minAir = Math.min(out.minAir, air);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

// The line alone holds its full size for 600 ms (36 frames at 60 a second).
const HOLD_FRAMES = 14;

// 1. A first visit, from 768 px wide: the line plays where it rests in the Work column, beside the lit Coil.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
]) {
  test.describe(`a first visit at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`the big line is read alone under the Work list, clear of every card, beside the lit Coil, and rests as Click a card to open it at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await dealFromFoot(page);
      await waitForFull(page);
      const hold = await measureHold(page);
      expect(hold.frames, "frames of the line alone").toBeGreaterThan(HOLD_FRAMES);
      expect(hold.touching, "frames in which the big line meets a card").toBe(0);
      expect(hold.minAir, "the least air between the line and a card, px").toBeGreaterThanOrEqual(P.textAirPx);
      expect(Math.abs(hold.box.left - hold.line.left), "it grows from the resting line's left edge").toBeLessThanOrEqual(1);
      expect(hold.box.top, "clear of the Work list above").toBeGreaterThanOrEqual(hold.listBottom + 2);
      expect(hold.box.bottom, "inside the screen").toBeLessThanOrEqual(hold.vh);
      expect(hold.box.right, "inside the screen's gutter").toBeLessThanOrEqual(hold.vw - 15);
      expect(hold.textPx / hold.titlePx, "the start size in page titles").toBeLessThanOrEqual(P.titleRatio + 0.01);
      expect(hold.textPx, "bigger than the line it grows from").toBeGreaterThan(hold.linePx);
      expect(hold.dim, "the dim is up around the lit Coil").toBeGreaterThan(0.9);
      expect(hold.dimImage, "an oval of light over the Coil").toMatch(/radial-gradient/);
      expect(hold.dimFilter, "no blur").toBe("none");
      expect(hold.dimPointer, "the dim never takes the pointer").toBe("none");
      expect(hold.dimZ, "the dim sits under the logo and the Menu pill").toBeLessThan(40);
      expect(hold.pageShown, "the most any of the page title, the labels and the lists showed while the line was read").toBe(0);
      test.info().annotations.push({ type: "hold", description: `${hold.frames} frames, least air ${hold.minAir} px, ${(hold.textPx / hold.titlePx).toFixed(2)} page titles (${hold.textPx.toFixed(1)} px)` });
      await waitForLanded(page);
      await expect.poll(async () => (await dimState(page)).opacity, { timeout: 1000 }).toBe(0);
      await expectLineShown(page, prompt.fine);
      await expectPageIn(page);
    });
  });
}

// 2. A first visit on a phone: under the page title, below the Coil's band, with no dim.
test.describe("a first visit on a phone, 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the big line is read alone under the page title, below the Coil's band, and rests as Tap a card to open it", async ({ page }) => {
    await dealFromFoot(page);
    await waitForFull(page);
    const hold = await measureHold(page);
    expect(hold.frames, "frames of the line alone").toBeGreaterThan(HOLD_FRAMES);
    expect(hold.touching, "frames in which the big line meets a card").toBe(0);
    expect(Math.abs(hold.box.left - hold.line.left), "it grows from the resting line's left edge").toBeLessThanOrEqual(1);
    expect(hold.box.top, "under the Coil's canvas, where no card is ever drawn").toBeGreaterThanOrEqual(hold.stageBottom);
    expect(hold.box.top, "clear of the page title above").toBeGreaterThanOrEqual(hold.titleBottom + 2);
    expect(hold.box.bottom, "clear of the columns below").toBeLessThanOrEqual(hold.columnsTop - 2);
    expect(hold.box.right, "inside the screen's gutter").toBeLessThanOrEqual(hold.vw - 15);
    expect(hold.textPx / hold.titlePx, "the start size in page titles").toBeLessThanOrEqual(P.phoneTitles + 0.01);
    expect(hold.textPx, "bigger than the line it grows from").toBeGreaterThan(hold.linePx);
    expect(hold.dim, "no dim on a phone: only the waiting page would be under it").toBe(0);
    expect(hold.dimPointer, "the dim never takes the pointer").toBe("none");
    expect(hold.pageShown, "the most any of the page title, the labels and the lists showed while the line was read").toBe(0);
    test.info().annotations.push({ type: "hold", description: `${hold.frames} frames, ${(hold.textPx / hold.titlePx).toFixed(2)} page titles (${hold.textPx.toFixed(1)} px)` });
    await waitForLanded(page);
    await expectLineShown(page, prompt.coarse);
    await expectPageIn(page);
    const rects = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll("#work [data-prompt-host] [data-prompt-line]")).find((el) => el.getClientRects().length > 0)!;
      const title = Array.from(document.querySelectorAll("#work button[data-card]")).find((el) => el.getClientRects().length > 0)!;
      return { line: line.getBoundingClientRect().bottom, title: title.getBoundingClientRect().top, height: window.innerHeight };
    });
    expect(rects.line, "the resting line is inside the first screen").toBeLessThanOrEqual(rects.height);
    expect(rects.line, "and above the first title").toBeLessThanOrEqual(rects.title);
  });
});

// 3. The order and its times.
test("the line shows as the Coil lands, the columns start half way through its shrink, and it hands over on its resting spot", async ({ page }) => {
  await dealFromFoot(page);
  const labelAt = await firstLabelSeenAt(page);
  await waitForLanded(page);
  const log = await readLog(page);
  const shown = log.frames.find((f) => f.opacity > 0)!;
  const landed = log.frames.find((f) => f.host === "landed")!;
  // The click comes a frame or two before "dealing" is written, so each bound is a little loose.
  expect(rel(log, shown.t), "the line shows, ms from the deal's start").toBeGreaterThanOrEqual(PLAN.startMs - 50);
  expect(rel(log, shown.t)).toBeLessThanOrEqual(PLAN.startMs + 250);
  expect(rel(log, labelAt), "the first label shows after the line has been read").toBeGreaterThan(PLAN.shrinkStartMs - 40);
  expect(rel(log, labelAt), "and soon after the shrink's middle").toBeLessThan(PLAN.columnsAtMs + 250);
  expect(rel(log, landed.t), "the line lands by the plan's end").toBeLessThanOrEqual(PLAN.endMs + 400);
  await expectLineShown(page, prompt.fine);
  const line = await restingLine(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width, middle: r.top + r.height / 2 };
  });
  const last = log.frames.filter((f) => f.opacity > 0).at(-1)!.box!;
  expect(Math.abs(last.left - line.left), "the last big frame sits on the line's left").toBeLessThanOrEqual(4);
  expect(Math.abs(last.width - line.width) / line.width, "at its width").toBeLessThanOrEqual(0.06);
  expect(Math.abs(last.top + last.height / 2 - line.middle), "on its middle").toBeLessThanOrEqual(3);
  await expectPageIn(page);
  const after = await readLog(page);
  expect(after.marks.dealt - after.marks.dealing, "a first visit is dealt once the lists are in").toBeLessThan(PLAN.columnsAtMs + 1500);
  test.info().annotations.push({
    type: "timing",
    description: JSON.stringify({ shownMs: Math.round(rel(log, shown.t)), firstLabelMs: Math.round(rel(log, labelAt)), landedMs: Math.round(rel(log, landed.t)), dealtMs: Math.round(rel(after, after.marks.dealt)) }),
  });
});

// 4. A line landed early brings the page with it.
for (const input of ["Escape", "a wheel"] as const) {
  test(`${input} while the line is read lands it at once, gives the scroll back and brings the columns in`, async ({ page }) => {
    await dealFromFoot(page);
    await waitForFull(page);
    await stamp(page);
    if (input === "Escape") await page.keyboard.press("Escape");
    else {
      const view = page.viewportSize()!;
      await page.mouse.move(view.width / 2, view.height / 2);
      await stamp(page);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(30);
      }
    }
    const labelAt = await firstLabelSeenAt(page);
    await waitForLanded(page);
    await waitForLockOff(page, 5000);
    const log = await readLog(page);
    const landed = log.frames.find((f) => f.host === "landed")!;
    expect(rel(log, log.stampAt!), "the input came while the line was read").toBeLessThan(PLAN.shrinkStartMs);
    expect(rel(log, labelAt), "the first label shows before the line would have begun to shrink on its own").toBeLessThan(PLAN.shrinkStartMs);
    expect(landed.t - log.stampAt!, "the line lands within 450 ms of the input").toBeLessThanOrEqual(450);
    expect(log.lockOff! - log.stampAt!, "the scroll lock lets go within 600 ms of the input").toBeLessThanOrEqual(600);
    await expectLineShown(page, prompt.fine);
    await expectPageIn(page);
  });
}

// 5. A card pressed while the line is read opens (review focus 3).
const cardNearMiddle = (page: Page) =>
  page.evaluate(() => {
    const quads = (window as unknown as PromptWindow).__coil?.visibleQuads?.() ?? [];
    let best: { x: number; y: number; d: number } | null = null;
    for (const quad of quads) {
      const c = quad.reduce((sum, p) => ({ x: sum.x + p.x / quad.length, y: sum.y + p.y / quad.length }), { x: 0, y: 0 });
      const d = Math.hypot(c.x - innerWidth / 2, c.y - innerHeight / 2);
      if (!best || d < best.d) best = { ...c, d };
    }
    return best;
  });
for (const size of [
  { name: "1440x900 by mouse", viewport: { width: 1440, height: 900 }, phone: false },
  { name: "390x844 by tap", viewport: { width: 390, height: 844 }, phone: true },
]) {
  test.describe(`an open while the line is read, ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.phone, hasTouch: size.phone });

    test(`a card pressed while the line is read opens, the lists arrive behind it, and the spot reads 1 of 14 opened once it closes, ${size.name}`, async ({ page }) => {
      await dealFromFoot(page);
      await waitForFull(page);
      const at = await cardNearMiddle(page);
      expect(at, "a card near the middle").toBeTruthy();
      if (size.phone) await page.touchscreen.tap(at!.x, at!.y);
      else {
        // A fine pointer opens the card it hovers: let a frame pick it first.
        await page.mouse.move(at!.x, at!.y, { steps: 4 });
        await page.waitForTimeout(250);
        expect((await dimState(page)).opacity, "pressed while the dim is up").toBeGreaterThan(0);
        await page.mouse.click(at!.x, at!.y);
      }
      await stamp(page);
      await expect(dialog(page)).toBeVisible({ timeout: 3000 });
      const log = await readLog(page);
      expect(rel(log, log.stampAt!), "the press came before the line would have landed on its own").toBeLessThan(PLAN.shrinkEndMs);
      await expect.poll(() => seenOpacity(lastTitle(page)), { timeout: 3000 }).toBe(1);
      await expect.poll(() => overlayOpacity(page), { timeout: 1000 }).toBe(0);
      expect((await dimState(page)).opacity, "no dim behind the modal").toBe(0);
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
      await expect(countLine(page)).toHaveText(OPENED_ONE, { timeout: 5000 });
      await expect.poll(() => seenOpacity(countLine(page)), { timeout: 4000 }).toBe(1);
      expect(await page.evaluate((key) => localStorage.getItem(key), CARD_OPENED_KEY)).toBe("1");
    });
  });
}

// 6. The first open ends the prompt for good.
test("the first open writes the once-ever key, and after it the spot reads 1 of 14 opened", async ({ page }) => {
  await openHome(page);
  const row = cardRow(page, "ieee");
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole("dialog", { name: siteContent.cards.ieee.modal.title, exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), CARD_OPENED_KEY)).toBe("1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(restingLine(page)).toHaveText(OPENED_ONE, { timeout: 5000 });
});

// 7. Nothing of this moves for a visitor who has opened a card before (review focus 2).
test("a visitor who opened a card before gets no big moment, the columns at the deal's own time, and an empty spot until they open one", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), CARD_OPENED_KEY);
  await dealFromFoot(page);
  const titleAt = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const title = [...document.querySelectorAll<HTMLElement>("#work [data-deal-title]")].find((element) => element.getClientRects().length > 0)!;
        const tick = () => (Number(getComputedStyle(title).opacity) > 0.5 ? resolve(performance.now()) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
  );
  await expectDealt(page);
  await page.waitForTimeout(1500);
  const log = await readLog(page);
  expectNeverShown(log);
  expect(rel(log, titleAt), "the first title is more than half in, ms from the deal's start").toBeLessThan(2700);
  expect(log.marks.dealt - log.marks.dealing, "today's bound for the deal").toBeLessThan(3200);
  expect((await dimState(page)).opacity, "no dim").toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll("[data-prompt-host][data-prompt]").length), "hosts marked by a run").toBe(0);
  const host = restingHost(page);
  expect(await seenOpacity(host)).toBe(0);
  await expect(host).toHaveAttribute("aria-hidden", "true");
});

// 8. No deal, no big moment: the line is simply in its spot.
test("no deal, no big moment: a load into /#work", async ({ page }) => {
  await watchPrompt(page);
  await page.goto(`/?coildebug=${DEBUG}#work`);
  await waitForHome(page);
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  await expectLineShown(page, prompt.fine);
});

test("no deal, no big moment: an upward jump into #work", async ({ page }) => {
  await watchPrompt(page);
  await page.goto(`/?coildebug=${DEBUG}`);
  await waitForScene(page);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 5000 });
  // The deal director reads direction from scroll events: let it see the bottom before the jump up.
  await nextFrames(page, 3);
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("work")!.getBoundingClientRect().top + window.scrollY, behavior: "instant" }));
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  await expectLineShown(page, prompt.fine);
});

test("no deal, no big moment: the still path", async ({ page }) => {
  await watchPrompt(page);
  await page.addInitScript(noWebgl2Api);
  await page.goto("/?coildebug=1");
  await page.waitForFunction(() => document.querySelector("section[data-scene]")?.getAttribute("data-scene") === "still", null, { timeout: 30_000 });
  await page.locator("[data-intro-cta] a").first().click();
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  await expectLineShown(page, prompt.fine);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("reduced motion shows the line in its spot, with no big line", async ({ page }) => {
    await watchPrompt(page);
    await page.goto(`/?coildebug=${DEBUG}#work`);
    await waitForHome(page);
    await expectDealt(page);
    await page.waitForTimeout(1500);
    expectNeverShown(await readLog(page));
    await expectLineShown(page, prompt.fine);
  });
});

// 9. Every way into a played deal plays it.
test("a Menu link to Work from page 1 plays the big moment with the deal", async ({ page }) => {
  await watchPrompt(page);
  await openHome(page, { debug: DEBUG, at: "top" });
  await page.getByRole("button", { name: siteContent.menu.ariaLabelOpen }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Work", exact: true }).click();
  await waitForLanded(page);
  const log = await readLog(page);
  expect(log.frames.some((f) => f.opacity >= 0.99), "a frame at full strength").toBe(true);
  await expectLineShown(page, prompt.fine);
  await expectPageIn(page);
});

// 10. The cutscene's lock.
test("the cutscene's lock holds the reader's scroll until the line has landed, and never past the 3.8 s cap", async ({ page }) => {
  await dealFromFoot(page);
  await waitForLanded(page);
  await waitForLockOff(page);
  const log = await readLog(page);
  const release = rel(log, log.lockOff!);
  expect(release).toBeGreaterThanOrEqual(Math.min(PLAN.lockUntilMs, CAP_MS) - 150);
  expect(release).toBeLessThanOrEqual(CAP_MS + 450);
  expect(rel(log, log.frames.find((f) => f.host === "landed")!.t)).toBeLessThanOrEqual(PLAN.endMs + 400);
  test.info().annotations.push({ type: "lock", description: `released ${Math.round(release)} ms from the click (the line's end ${PLAN.lockUntilMs}, the cap ${CAP_MS})` });
});

// 11. What can happen in the middle of the run.
test("a scroll mid-shrink carries the big line with the page", async ({ page }) => {
  await dealFromFoot(page);
  await page.waitForFunction(
    () => {
      const frames = (window as unknown as PromptWindow).__prompt.frames;
      const last = frames.at(-1);
      const widest = Math.max(0, ...frames.filter((f) => f.opacity > 0).map((f) => f.box?.width ?? 0));
      return !!last?.box && last.opacity > 0 && widest > 0 && last.box.width < widest * 0.9;
    },
    null,
    { timeout: 20_000, polling: "raf" },
  );
  // By the page's own scroll: the lock swallows a reader's wheel until the line has landed.
  const scrolled = await page.evaluate(() => {
    const frames = (window as unknown as PromptWindow).__prompt.frames;
    const topBefore = frames.at(-1)!.box!.top;
    const yBefore = window.scrollY;
    const at = performance.now();
    window.scrollBy({ top: window.innerHeight / 2, behavior: "instant" });
    return { topBefore, at, moved: window.scrollY - yBefore };
  });
  expect(scrolled.moved, "the page scrolled").toBeGreaterThan(100);
  await waitForLanded(page);
  const log = await readLog(page);
  // The sampler's frame callback runs ahead of GSAP's ticker, so the first frames after the scroll can still show the old transform: read one 50 ms later.
  const next = log.frames.find((f) => f.t > scrolled.at + 50 && f.opacity > 0);
  expect(next, "a frame after the scroll").toBeTruthy();
  expect(Math.abs(next!.box!.top - (scrolled.topBefore - scrolled.moved)), "the line went with the page, px off").toBeLessThanOrEqual(12);
  expect(rel(log, log.frames.find((f) => f.host === "landed")!.t)).toBeLessThanOrEqual(PLAN.endMs + 400);
});

test("reduced motion switched on mid-run hides the big line and the dim and rests the line at once", async ({ page }) => {
  await dealFromFoot(page);
  await waitForFull(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(async () => [await overlayOpacity(page), (await dimState(page)).opacity, await seenOpacity(restingLine(page))], { timeout: 300, intervals: [16] })
    .toEqual([0, 0, 1]);
  await expect(restingLine(page)).toHaveText(prompt.fine);
  await expect.poll(() => seenOpacity(lastTitle(page)), { timeout: 3000 }).toBe(1);
});

test("a resize mid-run lands the line where it rests and the lists arrive", async ({ page }) => {
  await dealFromFoot(page);
  await waitForFull(page);
  await stamp(page);
  await page.setViewportSize({ width: 1180, height: 760 });
  await waitForLanded(page);
  const log = await readLog(page);
  const landed = log.frames.find((f) => f.host === "landed")!;
  expect(rel(log, log.stampAt!), "the resize came while the line was read").toBeLessThan(PLAN.shrinkStartMs);
  expect(landed.t - log.stampAt!, "the line lands within 450 ms of the resize").toBeLessThanOrEqual(450);
  await expectLineShown(page, prompt.fine);
  await expectPageIn(page);
});

// 12. Windows too short or too narrow for the place (review focus 4).
for (const viewport of [
  { width: 1024, height: 600 },
  { width: 768, height: 500 },
]) {
  test.describe(`a short window, ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`the big line meets no card, the Work list or the Music pill, and is never smaller than the line at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await dealFromFoot(page);
      await waitForFull(page);
      const hold = await measureHold(page);
      expect(hold.frames, "frames of the line alone").toBeGreaterThan(HOLD_FRAMES);
      expect(hold.touching, "frames in which the big line meets a card").toBe(0);
      expect(hold.box.top, "clear of the Work list above").toBeGreaterThanOrEqual(hold.listBottom);
      expect(hold.box.right, "inside the screen's gutter").toBeLessThanOrEqual(hold.vw - 15);
      // The text's box against the Music pill's, when the pill is shown.
      const meetsPill = hold.pill !== null && hold.box.left < hold.pill.right && hold.pill.left < hold.box.right && hold.box.top < hold.pill.bottom && hold.pill.top < hold.box.bottom;
      expect(meetsPill, "the big line over the Music pill").toBe(false);
      expect(hold.textPx, "never smaller than the line it rests as").toBeGreaterThanOrEqual(hold.linePx - 0.01);
      expect(hold.textPx / hold.titlePx, "the start size in page titles").toBeLessThanOrEqual(P.titleRatio + 0.01);
      expect(hold.pageShown, "the page waits for the line").toBe(0);
      test.info().annotations.push({ type: "hold", description: `${hold.frames} frames, ${hold.textPx.toFixed(1)} px (the line ${hold.linePx.toFixed(1)} px), top ${hold.box.top.toFixed(0)} of ${hold.vh}, least air ${hold.minAir} px` });
      await waitForLanded(page);
      await expectLineShown(page, prompt.fine);
      await expectPageIn(page);
    });
  });
}

test.describe("the narrowest phone, 320x640", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

  test("the big line stays inside the gutters and clear of the page title and the columns at 320x640", async ({ page }) => {
    await dealFromFoot(page);
    await waitForFull(page);
    const hold = await measureHold(page);
    expect(hold.frames, "frames of the line alone").toBeGreaterThan(HOLD_FRAMES);
    expect(hold.box.left, "the left gutter").toBeGreaterThanOrEqual(15);
    expect(hold.box.right, "the right gutter").toBeLessThanOrEqual(hold.vw - 15);
    expect(hold.box.top, "clear of the page title above").toBeGreaterThanOrEqual(hold.titleBottom + 2);
    expect(hold.box.bottom, "clear of the columns below").toBeLessThanOrEqual(hold.columnsTop - 2);
    expect(hold.touching, "frames in which the big line meets a card").toBe(0);
    expect(hold.textPx, "never smaller than the line it rests as").toBeGreaterThanOrEqual(hold.linePx - 0.01);
    await waitForLanded(page);
    await expectLineShown(page, prompt.coarse);
    await expectPageIn(page);
  });
});

// 13. The tab hidden while the line is read (review focus 5). Playwright cannot hide a page, so the
// page is told it is hidden: the lock reads document.visibilityState on visibilitychange.
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((on) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (on ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => on });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

test("the tab hidden while the line is read lets the lock go, and on return the line rests in its spot with the lists in", async ({ page }) => {
  await dealFromFoot(page);
  await waitForFull(page);
  await stamp(page);
  await setHidden(page, true);
  await waitForLockOff(page, 2000);
  const log = await readLog(page);
  expect(rel(log, log.stampAt!), "hidden while the line was read").toBeLessThan(PLAN.shrinkStartMs);
  expect(log.lockOff! - log.stampAt!, "the lock lets go at once").toBeLessThanOrEqual(150);
  await page.waitForTimeout(400);
  await setHidden(page, false);
  await waitForLanded(page);
  await expectLineShown(page, prompt.fine);
  await expectPageIn(page);
});
