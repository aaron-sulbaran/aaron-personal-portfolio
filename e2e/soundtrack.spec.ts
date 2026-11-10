import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { playerStrings as P } from "@/lib/content/player";
import { ISLE } from "@/lib/player/constants";
import { DOCK } from "@/lib/waveform/dock";
import { dotReach } from "@/lib/wavepath/columns";
import { AMPLITUDE, SHAPE_GAIN } from "@/lib/wavepath/constants";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import {
  CAPSULE,
  GREETED_KEY,
  PILL,
  SOUNDTRACK_KEY,
  armDock,
  bandControl,
  bandLayerShown,
  dockGeometry,
  dockLanded,
  dockText,
  peekDock,
  readDock,
  recordDockAcrossReducedMotion,
  startDock,
  stopDock,
  storedChoice,
  toCards,
  type DockSample,
} from "./support/dock";
import { BAND_CARD, PLAYER_PILL } from "./support/player";
import { bandBottomAt, headAtRest, parkBand } from "./support/wave";

// The soundtrack band (#listen): in flow under the book, where the waveform
// lives; "Play it" really plays (and the player takes over from there, see
// e2e/player.spec.ts), "Not now" leaves a still line in the band, and the stock
// playback pill, the way back to the music, fades in at its dock on the wave's
// line at the bottom left once the band's bottom edge passes the dock line (the
// dock tests below, spec sections 2 and 5). A deep load into the page keeps its
// layout still.

const L = siteContent.listen;
const S = siteContent.soundtrack;
const HOME = "/?wavedebug";

// Counts every repaint of each 2D canvas (the wave clears once per paint) and
// remembers every media element that was asked to play.
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const paints = new WeakMap<HTMLCanvasElement, number>();
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (this: CanvasRenderingContext2D, ...args: [number, number, number, number]) {
      paints.set(this.canvas, (paints.get(this.canvas) ?? 0) + 1);
      return clear.apply(this, args);
    };
    const media: HTMLMediaElement[] = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!media.includes(this)) media.push(this);
      return play.call(this);
    };
    Object.assign(window, {
      __e2eBandPaints: () => {
        const canvas = document.querySelector<HTMLCanvasElement>("#listen canvas");
        return canvas ? (paints.get(canvas) ?? 0) : -1;
      },
      __e2eMedia: () => media.map((el) => ({ paused: el.paused, time: el.currentTime, src: el.currentSrc, error: el.error?.code ?? null })),
    });
  });
}

const bandPaints = (page: Page) => page.evaluate(() => (window as unknown as { __e2eBandPaints: () => number }).__e2eBandPaints());
const bandRepaints = async (page: Page, ms: number) => {
  const before = await bandPaints(page);
  await page.waitForTimeout(ms);
  return (await bandPaints(page)) - before;
};
type MediaRead = { paused: boolean; time: number; src: string; error: number | null };
const media = (page: Page) => page.evaluate(() => (window as unknown as { __e2eMedia: () => MediaRead[] }).__e2eMedia());

// The band fully in view with its centre at 70 percent of the viewport.
async function scrollBandIntoView(page: Page) {
  await parkBand(page);
  await page.waitForFunction(() => {
    const rect = document.querySelector("#listen")!.getBoundingClientRect();
    return rect.top > 80 && rect.bottom < window.innerHeight;
  });
}

// Focuses the last control the keyboard can reach before the pill in
// document order (the pill is portaled to the end of <body>).
async function focusLastBeforePill(page: Page) {
  const focused = await page.evaluate(() => {
    const pill = document.querySelector("[data-pill]")!;
    const reachable = [...document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")].filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.closest("[inert]") &&
        !pill.contains(el) &&
        !!(el.compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        getComputedStyle(el).visibility !== "hidden" &&
        el.getClientRects().length > 0,
    );
    const last = reachable.at(-1);
    last?.focus({ preventScroll: true });
    return !!last && document.activeElement === last;
  });
  expect(focused, "a control before the pill took focus").toBe(true);
}

// The wave lives in the band and nowhere else: no canvas fixed to the
// viewport, and no text outside the band carries the duck's mark. The band is
// on page 1, in flow between its blocks, above the cards section.
test("band: in flow on page 1, above the cards; no canvas is fixed to the viewport", async ({ page }) => {
  await openHome(page, { path: HOME });
  const layout = await page.evaluate(() => {
    const band = document.getElementById("listen")!;
    const cards = document.getElementById("work")!;
    const fixed = [...document.querySelectorAll("canvas")].filter((c) => {
      for (let n: HTMLElement | null = c; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
      return false;
    });
    return {
      precedesCards: !!(band.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING),
      inIntro: !!band.closest("#about"),
      position: getComputedStyle(band).position,
      fixedCanvases: fixed.length,
      avoidOutsideBand: [...document.querySelectorAll("[data-wave-avoid]")].filter((el) => !band.contains(el)).length,
      bandBottom: band.getBoundingClientRect().bottom + window.scrollY,
      cardsTop: cards.getBoundingClientRect().top + window.scrollY,
    };
  });
  expect(layout.precedesCards).toBe(true);
  expect(layout.inIntro, "the band sits inside page 1").toBe(true);
  expect(["static", "relative"]).toContain(layout.position);
  expect(layout.fixedCanvases, "canvases fixed to the viewport").toBe(0);
  expect(layout.avoidOutsideBand, "duck marks outside the band").toBe(0);
  expect(layout.bandBottom).toBeLessThan(layout.cardsTop);
});

// The pill docks at the bottom left (z 45). At the foot of the page it covers
// none of the footer's small lines from md up; the wordmark under it is a
// graphic, and the period's button sits far right of it.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`footer: at the page end the docked capsule covers no footer text at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await armDock(page);
    await openHome(page, { path: HOME });
    await scrollBandIntoView(page);
    await toCards(page);
    await dockLanded(page);
    await scrollToY(page, await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight));
    await dockLanded(page);
    const read = await page.evaluate(() => {
      const capsule = document.querySelector("[data-pill] .pill-hit")!.getBoundingClientRect();
      const row = document.querySelector("[data-footer-lines]")!;
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      const boxes: { left: number; top: number; right: number; bottom: number }[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) boxes.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      const atEnd = Math.abs(window.scrollY - (document.documentElement.scrollHeight - window.innerHeight)) < 2;
      const overlaps = boxes.filter(
        (b) => b.left < capsule.right && b.right > capsule.left && b.top < capsule.bottom && b.bottom > capsule.top,
      );
      return { atEnd, boxes: boxes.length, overlaps, capsule: { top: capsule.top, bottom: capsule.bottom } };
    });
    expect(read.atEnd, "scrolled to the page end").toBe(true);
    expect(read.boxes, "text boxes in the footer row").toBeGreaterThan(0);
    expect(read.overlaps, `footer text under the capsule ${JSON.stringify(read.capsule)}`).toEqual([]);
  });
}

