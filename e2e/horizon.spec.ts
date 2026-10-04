import type { Page } from "@playwright/test";
import { DUCK, DUCK_ALPHA } from "@/lib/waveform/duck";
import { HORIZON } from "@/lib/waveform/layout";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToY, nextFrames } from "./support/coil";
import { settled } from "./support/fallback";
import {
  AVOID_BLOCKS,
  documentTop,
  duckReport,
  horizonPaints,
  paintsOver,
  paintedColumns,
  parkBand,
  sweep,
  sweepTriggers,
} from "./support/wave";

// The horizon strip: the wave leaves the band as the reader scrolls on and
// follows along the bottom of the viewport, behind every section, ducking
// under text (docs/waveform-follows-spec.md, sections 3, 4 and 8). Read
// through the ?wavedebug probe; the query always precedes a hash.

const HOME = "/?wavedebug";
const STRIP = '[data-wave="horizon"]';
// The duck's attack is about 60ms; the brief's settle window after a scroll.
const SETTLE_MS = 150;

// Waits until the eased sweep has stopped moving (it lands on its target exactly).
async function sweepAtRest(page: Page) {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const now = await sweep(page);
        const still = now === last;
        last = now;
        return still;
      },
      { intervals: [100], message: "the sweep at rest" },
    )
    .toBe(true);
  return last;
}

// Scrolls so the element's box bottom sits at viewport y `at` (clamped to the page).
async function placeBottom(page: Page, selector: string, index: number, at: number) {
  const y = await page.evaluate(
    ({ selector, index, at }) => {
      const r = document.querySelectorAll(selector)[index].getBoundingClientRect();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.max(0, Math.min(max, r.bottom + window.scrollY - at));
    },
    { selector, index, at },
  );
  await scrollToY(page, Math.round(y));
}

const avoidCount = (page: Page, selector: string) => page.locator(selector).count();

async function expectBlocksDucked(page: Page, ceiling: number) {
  const vh = page.viewportSize()!.height;
  for (const block of AVOID_BLOCKS) {
    const selector = `${block} [data-wave-avoid]`;
    const count = await avoidCount(page, selector);
    expect(count, `avoid boxes in ${block}`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      // The bottom on the strip's baseline, well inside it.
      await placeBottom(page, selector, i, vh - HORIZON.lift);
      await page.waitForTimeout(SETTLE_MS);
      const report = await duckReport(page, selector, i, ceiling);
      expect(report.overStrip, `${selector} #${i} over the strip`).toBe(true);
      expect(report.under, `${selector} #${i} columns under its words`).toBeGreaterThan(0);
      expect(report.loud, `${selector} #${i} columns painting loud under its words`).toEqual([]);
    }
  }
}

test("horizon: the sweep follows scroll, out to the strip and back", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  expect(await sweepAtRest(page)).toBeLessThan(0.05);
  expect(await paintsOver(page, 500), "horizon repaints with the wave in the band").toBe(0);

  await page.locator("#listen").getByRole("button", { name: "Play it" }).click();

  // Three positions through the trigger's range (band centre from 60 percent of the viewport to its bottom at 15).
  const readings: number[] = [];
  for (const at of [0.45, 0.3, 0.15]) {
    await parkBand(page, at);
    readings.push(await sweepAtRest(page));
  }
  expect(readings[0]).toBeGreaterThan(0.05);
  expect(readings[1]).toBeGreaterThan(readings[0]);
  expect(readings[2]).toBeGreaterThan(readings[1]);
  expect(readings[2]).toBeLessThan(0.95);

  await scrollToY(page, Math.round((await documentTop(page, "#about")) + 200));
  await expect.poll(() => sweep(page), { message: "sweep past the band" }).toBeGreaterThan(0.99);
  expect(await paintsOver(page, 1000), "horizon repaints in a second with the music on").toBeGreaterThan(10);

  await parkBand(page);
  await expect.poll(() => sweep(page), { message: "sweep back in the band" }).toBeLessThan(0.05);
  // Once the train is home the strip clears and stops: a whole second with no repaint.
  await expect
    .poll(() => paintsOver(page, 1000), { timeout: 10_000, intervals: [0], message: "horizon repaints in a quiet second" })
    .toBe(0);
});

test("horizon: a jump past the band lands the train on the strip within 1.5s", async ({ page }) => {
  await openHome(page, { path: HOME });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await horizonPaints(page)).toBe(0);
  const aboutTop = await documentTop(page, "#about");
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), Math.round(aboutTop));
  await expect
    .poll(async () => (await sweep(page)) > 0.99 && (await horizonPaints(page)) > 0, {
      timeout: 1500,
      intervals: [50],
      message: "sweep over 0.99 and the strip painting",
    })
    .toBe(true);
});

