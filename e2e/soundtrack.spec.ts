import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { HORIZON } from "@/lib/waveform/layout";
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
  readDock,
  startDock,
  stopDock,
  storedChoice,
  toAbout,
  type DockSample,
} from "./support/dock";
import { AVOID_BLOCKS, hasProbe, paintsOver, parkBand, sweep } from "./support/wave";

// The soundtrack band (#listen): in flow under the book, where the waveform
// starts before it follows the reader onto the horizon strip (horizon.spec.ts);
// "Play it" really plays, "Not now" leaves a still line in the band, and the
// playback pill condenses out of the band onto the wave's line at the bottom
// centre once the reader scrolls on (the dock tests below, spec sections 2
// and 5). A deep load into the page keeps its layout still.

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
type MediaRead = { paused: boolean; time: number; src: string; error: number | null };
const media = (page: Page) => page.evaluate(() => (window as unknown as { __e2eMedia: () => MediaRead[] }).__e2eMedia());

// The band fully in view with its centre at 70 percent of the viewport, below
// the sweep trigger's start (centre at 60 percent): the whole train is still
// in the band, so the band guards below run at sweep 0.
async function scrollBandIntoView(page: Page) {
  await parkBand(page);
  await page.waitForFunction(() => {
    const rect = document.querySelector("#listen")!.getBoundingClientRect();
    return rect.top > 80 && rect.bottom < window.innerHeight;
  });
  if (await hasProbe(page)) await expect.poll(() => sweep(page), { message: "sweep with the band parked" }).toBe(0);
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

// The rule that replaced "no canvas behind text": the one fixed canvas is the
// horizon strip, behind the content (z 0 under 10) with no pointer events, so
// every text box that crosses it still owns the point at its centre.
test("band: in flow directly under the book; the one fixed canvas is the horizon, behind the text", async ({ page }) => {
  await openHome(page, { path: HOME });
  const layout = await page.evaluate(() => {
    const band = document.getElementById("listen")!;
    const book = document.getElementById("work")!;
    const fixedAncestor = (el: Element | null): HTMLElement | null => {
      for (let node = el as HTMLElement | null; node; node = node.parentElement) {
        if (getComputedStyle(node).position === "fixed") return node;
      }
      return null;
    };
    const fixed = [...document.querySelectorAll("canvas")].filter((c) => fixedAncestor(c));
    const strip = fixed[0];
    return {
      followsBook: book.nextElementSibling === band || !!(book.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING),
      position: getComputedStyle(band).position,
      fixedCanvases: fixed.length,
      fixedIsHorizon: !!strip && strip.matches('[data-wave="horizon"] canvas'),
      zIndex: strip ? getComputedStyle(fixedAncestor(strip)!).zIndex : null,
      pointerEvents: strip ? getComputedStyle(strip).pointerEvents : null,
      bandTop: band.getBoundingClientRect().top + window.scrollY,
      bookBottom: book.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  expect(layout.followsBook).toBe(true);
  expect(["static", "relative"]).toContain(layout.position);
  expect(layout.fixedCanvases, "canvases fixed to the viewport").toBe(1);
  expect(layout.fixedIsHorizon, "the fixed canvas is the horizon strip").toBe(true);
  expect(layout.zIndex).toBe("0");
  expect(layout.pointerEvents).toBe("none");
  expect(layout.bandTop).toBeGreaterThan(layout.bookBottom - 100);

  const vh = page.viewportSize()!.height;
  for (const block of AVOID_BLOCKS) {
    const selector = `${block} [data-wave-avoid]`;
    const count = await page.locator(selector).count();
    expect(count, `avoid boxes in ${block}`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      // The box's centre on the strip's baseline (as far as the page scrolls).
      const y = await page.evaluate(
        ({ selector, i, at }) => {
          const r = document.querySelectorAll(selector)[i].getBoundingClientRect();
          const max = document.documentElement.scrollHeight - window.innerHeight;
          return Math.max(0, Math.min(max, r.top + r.height / 2 + window.scrollY - at));
        },
        { selector, i, at: vh - HORIZON.lift },
      );
      await scrollToY(page, Math.round(y));
      const hit = await page.evaluate(
        ({ selector, i }) => {
          const el = document.querySelectorAll(selector)[i];
          const r = el.getBoundingClientRect();
          const host = document.querySelector<HTMLElement>('[data-wave="horizon"]')!;
          const canvas = host.querySelector("canvas")!;
          const strip = host.getBoundingClientRect();
          // elementFromPoint skips pointer-events: none, so the strip is made
          // hit testable for this one read: paint order alone must give the point to the text.
          // The pill docks on the strip at the bottom centre by design (z 45, over
          // the footer row's centre at the foot of the page); it steps aside for the read.
          const pill = document.querySelector<HTMLElement>("[data-pill]");
          host.style.pointerEvents = "auto";
          canvas.style.pointerEvents = "auto";
          if (pill) pill.style.visibility = "hidden";
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          host.style.pointerEvents = "";
          canvas.style.pointerEvents = "";
          if (pill) pill.style.visibility = "";
          return { overStrip: r.top < strip.bottom && r.bottom > strip.top, owned: !!at && el.contains(at) };
        },
        { selector, i },
      );
      expect(hit, `${selector} #${i} over the strip`).toEqual({ overStrip: true, owned: true });
    }
  }
});

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
  // Plain "/": this test never reads the probe; the band is parked by geometry only.
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
// every music state, condensed out of the band onto the wave's line at the
// bottom centre. It lands open with one line for the state, once per page
// load, holds about 2.6s (hover or keyboard focus pauses the hold), then
// collapses to the capsule. Every read goes through the dock recorder
// (support/dock.ts) and every string comes from lib/content.ts.

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// The pill's first arrival after a scroll, from the recorder: the first write
// that carries a transform (the tween's from state) and the 50ms ticks after it.
function arrival(samples: DockSample[], ms = 700) {
  const first = samples.find((s) => s.kind === "write" && s.transform !== "");
  if (!first) return null;
  return { first, ticks: samples.filter((s) => s.kind === "tick" && s.t > first.t && s.t <= first.t + ms) };
}

test("dock: the accept path plays, condenses to the dock, says where the music lives, then shows the track", async ({ page }) => {
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
  await expect(band.locator("[data-band-note] > :not([inert])")).toHaveText(L.acceptedNote);

  await toAbout(page);
  await expect(pill).not.toHaveAttribute("inert", "", { timeout: 1000 });
  await expect.poll(() => dockText(page), { timeout: 1000, message: "the label as it lands" }).toBe(S.dockAccepted);
  await expect.poll(() => dockText(page), { timeout: 4000, message: "the collapsed capsule" }).toBe(S.tracks[0].title);

  await dockLanded(page);
  const at = await dockGeometry(page);
  expect(at.height, "capsule height").toBeGreaterThanOrEqual(36);
  expect(Math.abs(at.x - at.centre), "capsule centre from the viewport's centre").toBeLessThanOrEqual(2);
  expect(Math.abs(at.y - at.baseline), "capsule centre from the horizon's baseline").toBeLessThanOrEqual(4);
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
  // One click is a yes: the capsule's name is the invitation.
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(S.invite);
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
  // One press retries: the capsule's name is the invitation while the start has failed.
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(S.invite);
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
  await expect(page.locator(CAPSULE)).toHaveAccessibleName(S.ariaOpen);
});

test("dock: the first arrival condenses out of the pressed control and travels down to the dock", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await bandControl(page, "before").click();
  await startDock(page);
  // Just past the arrival threshold (sweep target 0.35) with the band on
  // screen: the trigger runs from the band's centre at 60 percent of the
  // viewport to its bottom at 15 percent, so progress 0.4 of that range. The
  // control is measured in the same task, before the threshold is processed.
  const scrolled = await page.evaluate(() => {
    const vh = window.innerHeight;
    const band = document.getElementById("listen")!.getBoundingClientRect();
    const top = band.top + window.scrollY;
    const start = top + band.height / 2 - 0.6 * vh;
    const end = top + band.height - 0.15 * vh;
    window.scrollTo({ top: Math.round(start + 0.4 * (end - start)), behavior: "instant" });
    const r = document.querySelector('#listen [data-control="before"]')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, vh };
  });
  expect(scrolled.y, "the pressed control on screen at the threshold").toBeGreaterThan(0);
  expect(scrolled.y).toBeLessThan(scrolled.vh);
  await dockLanded(page);
  await page.waitForTimeout(200);
  const run = arrival(await stopDock(page));
  expect(run, "an arrival tween").not.toBeNull();
  const { first, ticks } = run!;
  const at = await dockGeometry(page);
  const dock = { x: at.centre, y: at.baseline };

  expect(near(first, scrolled), "the arrival's first box from the pressed control's centre").toBeLessThanOrEqual(40);
  expect(first.opacity, "the arrival's first opacity").toBeLessThan(1);
  expect(ticks.length, "50ms samples over 700ms").toBeGreaterThanOrEqual(12);
  const last = ticks.at(-1)!;
  expect(Math.abs(last.x - dock.x), "the last sample from the dock, x").toBeLessThanOrEqual(4);
  expect(Math.abs(last.y - dock.y), "the last sample from the dock, y").toBeLessThanOrEqual(4);
  // Down all the way: y strictly increases while the tween runs, then holds at rest.
  const path = [first, ...ticks];
  for (let i = 1; i < path.length; i++) {
    if (path[i - 1].transform) expect(path[i].y, `sample ${i} below sample ${i - 1}`).toBeGreaterThan(path[i - 1].y);
    else expect(path[i].y, `sample ${i} at rest`).toBe(path[i - 1].y);
  }
});

test("dock: the freeze toggle lives in the player card once music is on", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  const bandFreeze = page.locator("#listen").getByRole("button", { name: L.freeze, exact: true });
  // Before an answer the band keeps it; with music chosen the card carries it on desktop.
  await expect(bandFreeze).toBeVisible();
  await bandControl(page, "before").click();
  await expect(bandFreeze).toBeHidden();

  await toAbout(page);
  await dockLanded(page);
  await page.locator(CAPSULE).click();
  const card = page.getByRole("group", { name: S.ariaOpen });
  await expect(card).not.toHaveAttribute("inert", "");
  await card.getByRole("button", { name: L.freeze, exact: true }).click();
  await expect(card.getByRole("button", { name: L.unfreeze, exact: true })).toBeVisible();
  await expect
    .poll(() => paintsOver(page, 1000), { timeout: 10_000, intervals: [0], message: "horizon repaints in a frozen second" })
    .toBe(0);

  await card.getByRole("button", { name: L.unfreeze, exact: true }).click();
  await expect.poll(() => paintsOver(page, 1000), { message: "horizon repaints once the wave moves" }).toBeGreaterThan(0);
});

for (const theme of ["light", "dark"] as const) {
  test(`dock: the capsule rests on the wave's baseline at the bottom centre in ${theme}`, async ({ page }) => {
    await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), { key: THEME_STORAGE_KEY, theme });
    await armDock(page);
    await page.goto(`${HOME}#about`);
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await dockLanded(page);
    const at = await dockGeometry(page);
    expect(at.height, "capsule height").toBeGreaterThanOrEqual(36);
    expect(Math.abs(at.x - at.centre), "capsule centre from the viewport's centre").toBeLessThanOrEqual(2);
    expect(Math.abs(at.y - at.baseline), "capsule centre from the horizon's baseline").toBeLessThanOrEqual(4);
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
  await expect.poll(() => dockText(page), { timeout: 4000 }).toBe(S.capsuleOff);
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

test("dock: a deep load at #about rises into place rather than condensing", async ({ page }) => {
  await armDock(page, { fromLoad: true });
  await page.goto(`${HOME}#about`);
  await settled(page);
  await dockLanded(page);
  await page.waitForTimeout(200);
  const run = arrival(await stopDock(page));
  expect(run, "an arrival tween").not.toBeNull();
  const { first, ticks } = run!;
  const rest = (await readDock(page))!;
  // Straight up from below the dock, full size, faded: no travel from the band.
  expect(first.y - rest.y, "the first box below its rest position, px").toBeGreaterThan(4);
  expect(Math.abs(first.x - rest.x), "no sideways travel").toBeLessThanOrEqual(1);
  expect(Math.abs(first.width - rest.width), "no condensing scale").toBeLessThanOrEqual(1);
  expect(first.opacity, "the first opacity").toBeLessThan(1);
  const last = ticks.at(-1)!;
  expect(last.transform, "at rest").toBe("");
  expect(last.opacity).toBe(1);
  expect(Math.abs(last.y - rest.y)).toBeLessThanOrEqual(0.5);
});

test("dock: scrolling back above the threshold returns the pill into the band's controls", async ({ page }) => {
  await armDock(page);
  await openHome(page, { path: HOME });
  await scrollBandIntoView(page);
  await bandControl(page, "before").click();
  await toAbout(page);
  await dockLanded(page);
  const docked = (await readDock(page))!;

  await startDock(page);
  await parkBand(page);
  const pill = page.locator(PILL);
  await expect(pill).toHaveAttribute("inert", "");
  await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-pill]")!.style.opacity === "0");
  const samples = await stopDock(page);
  const into = await page.evaluate(() => {
    const r = document.querySelector("[data-band-controls] > :not([inert])")!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  // The return tween: up and toward the visible control, fading as it goes.
  const moving = samples.filter((s) => s.kind === "write" && s.transform !== "");
  expect(moving.length, "frames of the return").toBeGreaterThan(3);
  for (let i = 1; i < moving.length; i++) {
    expect(moving[i].y, `return frame ${i} no lower`).toBeLessThanOrEqual(moving[i - 1].y);
    expect(near(moving[i], into), `return frame ${i} no farther from the controls`).toBeLessThanOrEqual(near(moving[i - 1], into) + 0.01);
  }
  expect(near(moving.at(-1)!, into), "the last frame's distance to the controls").toBeLessThan(near(docked, into) * 0.5);
  expect(moving.at(-1)!.opacity).toBeLessThan(moving[0].opacity);

  // The controls come back: full opacity, clickable, reachable.
  const controls = page.locator("#listen [data-band-controls]");
  await expect.poll(() => controls.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  expect(await controls.evaluate((el) => getComputedStyle(el).pointerEvents)).not.toBe("none");
  expect(await bandLayerShown(page, "on"), "Pause not inert").toBe(true);
  await expect(bandControl(page, "on")).toBeVisible();
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
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await startDock(page);
    await page.emulateMedia({ reducedMotion });
    await page.waitForFunction((reduce) => window.matchMedia("(prefers-reduced-motion: reduce)").matches === reduce, reducedMotion === "reduce");
    await page.waitForTimeout(700);
    const samples = await stopDock(page);
    expect(samples.length, `samples across the toggle to ${reducedMotion}`).toBeGreaterThanOrEqual(14);
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
  await expect.poll(() => sweep(page)).toBeGreaterThan(0.99);
});