test("band: a real click on \"Play it\" starts playback", async ({ page }) => {
  await instrument(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);

  await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();

  await expect.poll(async () => (await media(page)).some((el) => !el.paused), { message: "a playing media element" }).toBe(true);
  // Followed by index: currentSrc can still be empty on the first read.
  const index = (await media(page)).findIndex((el) => !el.paused);
  const startedAt = (await media(page))[index].time;
  await expect
    .poll(async () => (await media(page))[index].time - startedAt, { message: "seconds played" })
    .toBeGreaterThan(0.2);
});

async function bandInk(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#listen canvas")!;
    const { data, width, height } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 0) { painted++; top = Math.min(top, y); bottom = Math.max(bottom, y); }
    return { painted, top, bottom, scale: canvas.width / canvas.clientWidth };
  });
}

// The band is the line's first stretch, the level run. Undecided it only
// breathes (and the idle ripple lifts it a little), so its ink is pinned near
// the reduced-motion run's, measured in the same test, and its height to what
// the constants allow.
test("band: the undecided run paints the still run's ink, inside the reach the constants allow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  await scrollBandIntoView(page);
  await page.waitForTimeout(300);
  const still = await bandInk(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.waitForTimeout(1200);
  const moving = await bandInk(page);
  expect(moving.painted).toBeGreaterThan(still.painted * 0.85);
  expect(moving.painted).toBeLessThan(still.painted * 1.3);
  expect(moving.bottom - moving.top).toBeLessThanOrEqual((2 * dotReach(AMPLITUDE) + 8) * moving.scale);
  expect(moving.bottom - moving.top).toBeGreaterThanOrEqual(SHAPE_GAIN * AMPLITUDE * moving.scale);
});

test("band: with the music on, the levelled columns thicken the run", async ({ page }) => {
  await instrument(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const quiet = (await bandInk(page)).painted;
  await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
  // The band is a quiet 176px stage between page 1's blocks (COIL.intro.band), so the levelled columns thicken the run by a tenth or more.
  await expect.poll(async () => (await bandInk(page)).painted, { timeout: 6000, message: "the run's ink with the music on" }).toBeGreaterThan(quiet * 1.1);
});

test("band: the run breathes in view after either answer and sleeps once the band leaves", async ({ page }) => {
  await instrument(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await page.mouse.move(4, 4);
  await expect.poll(() => bandRepaints(page, 1000), { message: "repaints in view" }).toBeGreaterThan(10);
  await toCards(page);
  await expect.poll(() => bandRepaints(page, 1000), { timeout: 10_000, intervals: [0], message: "repaints out of view" }).toBe(0);
});

// The engine split's guard: the band must look the same on the conductor and
// view as it did on the old single engine. Reduced motion paints one still
// line, so it is compared pixel for pixel against a baseline taken on main
// before the split (no scene under reduced motion, so no openHome here).
test("band: the still line under reduced motion is pixel identical to the baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  await scrollBandIntoView(page);
  await page.waitForTimeout(300);
  // The path layer draws the whole line under reduced motion, and its next stretch
  // passes behind the band; an element screenshot composites it, so it is hidden here.
  await page.addStyleTag({ content: "[data-wave-path] { visibility: hidden; }" });
  // The band's copy and controls are masked, so a copy change cannot break the wave guard.
  await expect(page.locator("#listen canvas")).toHaveScreenshot("band-still.png", {
    maxDiffPixels: 0,
    threshold: 0,
    mask: [page.locator("#listen [data-wave-avoid]")],
  });
});

test("band: the pill shows once the band is off screen, and only then takes keyboard focus", async ({ page }) => {
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const pill = page.locator(PILL);
  const capsule = page.locator(CAPSULE);
  // The band in view: the pill stays away.
  await expect(pill).toHaveAttribute("inert", "");

  await focusLastBeforePill(page);
  await page.keyboard.press("Tab");
  await expect(capsule).not.toBeFocused();

  const cardsTop = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top + window.scrollY);
  await scrollToY(page, Math.round(cardsTop + 200));
  await expect(pill).not.toHaveAttribute("inert", "");
  await expect.poll(() => pill.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);

  await focusLastBeforePill(page);
  await page.keyboard.press("Tab");
  await expect(capsule).toBeFocused();
});

