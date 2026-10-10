import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { documentTop, parkBand } from "./support/wave";
import type { PathProbe } from "@/lib/wavepath/probe";

// The scroll-drawn line (wave lab rounds 2 to 6), read through its probe.
// Never "Play it" here: "Not now" starts the line too, and nothing may play.
const HOME = "/?wavedebug";
const L = siteContent.listen;
type W = Window & { __wavePath: PathProbe; __e2eMedia: () => boolean[] };
const frame = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.frame()!);
const paints = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.paints);
const ticks = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.ticks);
const layouts = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.layouts);
const visibleDots = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.visibleDots());
const maxScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
const headAtRest = (page: Page) => page.waitForFunction(() => { const f = (window as unknown as W).__wavePath.frame(); return !!f && f.length > 0 && f.head === f.target; });
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
// A declined, unfrozen line breathes while in view; the rest tests freeze it first.
const freeze = (page: Page) => page.locator("#listen").getByRole("button", { name: L.freeze, exact: true }).click();

for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`wavepath: some drawn dot is in view at every 50px of scroll at ${size.width}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(size);
    await open(page);
    await decline(page);
    const start = Math.max(0, Math.round((await documentTop(page, "#listen")) - size.height / 2));
    const end = await maxScroll(page);
    const empty: number[] = [];
    for (let y = start; ; y = Math.min(end, y + 50)) {
      await scrollToY(page, y);
      await headAtRest(page);
      if ((await visibleDots(page)) === 0) empty.push(y);
      if (y >= end) break;
    }
    expect(empty, "scroll positions with no drawn dot in view").toEqual([]);
  });
}

test("wavepath: before an answer the band run is level and the head waits at its end", async ({ page }) => {
  await open(page);
  let f = await frame(page);
  expect(f.decided).toBe(false);
  expect(f.runLen).toBeGreaterThan(0);
  expect(f.head).toBe(f.runLen);
  expect(f.runFlat, "the run's largest step off its line, px").toBeLessThan(0.5);
  await toBlock(page, "#about");
  await page.waitForTimeout(500);
  f = await frame(page);
  expect(f.head, "held at the run's end past the band").toBe(f.runLen);
});

test("wavepath: after Not now the head leaves the band and reaches the end at max scroll, nothing playing", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, "#about");
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
  await toBlock(page, "#about");
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
  for (const sel of ["#about", "#numbers", "#connect"]) {
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
  await toBlock(page, "#about");
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
  await toBlock(page, "#about");
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
test("wavepath: a deep load at #connect with a stored no is drawn at once", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aaron-soundtrack", "off"));
  await page.goto("/?wavedebug#connect");
  await settled(page);
  await headAtRest(page);
  expect((await frame(page)).decided).toBe(true);
  expect(await visibleDots(page)).toBeGreaterThan(0);
});

test("wavepath: crossing to a phone width re-lays the line in view", async ({ page }) => {
  await open(page);
  await decline(page);
  await toBlock(page, "#about");
  const wide = (await frame(page)).length;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction((w) => (window as unknown as W).__wavePath.frame()!.length !== w, wide);
  await toBlock(page, "#about");
  await headAtRest(page);
  expect(await visibleDots(page)).toBeGreaterThan(0);
});

test("wavepath: frozen before answering, Not now still sends the head off the band", async ({ page }) => {
  await open(page);
  await freeze(page);
  await decline(page);
  await toBlock(page, "#about");
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
  await toBlock(page, "#about");
  await headAtRest(page);
  expect(await visibleDots(page)).toBeGreaterThan(0);
});

test("wavepath: a theme switch at rest repaints once, then rests", async ({ page }) => {
  await open(page);
  await decline(page);
  await freeze(page);
  await toBlock(page, "#about");
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
