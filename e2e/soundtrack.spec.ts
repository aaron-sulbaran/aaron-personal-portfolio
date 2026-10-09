import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { DOCK } from "@/lib/waveform/dock";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { nextFrames, openHome, scrollToY } from "./support/coil";
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
  toAbout,
  type DockSample,
} from "./support/dock";
import { bandBottomAt, parkBand } from "./support/wave";

// The soundtrack band (#listen): in flow under the book, where the waveform
// lives; "Play it" really plays, "Not now" leaves a still line in the band, and the
// playback pill fades in at its dock on the wave's line at the bottom left
// once the band's bottom edge passes the dock line (the dock tests below,
// spec sections 2 and 5). A deep load into the page keeps its layout still.

const L = siteContent.listen;
const S = siteContent.soundtrack;
const HOME = "/";

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
// viewport, and no text outside the band carries the duck's mark.
test("band: in flow directly under the book; no canvas is fixed to the viewport", async ({ page }) => {
  await openHome(page, { path: HOME });
  const layout = await page.evaluate(() => {
    const band = document.getElementById("listen")!;
    const book = document.getElementById("work")!;
    const fixed = [...document.querySelectorAll("canvas")].filter((c) => {
      for (let n: HTMLElement | null = c; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
      return false;
    });
    return {
      followsBook: !!(book.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING),
      position: getComputedStyle(band).position,
      fixedCanvases: fixed.length,
      avoidOutsideBand: [...document.querySelectorAll("[data-wave-avoid]")].filter((el) => !band.contains(el)).length,
      bandTop: band.getBoundingClientRect().top + window.scrollY,
      bookBottom: book.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  expect(layout.followsBook).toBe(true);
  expect(["static", "relative"]).toContain(layout.position);
  expect(layout.fixedCanvases, "canvases fixed to the viewport").toBe(0);
  expect(layout.avoidOutsideBand, "duck marks outside the band").toBe(0);
  expect(layout.bandTop).toBeGreaterThan(layout.bookBottom - 100);
});

// The pill docks at the bottom left (z 45), so at the foot of the page the
// footer's bottom padding keeps its last row clear of the capsule from md up.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`footer: at the page end the docked capsule covers no footer text at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await armDock(page);
    await openHome(page, { path: HOME });
    await scrollBandIntoView(page);
    await toAbout(page);
    await dockLanded(page);
    await scrollToY(page, await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight));
    await dockLanded(page);
    const read = await page.evaluate(() => {
      const capsule = document.querySelector("[data-pill] .pill-hit")!.getBoundingClientRect();
      const row = document.querySelector("footer > div")!;
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

test("band: the wave draws while the band is in view, and \"Not now\" brings it to a stop", async ({ page }) => {
  await instrument(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const moving = await bandPaints(page);
  await expect.poll(async () => (await bandPaints(page)) - moving, { message: "repaints while in view" }).toBeGreaterThan(10);

  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await page.mouse.move(4, 4);

  // It eases to a still line, then stops painting: a whole second with no repaint.
  await expect
    .poll(
      async () => {
        const before = await bandPaints(page);
        await page.waitForTimeout(1000);
        return (await bandPaints(page)) - before;
      },
      { timeout: 10_000, intervals: [0], message: "repaints in a quiet second" },
    )
    .toBe(0);
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
  // The band's copy and controls are masked, so a copy change cannot break the wave guard.
  await expect(page.locator("#listen canvas")).toHaveScreenshot("band-still.png", {
    maxDiffPixels: 0,
    threshold: 0,
    mask: [page.locator("#listen [data-wave-avoid]")],
  });
});

// The idle drift runs on a real clock, so frames differ run to run; its dot
// count and vertical extent stand in for the pixels. The band around them is
// pinned to main before the split (b18e2e6, 1440 by 270 canvas): 4716 and 4730
// painted pixels, extents of 76 and 68px. A sign error in the phase, a wrong
// weight blend or a frozen field moves one of them out of it.
test("band: idle drift paints the same dot count and extent as before the split", async ({ page }) => {
  await instrument(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.waitForTimeout(1200);
  const stats = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#listen canvas")!;
    const ctx = canvas.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    let top = height;
    let bottom = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          painted++;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    return { painted, top, bottom, width, height };
  });
  const MAIN_PAINTED = 4720;
  expect(stats.painted).toBeGreaterThan(MAIN_PAINTED * 0.85);
  expect(stats.painted).toBeLessThan(MAIN_PAINTED * 1.15);
  expect(stats.bottom - stats.top).toBeGreaterThanOrEqual(60);
  expect(stats.bottom - stats.top).toBeLessThanOrEqual(100);
});

test("band: the pill shows once the band is off screen with music on, and only then takes keyboard focus", async ({ page }) => {
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const pill = page.locator("[data-pill]");
  const capsule = page.getByRole("button", { name: S.ariaOpen });
  await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
  // Music on, band in view: the band holds the controls, the pill stays away.
  await expect(pill).toHaveAttribute("inert", "");

  await focusLastBeforePill(page);
  await page.keyboard.press("Tab");
  await expect(capsule).not.toBeFocused();

  const aboutTop = await page.evaluate(() => document.getElementById("about")!.getBoundingClientRect().top + window.scrollY);
  await scrollToY(page, Math.round(aboutTop + 200));
  await expect(pill).not.toHaveAttribute("inert", "");
  await expect.poll(() => pill.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);

  await focusLastBeforePill(page);
  await page.keyboard.press("Tab");
  await expect(capsule).toBeFocused();
});

test("band: a deep load at #about keeps its layout still (CLS under 0.05)", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: { value: number; t: number }[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) shifts.push({ value: entry.value, t: entry.startTime });
      }
    }).observe({ type: "layout-shift", buffered: true });
    Object.assign(window, { __e2eShifts: shifts });
  });
  await page.goto("/#about");
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
  expect(await page.evaluate(() => document.getElementById("about")!.getBoundingClientRect().top)).toBeLessThan(200);
});