test("band: a deep load past the band, at #connect, keeps its layout still (CLS under 0.05)", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: { value: number; t: number }[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) shifts.push({ value: entry.value, t: entry.startTime });
      }
    }).observe({ type: "layout-shift", buffered: true });
    Object.assign(window, { __e2eShifts: shifts });
  });
  // (A deep load at #work shifts the cards once, 0.13, when page 1's ribbon room closes above them: that is the slot release, not the band.)
  await page.goto("/#connect");
  await page.waitForFunction(() => document.documentElement.dataset.home === "ready");
  await page.waitForLoadState("networkidle");
  // Settled: no new shift for a second.
  await page.waitForFunction(() => {
    const shifts = (window as unknown as { __e2eShifts: { t: number }[] }).__e2eShifts;
    const last = shifts.length ? shifts[shifts.length - 1].t : 0;
    return performance.now() - last > 1000;
  });
  const cls = await page.evaluate(() =>
    (window as unknown as { __e2eShifts: { value: number }[] }).__e2eShifts.reduce((sum, shift) => sum + shift.value, 0),
  );
  expect(cls).toBeLessThan(0.05);
  expect(await page.evaluate(() => document.getElementById("connect")!.getBoundingClientRect().top)).toBeLessThan(200);
});

// ---------------------------------------------------------------------------
// The dock (spec sections 2, 5 and 8): from the band down the pill is there in
// every music state, faded in at its dock on the wave's line at the bottom
// left. It lands open with one line for the state, once per page
// load, holds about 2.6s (hover or keyboard focus pauses the hold), then
// collapses to the capsule. Every read goes through the dock recorder
// (support/dock.ts) and every string comes from lib/content.ts.

test("dock: the accept path plays, hands the music to the player in the band, then to the pill at its dock", async ({ page }) => {
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME, at: "top" });
  const pill = page.locator(PILL);
  // On page 1's top the stock pill is away, and no music means no player pill.
  await expect(pill).toHaveAttribute("inert", "");
  await expect(page.locator(PLAYER_PILL)).toHaveCount(0);

  await scrollBandIntoView(page);
  await expect(pill).toHaveAttribute("inert", "");
  const band = page.locator("#listen");
  await expect(band.getByRole("heading", { name: L.line })).toBeVisible();
  await expect(band.getByRole("button", { name: L.accept, exact: true })).toBeVisible();
  await expect(band.getByRole("button", { name: L.decline, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.activeElement === document.body), "focus on the body before an answer").toBe(true);

  await band.getByRole("button", { name: L.accept, exact: true }).click();
  // The playing check only; media time advancing is the separate environmental test above.
  await expect.poll(async () => (await media(page)).some((el) => el.paused === false), { message: "a playing media element" }).toBe(true);
  // The band shows the player and no status of its own; focus moves to the player's own play button, which now reads Pause.
  const card = page.locator(BAND_CARD);
  await expect(card.getByRole("button", { name: S.ariaPause, exact: true })).toBeFocused();
  await expect(band.locator("[data-band-note]")).toBeHidden();

  await toCards(page);
  // The player is the pill now: collapsed on the dock, the stock capsule stepping away.
  await expect(page.locator(PLAYER_PILL)).toHaveAttribute("data-player-pill", "collapsed");
  await expect(pill).toHaveAttribute("inert", "");
  const at = (await page.locator(PLAYER_PILL).boundingBox())!;
  expect(Math.abs(at.x - ISLE.insetPx), "pill left edge from the dock's inset").toBeLessThanOrEqual(2);
  expect(Math.abs(at.y + at.height - (page.viewportSize()!.height - ISLE.bottomPx)), "pill bottom edge from the dock").toBeLessThanOrEqual(2);
  await expect(page.locator(PLAYER_PILL).getByText(S.tracks[0].title).first()).toBeVisible();
});

test("dock: the decline path says it'll be here, settles as \"Music\", and a reload stays quiet", async ({ page }) => {
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const band = page.locator("#listen");
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  // Declined: one Play it is what is left, with focus on it.
  await expect(band.locator('[data-control="off"]')).toBeFocused();
  expect(await band.innerText()).not.toContain("No problem");

  await toCards(page);
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the label as it lands" }).toBe(S.dockDeclined);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsuleOff);
  expect(await storedChoice(page)).toBe("off");

  // A stored no restores as the quiet capsule: no label, no question, no audio.
  await page.goto(`${HOME}#work`);
  await settled(page);
  await dockLanded(page);
  await startDock(page);
  await page.waitForTimeout(1000);
  const texts = new Set((await stopDock(page)).map((s) => s.text));
  expect([...texts], "the pill's text through a second after landing").toEqual([S.capsuleOff]);
  expect(await media(page), "media elements asked to play").toEqual([]);
});

