import type { Page } from "@playwright/test";
import { DUCK_SPLIT } from "@/lib/waveform/duck";
import type { WaveProbe } from "@/lib/waveform/probe";
import { scrollToY } from "./coil";

// Reading the waveform through its ?wavedebug probe (lib/waveform/probe.ts)
// and placing the page against the band and the horizon strip. The sweep
// trigger starts with the band's centre at 60 percent of the viewport, so a
// band parked with its centre at 70 percent is fully in view at sweep 0.

type ProbeWindow = Window & { __waveProbe?: WaveProbe };

export const BAND_PARK = 0.7;
export const AVOID_BLOCKS = ["#about", "#who-i-am", "#up-to-now", "#connect", "footer"] as const;

export const hasProbe = (page: Page) => page.evaluate(() => !!(window as ProbeWindow).__waveProbe);
export const sweep = (page: Page) => page.evaluate(() => (window as ProbeWindow).__waveProbe!.sweep());
export const horizonPaints = (page: Page) => page.evaluate(() => (window as ProbeWindow).__waveProbe!.horizonPaints);
export const paintedColumns = (page: Page) => page.evaluate(() => (window as ProbeWindow).__waveProbe!.columns().length);
export const sweepTriggers = (page: Page) => page.evaluate(() => (window as ProbeWindow).__waveProbe!.triggers());
export const sweepTriggersCreated = (page: Page) => page.evaluate(() => (window as ProbeWindow).__waveProbe!.triggersCreated());
export const themeOf = async (page: Page) =>
  ((await page.locator("html").getAttribute("data-theme")) === "dark" ? "dark" : "light") as "light" | "dark";

// Resolves once scrollY has held for two frames in a row (a wheel's smooth scroll has ended).
export async function scrollHeld(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = window.scrollY;
        let held = 0;
        const tick = () => {
          held = window.scrollY === last ? held + 1 : 0;
          last = window.scrollY;
          if (held >= 2) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

export async function documentTop(page: Page, selector: string) {
  return page.evaluate((sel) => document.querySelector(sel)!.getBoundingClientRect().top + window.scrollY, selector);
}

// The band's centre at `at` of the viewport height (BAND_PARK by default).
export async function parkBand(page: Page, at = BAND_PARK) {
  const y = await page.evaluate((at) => {
    const band = document.getElementById("listen")!.getBoundingClientRect();
    return band.top + window.scrollY + band.height / 2 - at * window.innerHeight;
  }, at);
  await scrollToY(page, Math.round(y));
}

// Horizon repaints over `ms` of no input.
export async function paintsOver(page: Page, ms: number) {
  const before = await horizonPaints(page);
  await page.waitForTimeout(ms);
  return (await horizonPaints(page)) - before;
}

export type DuckReport = {
  overStrip: boolean; // the words overlap the strip
  under: number; // columns whose x falls inside the words
  loud: { x: number; duck: number; alpha: number }[]; // of those, the ones not ducked
};

// Checks the element's words against the last painted horizon frame: every
// column whose x falls inside the words must be ducked (envelope past DUCK_SPLIT)
// and painted at or under the ceiling. The words' box is the union of their
// text rects (transforms included, as the eye sees them), not the element's
// box, so the open air beside a short heading may keep its wave.
export async function duckReport(page: Page, selector: string, index: number, ceiling: number): Promise<DuckReport> {
  return page.evaluate(
    ({ selector, index, ceiling, split }) => {
      const el = document.querySelectorAll(selector)[index] as HTMLElement;
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (!r.width) continue;
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
          top = Math.min(top, r.top);
          bottom = Math.max(bottom, r.bottom);
        }
      }
      const strip = document.querySelector('[data-wave="horizon"]')!.getBoundingClientRect();
      const columns = (window as ProbeWindow).__waveProbe!.columns();
      const under = columns.filter((c) => c.x >= left && c.x <= right);
      return {
        overStrip: top < strip.bottom && bottom > strip.top,
        under: under.length,
        loud: under.filter((c) => !(c.duck > split && c.alpha <= ceiling + 1e-6)),
      };
    },
    { selector, index, ceiling, split: DUCK_SPLIT },
  );
}

// The strip canvas's own pixels over the element's words, every row: the
// highest alpha channel value (0 to 255) and how many pixels carry any paint.
export async function stripPixelsUnder(page: Page, selector: string, index: number) {
  return page.evaluate(
    ({ selector, index }) => {
      const el = document.querySelectorAll(selector)[index] as HTMLElement;
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let left = Infinity;
      let right = -Infinity;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (!r.width) continue;
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
        }
      }
      const canvas = document.querySelector<HTMLCanvasElement>('[data-wave="horizon"] canvas')!;
      const box = canvas.getBoundingClientRect();
      const scale = canvas.width / box.width;
      const x0 = Math.max(0, Math.floor((left - box.left) * scale));
      const x1 = Math.min(canvas.width, Math.ceil((right - box.left) * scale));
      const { data } = canvas.getContext("2d")!.getImageData(x0, 0, x1 - x0, canvas.height);
      let max = 0;
      let painted = 0;
      for (let k = 3; k < data.length; k += 4) {
        if (data[k] > max) max = data[k];
        if (data[k] > 0) painted++;
      }
      return { max, painted, width: x1 - x0 };
    },
    { selector, index },
  );
}