// ---------------------------------------------------------------------------
// The dock (spec sections 2, 5 and 8): from the band down the pill is there in
// every music state, faded in at its dock on the wave's line at the bottom
// left. It lands open with one line for the state, once per page
// load, holds about 2.6s (hover or keyboard focus pauses the hold), then
// collapses to the capsule. Every read goes through the dock recorder
// (support/dock.ts) and every string comes from lib/content.ts.

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test("dock: the accept path plays, fades in at the dock, says where the music lives, then shows the track", async ({ page }) => {
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  const pill = page.locator(PILL);
  // Through the hero (and the book) the pill is away.
  await expect(pill).toHaveAttribute("inert", "");

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
  // Answering moves focus to the note under the question, which now reads the accepted line.
  await expect(band.locator("[data-band-note]")).toBeFocused();
  await expect(band.locator("[data-band-note] > :not([inert])")).toHaveText(visibleText(L.acceptedNote));

  await toAbout(page);
  await expect(pill).not.toHaveAttribute("inert", "", { timeout: 1000 });
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the label as it lands" }).toBe(S.dockAccepted);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.tracks[0].title);

  await dockLanded(page);
  const at = await dockGeometry(page);
  expect(at.height, "capsule height").toBeGreaterThanOrEqual(36);
  expect(Math.abs(at.left - DOCK.insetPx), "capsule left edge from the dock's inset").toBeLessThanOrEqual(2);
  expect(Math.abs(at.y - at.baseline), "capsule centre from the dock's line").toBeLessThanOrEqual(4);
});

test("dock: the decline path says it'll be here, settles as \"Music\", and a reload stays quiet", async ({ page }) => {
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const band = page.locator("#listen");
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  await expect(band.locator("[data-band-note]")).toBeFocused();
  await expect(band.locator("[data-band-note] > :not([inert])")).toHaveText(L.declinedNote, { useInnerText: true });
  // Declined, nothing in the band moves, so its freeze toggle is inert.
  await expect(band.locator("button", { hasText: L.freeze })).toHaveAttribute("inert", "");

  await toAbout(page);
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the label as it lands" }).toBe(S.dockDeclined);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsuleOff);
  expect(await storedChoice(page)).toBe("off");

  // A stored no restores as the quiet capsule: no label, no question, no audio.
  await page.goto(`${HOME}#about`);
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
  await toAbout(page);
  await dockLanded(page);
  await page.waitForTimeout(1000);
  const samples = await stopDock(page);
  const texts = new Set(samples.filter((s) => !s.inert).map((s) => s.text));
  expect([...texts], "the pill's text from its arrival on").toEqual([S.capsuleUnanswered]);
  // One click is a yes: the capsule's name is its visible text, then the invitation.
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(`${S.capsuleUnanswered} ${S.invite}`);
  expect(await storedChoice(page)).toBeNull();
});