test("dock: unanswered, the pill arrives as \"Music?\" with no label and nothing stored", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await startDock(page);
  await toCards(page);
  await dockLanded(page);
  await page.waitForTimeout(1000);
  const samples = await stopDock(page);
  const texts = new Set(samples.filter((s) => !s.inert).map((s) => s.text));
  expect([...texts], "the pill's text from its arrival on").toEqual([S.capsuleUnanswered]);
  // One click is a yes: the capsule's name is its visible text, then the invitation.
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(`${S.capsuleUnanswered} ${S.invite}`);
  expect(await storedChoice(page)).toBeNull();
});

// The band asks on every visit, and only the play label adapts (e62d08e): a later visit gets the question with Play it after a Not now and
// Resume after a yes, and Not now always, drawn as the chosen answer once it is the answer (698a78a).
test("band: after a Not now a later visit still asks, offers Play it, and shows Not now as the answer", async ({ page }) => {
  await openHome(page, { path: HOME, at: "top" });
  const band = page.locator("#listen");
  await scrollBandIntoView(page);
  await expect(band.getByRole("heading", { name: L.line })).toBeVisible();
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  // Same visit: the question stays, beside the one Play it.
  await expect(band.locator('[data-control="off"]')).toBeVisible();
  await expect(band.getByRole("heading", { name: L.line })).toBeVisible();
  expect(await storedChoice(page)).toBe("off");

  // A later visit: the question again, Play it, and Not now as the chosen answer; no Resume.
  await page.reload();
  await settled(page);
  await scrollBandIntoView(page);
  await expect(band.getByRole("heading", { name: L.lineReturning })).toBeVisible();
  const chosen = band.getByRole("button", { name: L.decline, exact: true });
  await expect(chosen).toBeVisible();
  await expect(chosen).toBeDisabled();
  await expect(chosen).toHaveAttribute("aria-pressed", "true");
  await expect(band.getByRole("button", { name: L.resume, exact: true })).toBeHidden();
  await expect(band.locator('[data-control="off"]')).toBeVisible();
  await expect(band.getByRole("button"), "Play it and the chosen Not now").toHaveCount(2);
});

// What the page draws of the band from its first frame, recorded from the start of the document: every animation frame says whether the
// question is on screen (its element laid out) and whether the unanswered controls (Play it beside Not now) are drawn, the band's
// height, and what the restored control looked like the first frame it existed; layout shifts are summed from the first one.
// Animation frames only run once rendering is unblocked, so a frame is a moment a visitor could see.
async function recordBandFrames(page: Page) {
  await page.addInitScript(() => {
    type Band = { frames: number; question: number; asking: number; heights: number[]; shift: number; first: Record<string, number> };
    const band: Band = { frames: 0, question: 0, asking: 0, heights: [], shift: 0, first: {} };
    Object.assign(window, { __band: band });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) band.shift += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    const tick = () => {
      const question = document.querySelector<HTMLElement>("[data-band-question]");
      if (question && getComputedStyle(question).display !== "none") band.question += 1;
      const asking = document.querySelector<HTMLElement>('[data-band-layer="before"]');
      if (asking && Number(getComputedStyle(asking).opacity) > 0) band.asking += 1;
      const prompt = document.querySelector("[data-band-prompt]");
      if (prompt) band.heights.push(Math.round(prompt.getBoundingClientRect().height * 10) / 10);
      for (const name of ["off", "paused"]) {
        const layer = document.querySelector<HTMLElement>(`[data-band-layer="${name}"]`);
        if (layer && !(name in band.first)) band.first[name] = Number(getComputedStyle(layer).opacity);
      }
      band.frames += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const bandFrames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __band: { frames: number; question: number; asking: number; heights: number[]; shift: number; first: Record<string, number> } }).__band);

// A reload with a stored answer is drawn as it will rest from the first frame: the question (asked on every visit), never the first visit's
// Play it, the control the answer lands on already there, the band the same height throughout, and nothing on the page moves. (A phone is
// where the question and the buttons stack, so the band used to lose 27px when the stored answer restored.)
for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const [stored, control] of [["off", "off"], ["on", "paused"]] as const) {
    test(`band: a reload at ${size.width} with a stored ${stored === "on" ? "yes" : "Not now"} is drawn as it rests from the first frame, and nothing shifts`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize(size);
      await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SOUNDTRACK_KEY, stored]);
      await page.goto("/");
      await settled(page);
      await recordBandFrames(page);
      await page.reload();
      await settled(page);
      await page.waitForTimeout(1500);
      const band = await bandFrames(page);
      expect(band.frames, "frames recorded from the start of the document").toBeGreaterThan(20);
      expect(band.question, "frames that drew the question").toBeGreaterThan(0);
      expect(band.asking, "frames that drew the first visit's Play it").toBe(0);
      expect(band.first[control], "the restored control, the first frame it existed").toBe(1);
      expect(Math.max(...band.heights) - Math.min(...band.heights), "the band's height through the load").toBeLessThan(0.5);
      expect(band.shift, "layout shift").toBe(0);
      await expect(page.locator(`#listen [data-band-layer="${control}"]`)).toHaveCount(1);
      await expect(page.locator("#listen [data-band-question]")).toHaveCount(1);
    });
  }

  test(`band: a first visit at ${size.width} still draws the question, so the recording sees it`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(size);
    await recordBandFrames(page);
    await page.goto("/");
    await settled(page);
    await page.waitForTimeout(1000);
    const band = await bandFrames(page);
    expect(band.question, "frames that drew the question").toBeGreaterThan(0);
    expect(band.asking, "frames that drew Play it beside Not now").toBeGreaterThan(0);
    await expect(page.locator("#listen [data-band-question]")).toHaveCount(1);
  });
}

