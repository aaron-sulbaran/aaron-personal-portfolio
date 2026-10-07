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
