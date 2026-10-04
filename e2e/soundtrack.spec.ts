import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { HORIZON } from "@/lib/waveform/layout";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { AVOID_BLOCKS, hasProbe, parkBand, sweep } from "./support/wave";

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
      __e2eMedia: () => media.map((el) => ({ paused: el.paused, time: el.currentTime, src: el.currentSrc })),
    });
  });
}

const bandPaints = (page: Page) => page.evaluate(() => (window as unknown as { __e2eBandPaints: () => number }).__e2eBandPaints());
type MediaRead = { paused: boolean; time: number; src: string };
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
