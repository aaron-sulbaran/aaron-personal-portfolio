import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { ISLE_LINE } from "@/lib/player/constants";
import { expect } from "./fixtures";
import { bandBottomAt, parkBand } from "./wave";

// Reading the soundtrack player (components/player): the card in the band, the
// desktop pill, the phone island and the glass that travels between them.

export const BAND_CARD = "[data-player-band-card]";
export const PLAYER_PILL = "[data-player-pill]";
export const ISLAND = "[data-player-island]";
export const CLONE = "[data-player-clone]";
export const TOGGLE = "[data-shape-toggle]";

const L = siteContent.listen;

// The viewport's height, for the lines the band is placed against.
export const viewportHeight = (page: Page) => page.viewportSize()!.height;

// Plays from the band, parked in view: the card opens in it.
export async function playFromBand(page: Page) {
  await parkBand(page);
  await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
  await expect(page.locator(BAND_CARD)).toBeVisible();
}

// The band's bottom edge `offset` px above (negative: below) the hand-off line, so the reader is past it or short of it.
export const bandPastLine = (page: Page, offset: number) => bandBottomAt(page, Math.round(ISLE_LINE * viewportHeight(page)) - offset);

export const pillState = (page: Page) => page.locator(PLAYER_PILL).getAttribute("data-player-pill");

// A sampler for the travelling glass: from now until `ms` it records the
// clone's visibility and box every frame. Read it with `morphSamples`.
export type MorphSample = { visible: boolean; left: number; top: number; width: number; height: number };

export function recordMorph(page: Page, ms: number) {
  return page.evaluate((span) => {
    const host = window as unknown as { __morph?: MorphSample[] };
    const samples: MorphSample[] = [];
    host.__morph = samples;
    const start = performance.now();
    const tick = () => {
      const clone = document.querySelector<HTMLElement>("[data-player-clone]");
      if (clone) {
        const r = clone.getBoundingClientRect();
        samples.push({ visible: getComputedStyle(clone).visibility === "visible" && Number(getComputedStyle(clone).opacity) > 0.05, left: r.left, top: r.top, width: r.width, height: r.height });
      }
      if (performance.now() - start < span) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
}

export const morphSamples = (page: Page) => page.evaluate(() => (window as unknown as { __morph?: MorphSample[] }).__morph ?? []);