test("band: a stored yes returns to the question with Resume beside Not now, and Resume starts the music", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit cannot be launched muted");
  await page.addInitScript((key) => localStorage.setItem(key, "on"), SOUNDTRACK_KEY);
  await openHome(page, { path: HOME, at: "top" });
  const band = page.locator("#listen");
  await scrollBandIntoView(page);
  await expect(band.getByRole("heading", { name: L.lineReturning })).toBeVisible();
  await expect(band.getByRole("button", { name: L.accept, exact: true })).toHaveCount(0);
  await expect(band.getByRole("button", { name: L.decline, exact: true })).toBeEnabled();
  const resume = band.getByRole("button", { name: L.resume, exact: true });
  await expect(resume).toBeVisible();
  await expect(band.getByRole("button"), "Resume and Not now").toHaveCount(2);
  await resume.click();
  await expect(page.locator(BAND_CARD)).toBeVisible();
});

test("dock: a returning visitor is welcomed back once per session, then gets the quiet \"Paused\" capsule", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "on"), SOUNDTRACK_KEY);
  await armDock(page);
  await openHome(page, { path: HOME });
  // A stored yes restores as paused: the band asks again and offers Resume.
  await scrollBandIntoView(page);
  expect(await bandLayerShown(page, "paused"), "Resume shown in the band").toBe(true);
  await expect(page.locator("#listen").getByRole("heading", { name: L.lineReturning })).toBeVisible();
  await expect(page.locator('#listen [data-control="paused"]')).toContainText(L.resume);

  await toCards(page);
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the greeting" }).toBe(S.dockReturning);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsulePaused);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), GREETED_KEY), "greeted this session").not.toBeNull();

  // A second load in the same session: no label at all.
  await page.goto(`${HOME}#work`);
  await settled(page);
  await dockLanded(page);
  await startDock(page);
  await page.waitForTimeout(1000);
  const texts = new Set((await stopDock(page)).map((s) => s.text));
  expect([...texts], "the pill's text through a second after landing").toEqual([S.capsulePaused]);
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(`${S.capsulePaused}. ${S.invite}`);
});

// The greeting's hold runs while the reader can read it, never under the deal's
// cutscene: a returning visitor who scrolls down by hand passes the band (the
// pill lands, greeting open) and reaches the deal a moment later, which holds the
// screen for about 3 s. The greeting is still open when the deal is dealt, and its
// whole hold runs from there.
test("dock: a returning visitor who scrolls down by hand reads the greeting once the deal is dealt, not under it", async ({ page, cdp }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "on"), SOUNDTRACK_KEY);
  await armDock(page);
  await openHome(page, { path: HOME, at: "top" });
  const at = { x: 720, y: 300 };
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at });
  await startDock(page);
  // A brisk hand scroll, 120 px a notch every 50 ms, until the deal has started (its lock swallows the rest).
  for (let i = 0; i < 200 && (await page.evaluate(() => document.documentElement.dataset.deal)) === "closed"; i++) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", ...at, deltaX: 0, deltaY: 120 });
    await page.waitForTimeout(50);
  }
  const greetedAt = await page.evaluate((line) => (window as unknown as { __e2eDock: { peek: () => { t: number; text: string }[] } }).__e2eDock.peek().find((s) => s.text === line)?.t ?? null, S.dockReturning);
  expect(greetedAt, "the greeting landed before the deal started").not.toBeNull();
  await page.waitForFunction(() => document.documentElement.dataset.deal === "dealt", null, { timeout: 15_000 });
  const dealtAt = await page.evaluate(() => performance.now());
  expect(await dockText(page), "the greeting when the deal is dealt").toBe(S.dockReturning);
  await expect.poll(() => dockText(page), { timeout: DOCK.holdMs + 3000, message: "the collapsed capsule" }).toBe(S.capsulePaused);
  const samples = await stopDock(page);
  const lastGreeting = samples.filter((s) => s.text === S.dockReturning).at(-1)!.t;
  // Its hold ran after the deal, the whole of it (less a frame or two of the recorder's sampling).
  expect(lastGreeting - dealtAt, "the greeting's time after the deal is dealt, ms").toBeGreaterThanOrEqual(DOCK.holdMs - 100);
});

test("dock: a click on the restored Paused capsule resumes playback", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit cannot be launched muted");
  await page.addInitScript((key) => localStorage.setItem(key, "on"), SOUNDTRACK_KEY);
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  await toCards(page);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsulePaused);

  await page.locator(CAPSULE).click();
  await expect.poll(async () => (await media(page)).some((el) => !el.paused), { message: "a playing media element" }).toBe(true);
});