test("horizon: a deep load past the band starts at 1, with no layout shift", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: { value: number; t: number }[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) shifts.push({ value: entry.value, t: entry.startTime });
      }
    }).observe({ type: "layout-shift", buffered: true });
    // The sweep at the first frame the strip is attached to the probe, and the scroll then.
    const first: { sweep: number; y: number }[] = [];
    const watch = () => {
      const probe = (window as Window & { __waveProbe?: { sweep: () => number; strip: () => unknown } }).__waveProbe;
      if (probe?.strip()) first.push({ sweep: probe.sweep(), y: window.scrollY });
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    Object.assign(window, { __e2eShifts: shifts, __e2eFirstSweep: first });
  });
  await page.goto(`${HOME}#about`);
  await page.waitForFunction(() => document.documentElement.dataset.home === "ready");
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const shifts = (window as unknown as { __e2eShifts: { t: number }[] }).__e2eShifts;
    const last = shifts.length ? shifts[shifts.length - 1].t : 0;
    return performance.now() - last > 1000;
  });
  const first = await page.evaluate(() => (window as unknown as { __e2eFirstSweep: { sweep: number; y: number }[] }).__e2eFirstSweep);
  expect(first, "a first sweep read").toHaveLength(1);
  expect(first[0].y, "already at #about").toBeGreaterThan(0);
  expect(first[0].sweep, "the first sweep read").toBeGreaterThan(0.99);
  const cls = await page.evaluate(() =>
    (window as unknown as { __e2eShifts: { value: number }[] }).__e2eShifts.reduce((sum, shift) => sum + shift.value, 0),
  );
  expect(cls).toBeLessThan(0.05);
  expect(await page.evaluate(() => document.getElementById("about")!.getBoundingClientRect().top)).toBeLessThan(200);
});

for (const theme of ["light", "dark"] as const) {
  test(`horizon: readability in ${theme}, every column under words is ducked under the ceiling`, async ({ page }) => {
    await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), { key: THEME_STORAGE_KEY, theme });
    await openHome(page, { path: HOME });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await scrollToY(page, Math.round(await documentTop(page, "#about")));
    await expect.poll(() => sweep(page)).toBeGreaterThan(0.99);
    await expectBlocksDucked(page, DUCK_ALPHA[theme]);
  });
}

// The last right-column item of Up to now sits 48px low (md:translate-y-12)
// and drifts with its parallax, so its words reach past the list's own box;
// the list pads its avoid box for them (data-wave-avoid-pad).
test("horizon: Up to now's last right-column item is ducked while its words cross the strip", async ({ page }) => {
  await openHome(page, { path: HOME });
  const items = page.locator("#up-to-now ol > li");
  const count = await items.count();
  const last = count % 2 === 0 ? count - 1 : count - 2;
  const selector = "#up-to-now ol > li";
  await scrollToY(page, Math.round(await documentTop(page, "#up-to-now")));
  await expect.poll(() => sweep(page)).toBeGreaterThan(0.99);
  const vh = page.viewportSize()!.height;
  // From the words just entering the strip's top to their bottom on its floor.
  for (const into of [8, 24, 48, HORIZON.height - HORIZON.lift, HORIZON.height - 8]) {
    const wordsBottom = vh - HORIZON.height + into;
    // The words' own bottom, as painted (translate and parallax included), at wordsBottom.
    for (let attempt = 0; attempt < 3; attempt++) {
      const delta = await page.evaluate(
        ({ selector, last, wordsBottom }) => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelectorAll(selector)[last]);
          return range.getBoundingClientRect().bottom - wordsBottom;
        },
        { selector, last, wordsBottom },
      );
      if (Math.abs(delta) < 1) break;
      await scrollToY(page, Math.round((await page.evaluate(() => window.scrollY)) + delta));
      // The parallax is scrubbed (0.5s): let it catch up before measuring again.
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(SETTLE_MS);
    // The list's own avoid box covers the item's words with the default pad to
    // spare, so the duck does not lean on Connect's look-ahead below it.
    const cover = await page.evaluate(
      ({ selector, last }) => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelectorAll(selector)[last]);
        const words = range.getBoundingClientRect().bottom + window.scrollY;
        const ol = document.querySelector("#up-to-now ol")!.getBoundingClientRect();
        const olTop = ol.top + window.scrollY;
        const olBottom = ol.bottom + window.scrollY;
        const boxes = window.__waveProbe!.rects().filter((r) => r.top <= olTop && r.bottom >= olBottom);
        return { words, boxes: boxes.length, bottom: boxes.length === 1 ? boxes[0].bottom : Number.NaN };
      },
      { selector, last },
    );
    expect(cover.boxes, "one avoid box spans the list").toBe(1);
    expect(cover.bottom, `the list's avoid box bottom against the words, ${into}px into the strip`).toBeGreaterThanOrEqual(
      cover.words + DUCK.padPx,
    );
    const report = await duckReport(page, selector, last, DUCK_ALPHA.light);
    expect(report.overStrip, `words ${into}px into the strip`).toBe(true);
    expect(report.under).toBeGreaterThan(0);
    expect(report.loud, `columns painting loud under the last item, words ${into}px into the strip`).toEqual([]);
  }
});