test("dock: a returning visitor is welcomed back once per session, then gets the quiet \"Paused\" capsule", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "on"), SOUNDTRACK_KEY);
  await armDock(page);
  await openHome(page, { path: HOME });
  // A stored yes restores as paused: the band offers Resume.
  await scrollBandIntoView(page);
  expect(await bandLayerShown(page, "paused"), "Resume shown in the band").toBe(true);

  await toAbout(page);
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the greeting" }).toBe(S.dockReturning);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsulePaused);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), GREETED_KEY), "greeted this session").not.toBeNull();

  // A second load in the same session: no label at all.
  await page.goto(`${HOME}#about`);
  await settled(page);
  await dockLanded(page);
  await startDock(page);
  await page.waitForTimeout(1000);
  const texts = new Set((await stopDock(page)).map((s) => s.text));
  expect([...texts], "the pill's text through a second after landing").toEqual([S.capsulePaused]);
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

  await toAbout(page);
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
  await bandControl(page, "on").click();
  expect(Date.now() - playedAt, "Pause pressed inside the 4s start window").toBeLessThan(4000);
  await expect.poll(() => bandLayerShown(page, "paused"), { message: "Resume shown in the band" }).toBe(true);

  await startDock(page);
  await toAbout(page);
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the label as it lands" }).toBe(S.dockAccepted);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.capsulePaused);
  const texts = new Set((await stopDock(page)).map((s) => s.text));
  expect(texts.has(S.dockFailed), "the failure label at any point").toBe(false);
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(`${S.capsulePaused}. ${S.ariaOpen}`);
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
  await bandControl(page, "before").click();
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

test("dock: a deep load at #about fades the pill in at its dock without moving", async ({ page }) => {
  await armDock(page, { fromLoad: true });
  await page.goto(`${HOME}#about`);
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
  await startDock(page, 16);
  await bandBottomAt(page, DOCK.passedPx - 12);
  await page.waitForTimeout(DOCK.fadeMs / 2);
  await bandBottomAt(page, DOCK.passedPx + 12);
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
  expect(bottom, "the band's bottom edge exactly on the dock line").toBe(DOCK.passedPx);
  await bandBottomAt(page, DOCK.passedPx + 200);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "", { timeout: DOCK.fadeMs + 2000 });
});

// Letting a frozen, declined wave move again leaves the toggle with nothing to
// do, but the keyboard is on it: it stays live until focus leaves.
test("band: pressing \"Let the wave move\" from the keyboard after a decline keeps focus on the toggle", async ({ page }) => {
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const band = page.locator("#listen");
  await band.getByRole("button", { name: L.freeze, exact: true }).click();
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  const toggle = band.getByRole("button", { name: L.unfreeze, exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  // Chromium drops focus from an inert element at its next style update, not at once.
  await nextFrames(page, 3);
  expect(await page.evaluate(() => document.activeElement !== document.body), "focus left on the body").toBe(true);
  await expect(band.getByRole("button", { name: L.freeze, exact: true })).toBeFocused();
});

// Reduced motion makes every anchor jump instant, so the reader can cross the
// band in one step, with no frame where it shows: the dock must still follow.
test("dock: under reduced motion an instant jump past the band lands the pill, and a jump back above it hides it", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await armDock(page);
  await page.goto(HOME);
  await settled(page);
  const pill = page.locator(PILL);
  await expect(pill).toHaveAttribute("inert", "");
  await page.evaluate(() => {
    const top = document.getElementById("about")!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: "instant" });
  });
  await dockLanded(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(pill).toHaveAttribute("inert", "");
  await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-pill]")!.style.opacity === "0");
});

// Each width change crosses a gsap.matchMedia query, and its ScrollTrigger
// refresh parks the window at 0 to measure. Two frames after each resize the
// refresh has run, and the reader must still be where they were.
test("dock: a phone width removes the pill and desktop fades it back in", async ({ page }) => {
  await armDock(page);
  await page.goto(`${HOME}#about`);
  await settled(page);
  await dockLanded(page);
  const place = await page.evaluate(() => window.scrollY);
  await page.setViewportSize({ width: 375, height: 812 });
  await nextFrames(page, 2);
  expect(await page.evaluate(() => window.scrollY), "scroll after the phone width's refresh").toBe(place);
  await expect(page.locator(PILL)).toHaveCount(0);
  // Still past the band: the resize's refresh re-derives "passed" with no scroll.
  await startDock(page, 16);
  await page.setViewportSize({ width: 1440, height: 900 });
  await nextFrames(page, 2);
  expect(await page.evaluate(() => window.scrollY), "scroll after the desktop width's refresh").toBe(place);
  await nextFrames(page, 45);
  expect(await page.evaluate(() => window.scrollY), "no glide after the refresh").toBe(place);
  await dockLanded(page);
  const samples = (await stopDock(page)).filter((s) => s.shown);
  expect(samples.some((s) => s.opacity > 0 && s.opacity < 1), "a fade back in").toBe(true);
  expect(Math.abs((await dockGeometry(page)).left - DOCK.insetPx)).toBeLessThanOrEqual(2);
});

