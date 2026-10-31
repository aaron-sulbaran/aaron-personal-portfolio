import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { documentTop, pageRects, pageSettled, parkBand } from "./support/wave";
import { dotReach } from "@/lib/wavepath/columns";
import { dotsOn, layLine, lineDots } from "@/lib/wavepath/line";
import type { PathProbe } from "@/lib/wavepath/probe";
import { marginDrop, stretchEnds, tightestInView } from "@/lib/wavepath/rules";
import { blankAt, visibleOptions } from "@/lib/wavepath/visible";

// The scroll-drawn line (wave lab rounds 2 to 6), read through its probe.
// Never "Play it" here: "Not now" starts the line too, and nothing may play.
const HOME = "/?wavedebug";
const L = siteContent.listen;
type W = Window & { __wavePath: PathProbe; __e2eMedia: () => boolean[] };
const frame = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.frame()!);
const paints = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.paints);
const ticks = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.ticks);
const rippleNow = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.frame()!.ripple);
const layouts = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.layouts);
const visibleDots = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.visibleDots());
const maxScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
const headAtRest = (page: Page) => page.waitForFunction(() => { const f = (window as unknown as W).__wavePath.frame(); return !!f && f.length > 0 && f.head === f.target; });
// The last block of page 1, whose foot is the first thing below the band's own stretch of the line.
const BELOW_BAND = "#story-outside";
// The top of page 3: the line's first crossing below the cards section is in view there at every size. Page 1's words leave no gap
// tall enough to cross in today, so the line is out of sight beside them (lib/wavepath/serpentine).
const CROSSING = "#numbers";
const toBlock = async (page: Page, sel: string) => scrollToY(page, Math.round(await documentTop(page, sel)));

async function open(page: Page) {
  await page.addInitScript(() => {
    const media: HTMLMediaElement[] = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { media.push(this); return play.call(this); };
    Object.assign(window, { __e2eMedia: () => media.map((m) => m.paused) });
  });
  await openHome(page, { path: HOME });
  await parkBand(page);
  await headAtRest(page);
}
const decline = (page: Page) => page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
const accept = (page: Page) => page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
// A declined, unfrozen line breathes while in view; the rest tests freeze it first.
// The reader's freeze is in the playback pill and the player, which are out of reach while the band is parked in view, so the tests use the probe's own.
const freeze = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.freeze(true));

