import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { DUCK, DUCK_ALPHA, DUCK_SPLIT } from "@/lib/waveform/duck";
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
  scrollHeld,
  stripPixelsUnder,
  sweep,
  sweepTriggers,
  sweepTriggersCreated,
  themeOf,
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

// The About block sits just under the band: its words cross the strip while
// the train is still arriving from the right, so at rest no column may reach
// them yet (only the eased sweep's lag, after a scroll back up, brings columns
// under them). A later block's box may read as ahead only while the train is
// measurably still arriving (Who I am's kicker, left of the leading column at
// 1440 by 900), and every later block has at least one box actually read.
const AHEAD_ALLOWED = new Set<string>(["#about"]);

async function expectBlocksDucked(page: Page, ceiling: number) {
  const vh = page.viewportSize()!.height;
  for (const block of AVOID_BLOCKS) {
    const selector = `${block} [data-wave-avoid]`;
    const count = await avoidCount(page, selector);
    expect(count, `avoid boxes in ${block}`).toBeGreaterThan(0);
    let read = 0;
    for (let i = 0; i < count; i++) {
      // The bottom on the strip's baseline, well inside it.
      await placeBottom(page, selector, i, vh - HORIZON.lift);
      await page.waitForTimeout(SETTLE_MS);
      const report = await duckReport(page, selector, i, ceiling);
      expect(report.overStrip, `${selector} #${i} over the strip`).toBe(true);
      if (report.under === 0) {
        if (!AHEAD_ALLOWED.has(block)) {
          expect(await sweep(page), `${selector} #${i} has no columns under its words with the train all on the strip`).toBeLessThan(0.99);
        }
        expect(report.ahead, `${selector} #${i} no columns under its words, and the train not yet there`).toBe(true);
        continue;
      }
      read += 1;
      expect(report.loud, `${selector} #${i} columns painting loud under its words`).toEqual([]);
    }
    if (!AHEAD_ALLOWED.has(block)) expect(read, `boxes in ${block} with columns under their words`).toBeGreaterThan(0);
  }
}

test("horizon: the sweep follows scroll, out to the strip and back", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  expect(await sweepAtRest(page)).toBeLessThan(0.05);
  expect(await paintsOver(page, 500), "horizon repaints with the wave in the band").toBe(0);

  await page.locator("#listen").getByRole("button", { name: siteContent.listen.accept, exact: true }).click();

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
  expect(await paintsOver(page, 1000), "horizon repaints in the next second").toBe(0);
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

    // The canvas itself, under the About heading's words: no pixel carries more
    // alpha than the ceiling. One ducked dot's full coverage is
    // round(DUCK_ALPHA * 255); the 2 levels of tolerance cover the 8-bit
    // rounding of the premultiplied store and antialiased edges where two
    // dots of one fill meet.
    const vh = page.viewportSize()!.height;
    await placeBottom(page, "#about h2[data-wave-avoid]", 0, vh - HORIZON.lift);
    await page.waitForTimeout(SETTLE_MS);
    const pixels = await stripPixelsUnder(page, "#about h2[data-wave-avoid]", 0);
    expect(pixels.painted, "dots painted under the heading").toBeGreaterThan(0);
    expect(pixels.max, "the strongest alpha under the heading (0 to 255)").toBeLessThanOrEqual(Math.round(DUCK_ALPHA[theme] * 255) + 2);
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
  const theme = await themeOf(page);
  await scrollToY(page, Math.round(await documentTop(page, "#up-to-now")));
  await expect.poll(() => sweep(page)).toBeGreaterThan(0.99);
  const vh = page.viewportSize()!.height;
  // From the words just entering the strip's top to their bottom on its floor.
  for (const into of [8, 24, 48, HORIZON.height - HORIZON.lift, HORIZON.height - 8]) {
    const wordsBottom = vh - HORIZON.height + into;
    // The words' own bottom, as painted (translate and parallax included), at
    // wordsBottom. The parallax is scrubbed, so each correction waits for the
    // item's layer transform to read the same twice before measuring again.
    const depth = () =>
      page.evaluate(
        ({ selector, last, wordsBottom }) => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelectorAll(selector)[last]);
          return range.getBoundingClientRect().bottom - wordsBottom;
        },
        { selector, last, wordsBottom },
      );
    const layerHeld = async () => {
      let previous: string | null = null;
      await expect
        .poll(
          async () => {
            const now = await page.evaluate(
              ({ selector, last }) => (document.querySelectorAll(selector)[last].firstElementChild as HTMLElement).style.transform,
              { selector, last },
            );
            const held = now === previous;
            previous = now;
            return held;
          },
          { intervals: [100], message: "the parallax layer at rest" },
        )
        .toBe(true);
    };
    await layerHeld();
    for (let attempt = 0; attempt < 4; attempt++) {
      const delta = await depth();
      if (Math.abs(delta) < 1) break;
      await scrollToY(page, Math.round((await page.evaluate(() => window.scrollY)) + delta));
      await layerHeld();
    }
    expect(Math.abs(await depth()), `the words' bottom ${into}px into the strip`).toBeLessThan(1);
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
    const report = await duckReport(page, selector, last, DUCK_ALPHA[theme]);
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
  await scrollHeld(page);
  await page.waitForTimeout(SETTLE_MS);
  const theme = await themeOf(page);
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
    const report = await duckReport(page, "main [data-wave-avoid], footer [data-wave-avoid]", index, DUCK_ALPHA[theme]);
    if (!report.overStrip) continue; // the box reaches the strip, its words do not
    checked++;
    expect(report.under).toBeGreaterThan(0);
    expect(report.loud, `avoid box ${index} after the flick`).toEqual([]);
  }
  expect(checked, "words over the strip after the flick").toBeGreaterThan(0);
});