test("dock: the freeze toggle lives in the player card once music is on, and stops the band", async ({ page }) => {
  await instrument(page);
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const bandFreeze = page.locator("#listen").getByRole("button", { name: L.freeze, exact: true });
  await expect(bandFreeze).toBeVisible();
  await bandControl(page, "before").click();
  await expect(bandFreeze).toBeHidden();
  const card = page.getByRole("group", { name: S.ariaOpen });
  const toggleInCard = async (name: string) => {
    await toAbout(page);
    await dockLanded(page);
    if ((await card.getAttribute("inert")) !== null) await page.locator(CAPSULE).click();
    await card.getByRole("button", { name, exact: true }).click();
  };
  await toggleInCard(L.freeze);
  await scrollBandIntoView(page);
  await page.waitForTimeout(300);
  expect(await bandRepaints(page, 1000), "band repaints in a frozen second").toBe(0);
  await toggleInCard(L.unfreeze);
  await scrollBandIntoView(page);
  await expect.poll(() => bandRepaints(page, 1000), { message: "band repaints once the wave moves" }).toBeGreaterThan(0);
});

for (const theme of ["light", "dark"] as const) {
  test(`dock: the capsule rests on the wave's baseline at the bottom left in ${theme}`, async ({ page }) => {
    await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), { key: THEME_STORAGE_KEY, theme });
    await armDock(page);
    await page.goto(`${HOME}#about`);
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
  await toAbout(page);
  await expect.poll(() => dockText(page), { timeout: 1000 }).toBe(S.dockDeclined);
  await expect.poll(() => dockText(page), { timeout: 4000 }).toBe(S.capsuleOff);

  await parkBand(page);
  await expect(page.locator(PILL)).toHaveAttribute("inert", "");
  await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-pill]")!.style.opacity === "0");

  await startDock(page);
  await toAbout(page);
  await dockLanded(page);
  await page.waitForTimeout(1000);
  const texts = new Set((await stopDock(page)).filter((s) => !s.inert).map((s) => s.text));
  expect([...texts], "the pill's text on the second trip").toEqual([S.capsuleOff]);
});

test("dock: the label holds about 2.6s, and a mouse click on the capsule does not pin the next one", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await page.mouse.move(4, 4);

  await startDock(page);
  await toAbout(page);
  await expect
    .poll(async () => (await peekDock(page)).some((s) => s.text === S.capsuleOff), {
      timeout: 4000,
      intervals: [50],
      message: "a recorded sample with the capsule's text",
    })
    .toBe(true);
  const samples = await stopDock(page);
  const landed = samples.find((s) => !s.inert && s.shown && !s.transform && s.opacity === 1);
  const collapsed = samples.find((s) => landed && s.t > landed.t && s.text === S.capsuleOff);
  expect(landed && collapsed, "a landing and a collapse").toBeTruthy();
  expect(landed!.text).toBe(S.dockDeclined);
  const hold = collapsed!.t - landed!.t;
  expect(hold, "the hold, ms").toBeGreaterThan(2450);
  expect(hold).toBeLessThan(2850);

  // A press on the declined capsule plays; the accepted label opens with the
  // pointer on it. The click focused the capsule, but a mouse focus is not
  // keyboard focus: once the pointer leaves, the label collapses.
  const capsule = page.locator(CAPSULE);
  await capsule.click();
  await expect.poll(() => dockText(page), { timeout: 1000 }).toBe(S.dockAccepted);
  expect(await capsule.evaluate((el) => document.activeElement === el && !el.matches(":focus-visible")), "mouse focus on the capsule").toBe(true);
  await page.mouse.move(4, 4);
  await expect.poll(() => dockText(page), { timeout: 3500, message: "collapsed after the pointer left" }).toBe(S.tracks[0].title);
});

test("dock: hovering the pill holds its label; leaving lets it collapse", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
  await toAbout(page);
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
  await bandControl(page, "before").click();
  await startDock(page);
  await toAbout(page);
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

test("dock: a phone has no pill, and after \"Not now\" the band offers Play it again", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(HOME);
  await settled(page);
  await expect(page.locator(PILL)).toHaveCount(0);
  const band = page.locator("#listen");
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  const note = band.locator("[data-band-note] > :not([inert])");
  await expect(note).toContainText(L.declinedNote);
  const again = note.getByRole("button", { name: L.accept, exact: true });
  await expect(again).toBeVisible();
  await toAbout(page);
  await expect(page.locator(PILL)).toHaveCount(0);
  await again.click();
  await expect.poll(() => bandLayerShown(page, "on"), { message: "Pause shown in the band" }).toBe(true);
});

test("dock: a live reduced-motion toggle leaves the docked pill where it is", async ({ page }) => {
  await armDock(page);
  await page.goto(`${HOME}#about`);
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
      expect(near(s, rest), "the box held still").toBeLessThanOrEqual(0.5);
    }
  }
});
