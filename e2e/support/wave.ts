import type { Page } from "@playwright/test";
import { scrollToY } from "./coil";

// Placing the page against the band.

export const BAND_PARK = 0.7;

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

// The band's bottom edge at `y` px from the viewport's top.
export async function bandBottomAt(page: Page, y: number) {
  const top = await page.evaluate((y) => document.getElementById("listen")!.getBoundingClientRect().bottom + window.scrollY - y, y);
  await scrollToY(page, Math.round(top));
}

// Where the path layer's ink is, in document px: every painted pixel of every
// tile that holds a bitmap (a tile owns one only near the viewport). minY and
// maxY are null when nothing is painted. `bandBottom` is the band's bottom edge
// in the same px, so a test can say "no ink above it".
export type PathInk = { painted: number; minY: number | null; maxY: number | null; bandBottom: number };

export async function pathInk(page: Page): Promise<PathInk> {
  return page.evaluate(() => {
    let painted = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>("[data-wave-path] canvas")) {
      if (!canvas.width || !canvas.height) continue;
      const rect = canvas.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const scale = canvas.height / rect.height;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
          painted++;
          minY = Math.min(minY, top + y / scale);
          maxY = Math.max(maxY, top + y / scale);
        }
      }
    }
    const band = document.getElementById("listen")!.getBoundingClientRect();
    return { painted, minY: painted ? minY : null, maxY: painted ? maxY : null, bandBottom: band.bottom + window.scrollY };
  });
}

// How many pixels of the band's own canvas are painted.
export const bandInkPixels = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#listen canvas")!;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return painted;
  });