// Every on-screen column ducked past DUCK_SPLIT that lies under no avoid box
// crossing the strip itself (the open air a look-ahead would hide).
async function strayDucks(page: Page) {
  return page.evaluate((split) => {
    const probe = window.__waveProbe!;
    const strip = probe.strip()!;
    const top = strip.top + window.scrollY;
    const bottom = strip.bottom + window.scrollY;
    const width = document.documentElement.clientWidth;
    const crossing = probe.rects().filter((r) => r.top < bottom && r.bottom > top);
    const onScreen = probe.columns().filter((c) => c.x >= 0 && c.x <= width);
    const stray = onScreen.filter((c) => c.duck > split && !crossing.some((r) => r.left <= c.x && c.x <= r.right));
    return { onScreen: onScreen.length, stray };
  }, DUCK_SPLIT);
}

// The look-ahead is for flicks (it scales with the downward scroll speed), so
// at rest text parked just below the viewport ducks nothing: every ducked
// column lies under an avoid box that crosses the strip itself, and the open
// air beside the words keeps its wave.
test("horizon: at rest only text over the strip ducks", async ({ page }) => {
  await openHome(page, { path: HOME });
  const vh = page.viewportSize()!.height;
  await placeBottom(page, "#about p[data-wave-avoid]", 0, vh - HORIZON.lift);
  await sweepAtRest(page);
  await expect.poll(() => paintedColumns(page), { message: "columns painted on the strip" }).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  const read = await page.evaluate((split) => {
    const strip = window.__waveProbe!.strip()!;
    const width = document.documentElement.clientWidth;
    const crossing = window.__waveProbe!.rects().filter((r) => r.top < strip.bottom + window.scrollY && r.bottom > strip.top + window.scrollY);
    const onScreen = window.__waveProbe!.columns().filter((c) => c.x >= 0 && c.x <= width);
    return { crossing: crossing.length, onScreen: onScreen.length, ducked: onScreen.filter((c) => c.duck > split).length };
  }, DUCK_SPLIT);
  expect(read.crossing, "avoid boxes crossing the strip").toBeGreaterThan(0);
  expect(read.onScreen, "columns on screen").toBeGreaterThan(0);
  expect((await strayDucks(page)).stray, "ducked columns under no box that crosses the strip").toEqual([]);
  expect(read.ducked, "on-screen columns not ducked").toBeLessThan(read.onScreen);
});

// A gap in painting is not a flick: frozen, the strip stops painting, and a
// scroll made then is not read as speed on the unfreeze, so the open air
// beside About's lede keeps its wave rather than ducking for Who I am below.
test("horizon: a scroll made while frozen does not read as a flick on unfreeze", async ({ page }) => {
  await openHome(page, { path: HOME });
  const vh = page.viewportSize()!.height;
  await placeBottom(page, "#about p[data-wave-avoid]", 0, vh - HORIZON.lift);
  await sweepAtRest(page);
  await page.waitForTimeout(1000);
  const band = page.locator("#listen");
  await band.getByRole("button", { name: siteContent.listen.freeze, exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollBy({ top: 100, behavior: "instant" }));
  await page.waitForTimeout(300);
  await band.getByRole("button", { name: siteContent.listen.unfreeze, exact: true }).click();
  await page.waitForTimeout(150);
  const read = await strayDucks(page);
  expect(read.onScreen, "columns on screen").toBeGreaterThan(0);
  expect(read.stray, "ducked columns under no box that crosses the strip").toEqual([]);
});

// Just past the trigger and back above the band within a second: once the
// train is home the horizon neither paints nor keeps the loop awake.
test("horizon: back above the band, the strip stops painting and lets the loop sleep", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  expect(await sweepAtRest(page)).toBeLessThan(0.05);
  await page.mouse.move(720, 300);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(30);
  }
  await expect.poll(() => horizonPaints(page), { timeout: 1000, message: "the strip painting past the trigger" }).toBeGreaterThan(0);
  expect(await sweep(page)).toBeGreaterThan(0);
  await parkBand(page);
  await expect.poll(() => sweep(page), { message: "the train back in the band" }).toBe(0);
  await expect
    .poll(() => paintsOver(page, 1000), { timeout: 10_000, intervals: [0], message: "horizon repaints in a quiet second" })
    .toBe(0);
  expect(await page.evaluate(() => window.__waveProbe!.busy()), "the horizon view busy").toBe(false);
  expect(await paintsOver(page, 1000), "horizon repaints in the next second").toBe(0);
  expect(await page.evaluate(() => window.__waveProbe!.busy()), "the horizon view busy a second later").toBe(false);
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
    const strip = host.getBoundingClientRect();
    const styles = {
      zIndex: getComputedStyle(host).zIndex,
      position: getComputedStyle(host).position,
      hostEvents: getComputedStyle(host).pointerEvents,
      canvasEvents: getComputedStyle(canvas).pointerEvents,
    };
    // elementFromPoint skips pointer-events: none, so the strip is made hit
    // testable for this one read: paint order alone must give the point to the text.
    host.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "auto";
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    host.style.pointerEvents = "";
    canvas.style.pointerEvents = "";
    return {
      ...styles,
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
  const created = await sweepTriggersCreated(page);
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
  // Each of the four toggles rebuilt the trigger (a dropped dependency would leave this at 0).
  expect((await sweepTriggersCreated(page)) - created, "triggers created across the toggles").toBe(4);
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
  // The band's own Play it (a second one waits, inert, beside the declined note).
  await expect(band.locator('[data-control="before"]')).toHaveAccessibleName(siteContent.listen.accept);
  await expect(band.getByRole("button", { name: siteContent.listen.decline, exact: true })).toBeAttached();
});