test("dock: when the audio cannot start, the pill says so and the state is paused", async ({ page }) => {
  await page.route("**/audio/*.mp3", (route) => route.abort());
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await bandControl(page, "before").click();
  // The player reports it stopped inside the start window: the band drops to Resume.
  await expect.poll(() => bandLayerShown(page, "paused"), { message: "Resume shown in the band" }).toBe(true);

  await toCards(page);
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the failure label" }).toBe(S.dockFailed);
  // One press retries: the capsule's name ends with the invitation while the start has failed.
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(`${S.capsulePaused}. ${S.invite}`);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsulePaused);
  // Paused persists as the opt-in; nothing claims audible music, and nothing
  // is audible: the element asked to play failed its source and never played
  // a frame (Chromium leaves a source-failed element's paused flag false).
  expect(await storedChoice(page)).toBe("on");
  const asked = await media(page);
  expect(asked.length, "media elements asked to play").toBeGreaterThan(0);
  expect(asked.every((el) => el.paused || el.error !== null), `every media element paused or failed: ${JSON.stringify(asked)}`).toBe(true);
  expect(asked.every((el) => el.time === 0), "no media time played").toBe(true);
});

test("dock: pausing in the band inside the start window is the visitor's pause, not a failure", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await bandControl(page, "before").click();
  const playedAt = Date.now();
  const card = page.locator(BAND_CARD);
  await card.getByRole("button", { name: S.ariaPause, exact: true }).click();
  expect(Date.now() - playedAt, "Pause pressed inside the 4s start window").toBeLessThan(4000);
  await expect(card.getByRole("button", { name: S.ariaPlay, exact: true })).toBeVisible();

  // The player keeps the paused music; the stock pill, the place the failure would speak, stays away.
  await startDock(page);
  await toCards(page);
  await expect(page.locator(PLAYER_PILL)).toHaveAttribute("data-player-pill", "collapsed");
  await expect(page.locator(PLAYER_PILL).locator("svg[data-note]")).toHaveAttribute("data-note", "paused");
  await page.waitForTimeout(800);
  const texts = new Set((await stopDock(page)).map((s) => s.text));
  expect(texts.has(S.dockFailed), "the failure label at any point").toBe(false);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
});

// The introduction: an opacity fade at the dock once the band's bottom edge is
// above the dock line, and the same fade out when it returns. The box never
// moves: its left edge and centre line hold while the label opens rightward.
async function fadeRun(page: Page, bottom: number) {
  await startDock(page, 25);
  await bandBottomAt(page, bottom);
  await page.waitForTimeout(DOCK.fadeMs + 250);
  return (await stopDock(page)).filter((s) => s.shown);
}

function expectStill(samples: DockSample[], rest: DockSample) {
  for (const s of samples) {
    expect({ transform: s.transform, computed: s.computed }).toEqual({ transform: "", computed: "none" });
    expect(Math.hypot(s.x - s.width / 2 - (rest.x - rest.width / 2), s.y - rest.y), "the box held still").toBeLessThanOrEqual(0.5);
  }
}

test("dock: the pill fades in at its dock once the band's bottom edge passes the dock line, and fades out in place", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await bandBottomAt(page, DOCK.passedPx + 12);
  await page.waitForTimeout(DOCK.fadeMs + 100);
  await expect(page.locator(PILL), "band edge still in view").toHaveAttribute("inert", "");
  const fadeIn = await fadeRun(page, DOCK.passedPx - 12);
  await dockLanded(page);
  const rest = (await readDock(page))!;
  expectStill(fadeIn, rest);
  const first = fadeIn.find((s) => s.opacity > 0)!;
  const full = fadeIn.find((s) => s.opacity === 1)!;
  expect(fadeIn.some((s) => s.opacity > 0.1 && s.opacity < 0.9), "a fade in between").toBe(true);
  expect(full.t - first.t, "the fade, ms").toBeGreaterThan(DOCK.fadeMs * 0.6);
  expect(full.t - first.t).toBeLessThan(DOCK.fadeMs * 1.6);
  const fadeOut = await fadeRun(page, DOCK.passedPx + 12);
  expectStill(fadeOut, rest);
  expect(fadeOut.some((s) => s.opacity > 0.1 && s.opacity < 0.9), "a fade out between").toBe(true);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
});

test("dock: a deep load at #work fades the pill in at its dock without moving", async ({ page }) => {
  await armDock(page, { fromLoad: true });
  await page.goto(`${HOME}#work`);
  await settled(page);
  await dockLanded(page);
  await page.waitForTimeout(200);
  const samples = (await stopDock(page)).filter((s) => s.shown);
  expectStill(samples, (await readDock(page))!);
  expect(samples.some((s) => s.opacity > 0 && s.opacity < 1), "a fade in").toBe(true);
});