// The line is a serpentine (lib/wavepath/serpentine): it crosses the page in the gaps between its words and stays off screen past
// a block of words too tall to have one. So the screen may be empty of the line, but only where the line itself has nothing to
// show there: at every 50px of scroll with no drawn dot in view, the lib, laid on the page as the page measured it, must agree
// that even the whole line drawn behind the head shows nothing there (never the train letting go of a crossing still in view).
for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`wavepath: the screen is empty of the line only where the line has nothing to show, at ${size.width}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size);
    await open(page);
    await decline(page);
    const bandTop = Math.round(await documentTop(page, "#listen"));
    const start = Math.max(0, Math.round(bandTop - size.height / 2));
    const end = await maxScroll(page);
    const unexplained: number[] = [];
    let empty = 0;
    for (let y = start; ; y = Math.min(end, y + 50)) {
      await scrollToY(page, y);
      await headAtRest(page);
      if ((await visibleDots(page)) === 0) {
        empty++;
        const layout = await page.evaluate(() => (window as unknown as W).__wavePath.layout!);
        const { samples } = layLine(layout.anchors, layout.viewport);
        const opts = { ...visibleOptions(layout.anchors.width, layout.viewport), train: null };
        // One step of slack either way: the lib samples the line, the page draws dots.
        const own = [-50, 0, 50].some((d) => blankAt(samples, layout.anchors, opts, y - layout.origin + d));
        if (!own) unexplained.push(y);
      }
      if (y >= end) break;
    }
    expect(unexplained, `scroll positions with no drawn dot in view that the line itself would show (${empty} empty in all)`).toEqual([]);
  });
}

test("wavepath: before an answer the band run is level and the head waits at its end", async ({ page }) => {
  await open(page);
  let f = await frame(page);
  expect(f.decided).toBe(false);
  expect(f.runLen).toBeGreaterThan(0);
  expect(f.head).toBe(f.runLen);
  expect(f.runFlat, "the run's largest step off its line, px").toBeLessThan(0.5);
  await toBlock(page, BELOW_BAND);
  await page.waitForTimeout(500);
  f = await frame(page);
  expect(f.head, "held at the run's end past the band").toBe(f.runLen);
});

// The undecided run breathes slowly (no peaks, no music) and the line does not follow: the head still waits.
test("wavepath: before an answer the band breathes in view", async ({ page }) => {
  await open(page);
  await page.mouse.move(4, 4);
  const before = await paints(page);
  await page.waitForTimeout(1000);
  expect((await paints(page)) - before, "repaints in a second before any answer").toBeGreaterThan(10);
  const f = await frame(page);
  expect(f.decided).toBe(false);
  expect(f.head).toBe(f.runLen);
});

// Before an answer the path has no ink, so with the band off screen and no ripple the loop sleeps.
test("wavepath: undecided, with the band out of view, the loop sleeps", async ({ page }) => {
  await open(page);
  await toBlock(page, "#numbers");
  await page.mouse.move(4, 4);
  // The band's last frames after it leaves view come a beat late; wait for a full second of none.
  await expect.poll(async () => { const a = await ticks(page); await page.waitForTimeout(1000); return (await ticks(page)) === a; }, { timeout: 15_000, message: "conductor frames stop advancing" }).toBe(true);
  const rested = await ticks(page);
  await page.waitForTimeout(700);
  expect(await ticks(page), "conductor frames while undecided and out of view").toBe(rested);
  expect((await frame(page)).decided).toBe(false);
});

test("wavepath: after Not now the head leaves the band and reaches the end at max scroll, nothing playing", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, BELOW_BAND);
  await headAtRest(page);
  const f = await frame(page);
  expect(f.head).toBeGreaterThan(f.runLen);
  await scrollToY(page, await maxScroll(page));
  await headAtRest(page);
  const end = await frame(page);
  expect(end.length - end.head).toBeLessThanOrEqual(1);
  expect((await page.evaluate(() => (window as unknown as W).__e2eMedia())).every(Boolean), "every media element paused").toBe(true);
});

// At 2800px/s (the sections pick) a 2100 to 2600px flick arrives within 50px
// in 1.13 to 1.32s and rests in 1.87 to 2.05s (simulated); "settles" is arrival.
test("wavepath: a 1.5-screen flick arrives within 1.5s at the draw cap", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, BELOW_BAND);
  await headAtRest(page);
  const run = await page.evaluate(() => new Promise<{ arrived: number; rest: number; gap: number }>((resolve) => {
    const p = (window as unknown as W).__wavePath;
    window.scrollTo({ top: window.scrollY + 1.5 * window.innerHeight, behavior: "instant" });
    const t0 = performance.now();
    let arrived = 0, gap = 0;
    const tick = () => {
      const f = p.frame()!;
      const now = performance.now() - t0;
      gap = Math.max(gap, f.target - f.head);
      if (!arrived && gap > 0 && f.target - f.head < 50) arrived = now;
      if ((gap > 0 && f.head === f.target) || now > 5000) return resolve({ arrived, rest: now, gap });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  expect(run.gap, "the flick's line, px of arc").toBeGreaterThan(1000);
  expect(run.arrived).toBeLessThanOrEqual(1500);
  expect(run.rest).toBeLessThanOrEqual(2400);
});

test("wavepath: reduced motion draws the whole line still and runs no loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(HOME);
  await settled(page);
  await page.waitForFunction(() => ((window as unknown as W).__wavePath.frame()?.length ?? 0) > 0);
  const f = await frame(page);
  expect(f.head).toBe(f.length);
  for (const sel of [CROSSING, "#connect"]) {
    await toBlock(page, sel);
    expect(await visibleDots(page), `drawn dots at ${sel}`).toBeGreaterThan(0);
  }
  await page.waitForTimeout(1000);
  expect(await ticks(page), "conductor frames").toBe(0);
});

test("wavepath: nothing repaints at rest", async ({ page }) => {
  await open(page);
  await decline(page);
  await freeze(page);
  await toBlock(page, BELOW_BAND);
  await page.mouse.move(4, 4);
  await headAtRest(page);
  await page.waitForTimeout(500);
  const before = await paints(page);
  await page.waitForTimeout(1000);
  expect((await paints(page)) - before).toBe(0);
});

test("wavepath: after Not now the line breathes in view", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, BELOW_BAND);
  await page.mouse.move(4, 4);
  await headAtRest(page);
  const before = await paints(page);
  await page.waitForTimeout(1000);
  expect((await paints(page)) - before, "repaints while the declined line breathes").toBeGreaterThan(0);
});

test("wavepath: no anchor, word block or band line is sticky", async ({ page }) => {
  await open(page);
  const sticky = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-wave-anchor], [data-wave-words], [data-wave-band-line]")]
    .filter((el) => { for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "sticky") return true; return false; })
    .map((el) => el.outerHTML.slice(0, 80)));
  expect(sticky).toEqual([]);
  expect(await page.locator("[data-wave-anchor]").count()).toBe(5);
});

// Review Focus
// "At once" is counted in frames, not time: a watcher installed before the page
// runs reads the probe each rAF, and the head must sit on its target within
// three frames of the line first having a length (the layout's own frame, the
// conductor's snap, one to spare). An eased head would need seconds to cover a
// deep target, so any small frame budget tells snapping from easing, and a
// frame count does not flake with machine load the way a timer would.
test("wavepath: a deep load at #connect with a stored no is drawn at once", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("aaron-soundtrack", "off");
    const seen = { frames: 0, atTarget: 0, ticks: -1, target: 0, runLen: 0, head: 0 };
    Object.assign(window, { __firstDraw: seen });
    const watch = () => {
      const probe = (window as unknown as W).__wavePath;
      const f = probe?.frame();
      if (f && f.length > 0 && !seen.atTarget) {
        seen.frames++;
        Object.assign(seen, { target: f.target, runLen: f.runLen, head: f.head, ticks: probe.ticks });
        // Before the conductor's first step both are still 0: that is not arrival.
        if (f.target > 0 && f.head === f.target) seen.atTarget = seen.frames;
      }
      if (seen.atTarget || seen.frames > 10) return;
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.goto("/?wavedebug#connect");
  await settled(page);
  await headAtRest(page);
  const seen = await page.evaluate(() => (window as unknown as { __firstDraw: { frames: number; atTarget: number; ticks: number; target: number; runLen: number } }).__firstDraw);
  expect(seen.target, "a deep target, past the band run").toBeGreaterThan(seen.runLen);
  expect(seen.atTarget, "frames from the first length to the head on its target (0: never)").toBeGreaterThan(0);
  expect(seen.atTarget).toBeLessThanOrEqual(3);
  expect(seen.ticks, "conductor frames by then").toBeLessThanOrEqual(3);
  expect((await frame(page)).decided).toBe(true);
  expect(await visibleDots(page)).toBeGreaterThan(0);
});

test("wavepath: crossing to a phone width re-lays the line in view", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, BELOW_BAND);
  const wide = (await frame(page)).length;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction((w) => (window as unknown as W).__wavePath.frame()!.length !== w, wide);
  await toBlock(page, CROSSING);
  await headAtRest(page);
  expect(await visibleDots(page)).toBeGreaterThan(0);
});

test("wavepath: frozen before answering, Not now still sends the head off the band", async ({ page }) => {
  await open(page);
  await freeze(page);
  await decline(page);
  await toBlock(page, BELOW_BAND);
  await headAtRest(page);
  const f = await frame(page);
  expect(f.head).toBeGreaterThan(f.runLen);
});

test("wavepath: one section reflow lays the line out once and keeps it in view", async ({ page }) => {
  await open(page);
  await decline(page);
  await page.waitForTimeout(800);
  const before = { length: (await frame(page)).length, layouts: await layouts(page) };
  await page.evaluate(() => { document.getElementById("about")!.style.paddingBottom = "400px"; });
  await page.waitForTimeout(800);
  expect((await layouts(page)) - before.layouts, "layouts per reflow").toBe(1);
  expect((await frame(page)).length).toBeGreaterThan(before.length);
  await toBlock(page, CROSSING);
  await headAtRest(page);
  expect(await visibleDots(page)).toBeGreaterThan(0);
});

test("wavepath: undecided, a width change snaps the head to the new run and keeps it there", async ({ page }) => {
  await open(page);
  const first = await frame(page);
  expect(first.decided).toBe(false);
  const laidBefore = await layouts(page);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForFunction((n) => (window as unknown as W).__wavePath.layouts > n, laidBefore);
  // Two frames after the re-layout: an eased head would still be walking.
  const after = await page.evaluate(() => new Promise<{ head: number; runLen: number }>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const f = (window as unknown as W).__wavePath.frame()!;
      resolve({ head: f.head, runLen: f.runLen });
    }));
  }));
  expect(after.runLen, "the run follows the new width").toBeLessThan(first.runLen);
  expect(after.head, "the head sits on the new run's end").toBe(after.runLen);
  // The band breathes while undecided, but the head never leaves the run's end.
  await page.waitForTimeout(500);
  const later = await frame(page);
  expect(later.decided).toBe(false);
  expect(later.head, "the head stays at the run's end while the band breathes").toBe(later.runLen);
});

test("wavepath: reduced motion toggled live stills the line and back, with no orphan tiles", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, BELOW_BAND);
  await page.mouse.move(4, 4);
  await headAtRest(page);
  const tileBoxes = () =>
    page.locator("[data-wave-path] canvas").evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top + window.scrollY), height: Math.round(box.height) };
      }),
    );
  // One unbroken column of tiles, none twice and none left behind.
  const expectOneColumn = async (label: string) => {
    const column = (await tileBoxes()).sort((a, b) => a.top - b.top);
    expect(column.length, `tiles ${label}`).toBeGreaterThan(0);
    column.slice(1).forEach((tile, i) => expect(Math.abs(tile.top - (column[i].top + column[i].height)), `tile ${i + 1} starts where the one above ends, ${label}`).toBeLessThanOrEqual(1));
  };
  const moving = await ticks(page);
  await expect.poll(() => ticks(page), "the declined line breathes").toBeGreaterThan(moving);
  // The tiles under the line's reach are made over the first frames after the head settles; count them once they have.
  await page.waitForTimeout(800);
  await expectOneColumn("while moving");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => { const f = (window as unknown as W).__wavePath.frame(); return !!f && f.length > 0 && f.head === f.length; });
  const stilled = await ticks(page);
  await page.waitForTimeout(1000);
  expect(await ticks(page), "conductor frames while still").toBe(stilled);
  expect((await frame(page)).head).toBe((await frame(page)).length);
  // Reduced motion lays page 1 out without the stage's rail (the dealt page had closed its slot), so the page and the line change length:
  // the count of tiles may differ from before, the column must not break.
  await expectOneColumn("after stilling");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => { const f = (window as unknown as W).__wavePath.frame(); return !!f && f.length > 0; });
  await toBlock(page, BELOW_BAND);
  await headAtRest(page);
  const resumed = await ticks(page);
  await expect.poll(() => ticks(page), "the loop runs again").toBeGreaterThan(resumed);
  await expectOneColumn("after moving again");
});

// A phone's toolbar collapsing while it scrolls changes innerHeight and fires
// a resize, while the page's own boxes (sized in svh) stay put. A real
// viewport resize would also move the hero above the band, so the test
// reports the taller window to the page instead.
test("wavepath: a height-only resize on a phone keeps the layout and the tiles, and still reaches the end", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await decline(page);
  await page.waitForTimeout(800);
  const before = { length: (await frame(page)).length, layouts: await layouts(page) };
  await page.evaluate(() => {
    (document.querySelector("[data-wave-path] canvas") as HTMLCanvasElement & { kept?: boolean }).kept = true;
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => 928 });
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(800);
  expect(await layouts(page), "layouts for a height-only resize").toBe(before.layouts);
  expect((await frame(page)).length).toBe(before.length);
  expect(await page.evaluate(() => !!(document.querySelector("[data-wave-path] canvas") as HTMLCanvasElement & { kept?: boolean }).kept), "the first tile is the same element").toBe(true);
  await scrollToY(page, await maxScroll(page));
  await headAtRest(page);
  const end = await frame(page);
  expect(end.length - end.head, "the head reaches the end at the new max scroll").toBeLessThanOrEqual(1);
});

test("wavepath: a theme switch at rest repaints once, then rests", async ({ page }) => {
  await open(page);
  await decline(page);
  await freeze(page);
  await toBlock(page, BELOW_BAND);
  await headAtRest(page);
  await page.waitForTimeout(500);
  const before = await paints(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  await expect.poll(() => paints(page)).toBeGreaterThan(before);
  await page.waitForTimeout(500);
  const rested = await paints(page);
  await page.waitForTimeout(1000);
  expect(await paints(page)).toBe(rested);
});

// The ripple (revision): one Gaussian crest sent from the answer buttons along
// the line, then the line settles into breathing. Muted browsers: Play it is safe.
test("wavepath: Not now sends a ripple, once the band has scrolled away, that settles into breathing", async ({ page }) => {
  await open(page);
  expect(await rippleNow(page), "no ripple before pressing").toBe(0);
  await decline(page);
  // The answer waits for the band to leave, and so does its ripple.
  await page.waitForTimeout(500);
  expect(await rippleNow(page), "no ripple while the band is in view").toBe(0);
  await toBlock(page, BELOW_BAND);
  await expect.poll(() => rippleNow(page), { timeout: 300, message: "a ripple within 300ms of the release" }).toBeGreaterThan(0);
  await expect.poll(() => rippleNow(page), { timeout: 4000, message: "the ripple ends within 4s" }).toBe(0);
  await page.mouse.move(4, 4);
  const before = await paints(page);
  await page.waitForTimeout(1000);
  expect((await paints(page)) - before, "repaints continue as the line breathes").toBeGreaterThan(10);
});

test("wavepath: Play it sends a ripple too", async ({ page }) => {
  await open(page);
  await accept(page);
  await page.waitForTimeout(500);
  expect(await rippleNow(page), "no ripple while the band is in view").toBe(0);
  await toBlock(page, BELOW_BAND);
  await expect.poll(() => rippleNow(page), { timeout: 300, message: "a ripple within 300ms of the release" }).toBeGreaterThan(0);
  await expect.poll(() => rippleNow(page), { timeout: 4000, message: "the ripple ends within 4s" }).toBe(0);
});

test("wavepath: a returning visitor with a stored choice gets no ripple", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aaron-soundtrack", "off"));
  await page.goto(HOME);
  await settled(page);
  await headAtRest(page);
  let peak = 0;
  for (let t = 0; t < 1500; t += 50) {
    peak = Math.max(peak, await rippleNow(page));
    await page.waitForTimeout(50);
  }
  expect(peak, "ripple height over the first 1.5s").toBe(0);
});

test("wavepath: reduced motion: no ripple", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(HOME);
  await settled(page);
  await page.waitForFunction(() => ((window as unknown as W).__wavePath.frame()?.length ?? 0) > 0);
  await decline(page);
  let peak = 0;
  for (let t = 0; t < 1000; t += 50) {
    peak = Math.max(peak, await rippleNow(page));
    await page.waitForTimeout(50);
  }
  expect(peak, "ripple height after declining under reduced motion").toBe(0);
});

// The line never lands on words, a link or a tap target (the lib's own line on the page's own measurements, as lib/wavepath/clear.test.ts
// does on its fixture): laid on the anchors the page measured, every dot of it, still and with the music at its fullest, is
// checked against every line of text and every link, button and control the browser drew. The serpentine's own rules are read off
// the same line: each stretch in view runs from one edge past the other, none turns tighter than 0.6 of the width, none runs
// down a margin.
async function walkAndMeasure(page: Page) {
  const end = await maxScroll(page);
  const vh = page.viewportSize()!.height;
  for (let y = 0; y <= end; y += Math.round(vh * 0.6)) {
    await scrollToY(page, y);
    await page.waitForTimeout(250);
  }
  await scrollToY(page, 0);
  await pageSettled(page);
  const before = await layouts(page);
  await page.evaluate(() => window.dispatchEvent(new Event("wavepath:relayout")));
  await expect.poll(() => layouts(page)).toBeGreaterThan(before);
  await pageSettled(page);
  return page.evaluate(() => (window as unknown as W).__wavePath.layout!);
}

for (const size of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`wavepath: no dot of the line lands on words, a link or a tap target, and it crosses cleanly, at ${size.width}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(size);
    await open(page);
    await decline(page);
    const layout = await walkAndMeasure(page);
    expect(layout.anchors.links.length, "the links the line keeps off").toBeGreaterThan(10);
    const { lines, targets } = await pageRects(page);
    expect(lines.length).toBeGreaterThan(50);
    expect(targets.length).toBeGreaterThan(10);
    const laid = layLine(layout.anchors, layout.viewport);
    for (const state of ["rest", "loud"] as const) {
      const dots = lineDots(laid, state);
      expect(dots.length / 3, `${state}: the line is drawn`).toBeGreaterThan(500);
      expect(dotsOn(dots, lines).map(({ rect, dots: n }) => `${lines[rect].text} x${n}`), `${state}: text the line lands on`).toEqual([]);
      expect(dotsOn(dots, targets).map(({ rect, dots: n }) => `${targets[rect].label} x${n}`), `${state}: links and controls the line lands on`).toEqual([]);
    }
    const reach = dotReach(laid.amp);
    const W = layout.anchors.width;
    const ends = stretchEnds(laid.samples, layout.anchors, reach);
    expect(ends.length, "crossings in view").toBeGreaterThanOrEqual(2);
    for (const { first, last } of ends) expect([Math.min(first, last) < -reach + 8, Math.max(first, last) > W + reach - 8], "a crossing runs edge to edge").toEqual([true, true]);
    expect(tightestInView(laid.samples, layout.anchors, reach), "the tightest turn in view, px").toBeGreaterThanOrEqual(0.6 * W);
    expect(marginDrop(laid.samples, layout.anchors, reach), "the most a crossing drops within a margin, px").toBeLessThan(120);
  });
}
