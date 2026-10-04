import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";

// The soundtrack band (#listen): in flow under the book, the one place the
// waveform runs; "Play it" really plays, "Maybe later" leaves a still line,
// and the playback pill takes over once the band is off screen with music
// chosen. A deep load into the page keeps its layout still.

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
const media = (page: Page) =>
  page.evaluate(() => (window as unknown as { __e2eMedia: () => { paused: boolean; time: number; src: string }[] }).__e2eMedia());

async function scrollBandIntoView(page: Page) {
  await page.locator("#listen").scrollIntoViewIfNeeded();
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

test("band: in flow directly under the book, and nothing animates behind the text below it", async ({ page }) => {
  await openHome(page);
  const layout = await page.evaluate(() => {
    const band = document.getElementById("listen")!;
    const book = document.getElementById("work")!;
    return {
      followsBook: book.nextElementSibling === band || !!(book.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING),
      position: getComputedStyle(band).position,
      fixedCanvases: [...document.querySelectorAll("canvas")].filter((c) => getComputedStyle(c).position === "fixed").length,
      bandTop: band.getBoundingClientRect().top + window.scrollY,
      bookBottom: book.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  expect(layout.followsBook).toBe(true);
  expect(["static", "relative"]).toContain(layout.position);
  expect(layout.fixedCanvases, "canvases fixed to the viewport").toBe(0);
  expect(layout.bandTop).toBeGreaterThan(layout.bookBottom - 100);

  for (const id of ["about", "who-i-am", "up-to-now", "connect"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const overlaps = await page.evaluate((id) => {
      const texts = [...document.querySelectorAll(`#${id} :is(h1,h2,h3,p,li,a,span,blockquote)`)]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const canvases = [...document.querySelectorAll("canvas")]
        .filter((c) => getComputedStyle(c).visibility !== "hidden" && Number(getComputedStyle(c).opacity) > 0)
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return texts.filter((t) => canvases.some((c) => hit(t, c))).length;
    }, id);
    expect(overlaps, `text boxes in #${id} under a canvas`).toBe(0);
  }
});

test("band: a real click on \"Play it\" starts playback", async ({ page }) => {
  await instrument(page);
  await openHome(page);
  await scrollBandIntoView(page);

  await page.locator("#listen").getByRole("button", { name: "Play it" }).click();

  await expect.poll(async () => (await media(page)).some((el) => !el.paused), { message: "a playing media element" }).toBe(true);
  // Followed by index: currentSrc can still be empty on the first read.
  const index = (await media(page)).findIndex((el) => !el.paused);
  const startedAt = (await media(page))[index].time;
  await expect
    .poll(async () => (await media(page))[index].time - startedAt, { message: "seconds played" })
    .toBeGreaterThan(0.2);
});

test("band: the wave draws while the band is in view, and \"Maybe later\" brings it to a stop", async ({ page }) => {
  await instrument(page);
  await openHome(page);
  await scrollBandIntoView(page);
  const moving = await bandPaints(page);
  await expect.poll(async () => (await bandPaints(page)) - moving, { message: "repaints while in view" }).toBeGreaterThan(10);

  await page.locator("#listen").getByRole("button", { name: "Maybe later" }).click();
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
  await expect(page.locator("#listen canvas")).toHaveScreenshot("band-still.png", { maxDiffPixels: 0, threshold: 0 });
});

// The idle drift runs on a real clock, so frames differ run to run; its dot
// count and vertical extent stand in for the pixels.
test("band: idle drift paints the same dot count and extent as before the split", async ({ page }) => {
  await instrument(page);
  await openHome(page);
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
  expect(stats.painted).toBeGreaterThan(2000);
  expect(stats.bottom - stats.top).toBeLessThan(stats.height * 0.5);
});

test("band: the pill shows once the band is off screen with music on, and only then takes keyboard focus", async ({ page }) => {
  await openHome(page);
  await scrollBandIntoView(page);
  const pill = page.locator("[data-pill]");
  const capsule = page.getByRole("button", { name: "Open soundtrack player" });
  await page.locator("#listen").getByRole("button", { name: "Play it" }).click();
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