test("dock: turning back mid-fade reverses from the opacity it has", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  // Answered, so the band's own bottom edge is the line (an unanswered pill follows the question's).
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  // The answer re-sets the band's copy (a shorter line) and the pill's own arrival; let both settle before the scrolls.
  await page.waitForTimeout(500);
  await startDock(page, 16);
  // Both scrolls and the half-fade between them run inside the page, on its own clock: a round trip per scroll
  // would be a fade's worth of time on a busy page.
  await page.evaluate(
    async ([past, back, wait]) => {
      const to = (bottom: number) => window.scrollTo({ top: Math.round(document.getElementById("listen")!.getBoundingClientRect().bottom + window.scrollY - bottom), behavior: "instant" });
      to(past);
      await new Promise((resolve) => setTimeout(resolve, wait));
      to(back);
    },
    [DOCK.passedPx - 12, DOCK.passedPx + 12, DOCK.fadeMs / 2],
  );
  await page.waitForTimeout(DOCK.fadeMs + 100);
  const samples = (await stopDock(page)).filter((s) => s.shown);
  const peak = Math.max(...samples.map((s) => s.opacity));
  expect(peak, "turned before full").toBeLessThan(1);
  for (let i = 1; i < samples.length; i++) expect(Math.abs(samples[i].opacity - samples[i - 1].opacity), `no jump at ${i}`).toBeLessThan(0.5);
  const after = samples.slice(samples.findIndex((s) => s.opacity === peak) + 1);
  expect(after.some((s) => s.opacity > 0 && s.opacity < peak), "a fade out from the peak").toBe(true);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
});

// Progress 0 is "before" to GSAP: a return that stops exactly on the start
// fires onLeaveBack there and nothing above it, so the read at start must say
// "not passed", or the pill stays out over the book and the Coil.
test("dock: back up to exactly the dock line, then on up through the band, the pill fades away", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await bandBottomAt(page, DOCK.passedPx - 12);
  await dockLanded(page);
  await bandBottomAt(page, DOCK.passedPx);
  // The start is the band's bottom edge on the dock line, so a bottom edge at
  // exactly DOCK.passedPx is a scroll at exactly the trigger's start.
  const bottom = await page.evaluate(() => document.getElementById("listen")!.getBoundingClientRect().bottom);
  // (The layout is fractional, so a whole scroll offset lands within a pixel of the line.)
  expect(Math.abs(bottom - DOCK.passedPx), "the band's bottom edge on the dock line").toBeLessThan(1);
  await bandBottomAt(page, DOCK.passedPx + 200);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "", { timeout: DOCK.fadeMs + 2000 });
});

test("dock: the freeze stops the band's wave, and letting it move again repaints it", async ({ page }) => {
  await instrument(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await headAtRest(page);
  await bandControl(page, "before").click();
  // The reader's freeze (the pill's and the player's button write the same flag).
  await page.evaluate(() => (window as unknown as { __wavePath: { freeze: (on: boolean) => void } }).__wavePath.freeze(true));
  // Frozen, the head still follows the scroll; the band repaints while it eases back, so wait for it to rest.
  await page.waitForFunction(() => {
    const f = (window as unknown as { __wavePath: { frame: () => { head: number; target: number } | null } }).__wavePath.frame();
    return !!f && f.head === f.target;
  });
  await page.waitForTimeout(300);
  expect(await bandRepaints(page, 1000), "band repaints in a frozen second").toBe(0);
  await page.evaluate(() => (window as unknown as { __wavePath: { freeze: (on: boolean) => void } }).__wavePath.freeze(false));
  await expect.poll(() => bandRepaints(page, 1000), { message: "band repaints once the wave moves" }).toBeGreaterThan(0);
});

for (const theme of ["light", "dark"] as const) {
  test(`dock: the capsule rests on the wave's baseline at the bottom left in ${theme}`, async ({ page }) => {
    await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), { key: THEME_STORAGE_KEY, theme });
    await armDock(page);
    await page.goto(`${HOME}#work`);
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await dockLanded(page);
    const at = await dockGeometry(page);
    expect(at.height, "capsule height").toBeGreaterThanOrEqual(36);
    expect(Math.abs(at.left - DOCK.insetPx), "capsule left edge from the dock's inset").toBeLessThanOrEqual(2);
    expect(Math.abs(at.y - at.baseline), "capsule centre from the dock's line").toBeLessThanOrEqual(4);
  });
}

test("dock: each label shows once per page load; back up through the band and down again stays quiet", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await toCards(page);
  await expect.poll(() => dockText(page), { timeout: 1000 }).toBe(S.dockDeclined);
  await expect.poll(() => dockText(page), { timeout: 4000 }).toBe(S.capsuleOff);

  await parkBand(page);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
  await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-pill]")!.style.opacity === "0");

  await startDock(page);
  await toCards(page);
  await dockLanded(page);
  await page.waitForTimeout(1000);
  const texts = new Set((await stopDock(page)).filter((s) => !s.inert).map((s) => s.text));
  expect([...texts], "the pill's text on the second trip").toEqual([S.capsuleOff]);
});