test("horizon: a fast flick lands with the text over the strip already ducked", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  await page.mouse.move(720, 300);
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(8);
  }
  await page.waitForTimeout(SETTLE_MS);
  const reports = await page.evaluate(() => {
    const strip = document.querySelector('[data-wave="horizon"]')!.getBoundingClientRect();
    return [...document.querySelectorAll("main [data-wave-avoid], footer [data-wave-avoid]")]
      .map((el, index) => ({ index, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.top < strip.bottom && r.bottom > strip.top)
      .map(({ index }) => index);
  });
  expect(reports.length, "text boxes over the strip after the flick").toBeGreaterThan(0);
  let checked = 0;
  for (const index of reports) {
    const report = await duckReport(page, "main [data-wave-avoid], footer [data-wave-avoid]", index, DUCK_ALPHA.light);
    if (!report.overStrip) continue; // the box reaches the strip, its words do not
    checked++;
    expect(report.under).toBeGreaterThan(0);
    expect(report.loud, `avoid box ${index} after the flick`).toEqual([]);
  }
  expect(checked, "words over the strip after the flick").toBeGreaterThan(0);
});

test("horizon: the strip sits behind the text and takes no pointer", async ({ page }) => {
  await openHome(page, { path: HOME });
  const vh = page.viewportSize()!.height;
  await placeBottom(page, "#about p[data-wave-avoid]", 0, vh - HORIZON.lift);
  // The band is still in the trigger's range here: the train is part way over, and the strip paints.
  await expect.poll(() => paintedColumns(page), { message: "columns painted on the strip" }).toBeGreaterThan(0);
  const layer = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-wave="horizon"]')!;
    const canvas = host.querySelector("canvas")!;
    const lede = document.querySelector("#about p[data-wave-avoid]")!;
    const r = lede.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const strip = host.getBoundingClientRect();
    return {
      zIndex: getComputedStyle(host).zIndex,
      position: getComputedStyle(host).position,
      hostEvents: getComputedStyle(host).pointerEvents,
      canvasEvents: getComputedStyle(canvas).pointerEvents,
      overStrip: r.top < strip.bottom && r.bottom > strip.top,
      hitIsText: !!hit && lede.contains(hit),
    };
  });
  expect(layer).toEqual({
    zIndex: "0",
    position: "fixed",
    hostEvents: "none",
    canvasEvents: "none",
    overStrip: true,
    hitIsText: true,
  });
});

test("horizon: reduced motion shows the still strip past the band and never loops", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(HOME);
  await settled(page);
  await scrollToY(page, Math.round(await documentTop(page, "#about")));
  await expect.poll(() => page.locator(STRIP).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  expect(await sweep(page)).toBe(1);
  expect(await paintsOver(page, 1000), "horizon repaints in a second at rest").toBeLessThanOrEqual(1);
});

test("horizon: a live reduced-motion toggle keeps exactly one sweep trigger", async ({ page }) => {
  await openHome(page, { path: HOME });
  expect(await sweepTriggers(page)).toBe(1);
  for (let round = 0; round < 2; round++) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => page.locator("section[data-scene]").getAttribute("data-scene")).toBe("off");
    await nextFrames(page, 2);
    expect(await sweepTriggers(page), `triggers under reduce, round ${round + 1}`).toBe(1);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(() => page.locator("section[data-scene]").getAttribute("data-scene")).toBe("on");
    await nextFrames(page, 2);
    expect(await sweepTriggers(page), `triggers with motion, round ${round + 1}`).toBe(1);
  }
});

test("horizon: a phone has no strip and keeps the band's controls", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(HOME);
  await settled(page);
  await scrollToY(page, Math.round(await documentTop(page, "#about")));
  await expect(page.locator(STRIP)).toHaveCount(0);
  // Nothing on a phone touches the probe (no strip, no trigger), so it is never created.
  expect(await page.evaluate(() => window.__waveProbe?.triggers() ?? 0), "sweep triggers on a phone").toBe(0);
  const band = page.locator("#listen");
  await expect(band.getByRole("button", { name: "Play it" })).toBeAttached();
  await expect(band.getByRole("button", { name: "Maybe later" })).toBeAttached();
});