test("dock: the label holds about 2.6s, and a press on the capsule hands the dock to the player", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await page.mouse.move(4, 4);

  await startDock(page);
  await toCards(page);
  // The capsule's own text can be on the pill before the label lands (the answer has just collapsed it), so wait for the capsule's text after the label's.
  await expect
    .poll(
      async () => {
        const seen = await peekDock(page);
        const labelAt = seen.findIndex((s) => s.text === S.dockDeclined);
        return labelAt >= 0 && seen.slice(labelAt).some((s) => s.text === S.capsuleOff);
      },
      { timeout: 4000, intervals: [50], message: "a recorded sample with the capsule's text after the label's" },
    )
    .toBe(true);
  const samples = await stopDock(page);
  const landed = samples.find((s) => !s.inert && s.shown && !s.transform && s.opacity === 1);
  const collapsed = samples.find((s) => landed && s.t > landed.t && s.text === S.capsuleOff);
  expect(landed && collapsed, "a landing and a collapse").toBeTruthy();
  expect(landed!.text).toBe(S.dockDeclined);
  const hold = collapsed!.t - landed!.t;
  expect(hold, "the hold, ms").toBeGreaterThan(2450);
  expect(hold).toBeLessThan(2850);

  // A press on the declined capsule plays, and the player takes the dock: the
  // stock capsule gives it up and the player opens at its dock for the click
  // that asked for it, then folds once left alone.
  await page.locator(CAPSULE).click();
  const pill = page.locator(PLAYER_PILL);
  await expect(pill).toHaveAttribute("data-player-pill", "pinned");
  await page.mouse.move(700, 200);
  await expect(pill).toHaveAttribute("data-player-pill", "collapsed", { timeout: 7000 });
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
});

test("dock: hovering the pill holds its label; leaving lets it collapse", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await toCards(page);
  await dockLanded(page);
  expect(await dockText(page)).toBe(S.dockDeclined);

  await page.locator(CAPSULE).hover();
  await page.waitForTimeout(3000);
  expect(await dockText(page), "the label after 3s under the pointer").toBe(S.dockDeclined);

  await page.mouse.move(4, 4);
  await expect.poll(() => dockText(page), { timeout: 3500, message: "collapsed after the pointer left" }).toBe(S.capsuleOff);
});

test("dock: under reduced motion the pill arrives by opacity alone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await armDock(page);
  await page.goto(HOME);
  await settled(page);
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await startDock(page);
  await toCards(page);
  await dockLanded(page);
  await page.waitForTimeout(500);
  const samples = (await stopDock(page)).filter((s) => !s.inert);
  const t0 = samples[0].t;
  const windowed = samples.filter((s) => s.t <= t0 + 700);
  expect(windowed.filter((s) => s.kind === "tick").length, "50ms samples over 700ms").toBeGreaterThanOrEqual(12);
  for (const s of windowed) {
    expect(s.transform, "inline transform during the arrival").toBe("");
    expect(s.computed, "computed transform during the arrival").toBe("none");
  }
  expect(windowed.some((s) => s.opacity > 0 && s.opacity < 1), "a fade in between").toBe(true);
  expect(windowed.at(-1)!.opacity).toBe(1);
});

test("dock: a phone has no stock pill, and after \"Not now\" the band offers Play it again, which opens the player in the band", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(HOME);
  await settled(page);
  await expect(page.locator(PILL)).toHaveCount(0);
  const band = page.locator("#listen");
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  const again = band.locator('[data-control="off"]');
  await expect(again).toBeVisible();
  await toCards(page);
  await expect(page.locator(PILL)).toHaveCount(0);
  await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
  await again.scrollIntoViewIfNeeded();
  await again.click();
  await expect(page.locator(BAND_CARD).getByRole("group", { name: P.groupLabel })).toBeVisible();
});

test("dock: on a phone the band shows the player after Play it, with no status line of its own", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(HOME);
  await settled(page);
  const band = page.locator("#listen");
  // The band on screen, as a reader who is about to press Play it has it: the player opens in the band only while the band is in view.
  await scrollBandIntoView(page);
  await bandControl(page, "before").click();
  await expect(page.locator(BAND_CARD).getByRole("group", { name: P.groupLabel })).toBeVisible();
  await expect(band.locator("[data-band-note]")).toBeHidden();
  await expect(band.locator("[data-band-controls]")).toBeHidden();
});

test("dock: a live reduced-motion toggle leaves the docked pill where it is", async ({ page }) => {
  await armDock(page);
  await page.goto(`${HOME}#work`);
  await settled(page);
  await dockLanded(page);
  const rest = (await readDock(page))!;
  // The switch back to no-preference rebuilds every sections Block and holds
  // the main thread for 100ms or more, so the window is a span of the page's
  // clock on both sides of the switch, never a count of 50ms ticks.
  const settleMs = 700;
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    const { flip, samples } = await recordDockAcrossReducedMotion(page, reducedMotion, settleMs);
    expect(samples[0].t, `a sample before the toggle to ${reducedMotion}`).toBeLessThan(flip);
    expect(samples.at(-1)!.t - flip, `sampled ${settleMs}ms past the toggle to ${reducedMotion}`).toBeGreaterThanOrEqual(settleMs);
    for (const s of samples) {
      expect({ inert: s.inert, shown: s.shown, opacity: s.opacity, transform: s.transform }, `docked through the toggle to ${reducedMotion}`).toEqual({
        inert: false,
        shown: true,
        opacity: 1,
        transform: "",
      });
      // Its left edge and its line hold.
      expect(Math.hypot(s.x - s.width / 2 - (rest.x - rest.width / 2), s.y - rest.y), "the box held still").toBeLessThanOrEqual(0.5);
    }
  }
});
