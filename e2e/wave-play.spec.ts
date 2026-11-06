import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { bandInkPixels, parkBand } from "./support/wave";
import { BAND_CARD } from "./support/player";
import type { PathProbe } from "@/lib/wavepath/probe";

// Aaron, 2026-11-06: pressing Play with the band in view and never scrolling left the wave dead; it only reacted after a scroll.
// Play in the band must shape the band's run at once, and the music must stop shaping it when paused. Muted browsers: Play it is safe.
const S = siteContent.soundtrack;
const HOME = "/?wavedebug";
const L = siteContent.listen;
type W = Window & { __wavePath: PathProbe };
const frame = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.frame()!);
const accept = (page: Page) => page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();

// Distinct drawn states of the band's canvas over `ms`: a hash of the pixels, sampled every 100ms.
async function distinctBandFrames(page: Page, ms: number) {
  const seen = new Set<string>();
  for (let t = 0; t < ms; t += 100) {
    seen.add(await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("#listen canvas")!;
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      let h = 0;
      for (let i = 3; i < data.length; i += 4) h = (h * 31 + data[i]) | 0;
      return String(h);
    }));
    await page.waitForTimeout(100);
  }
  return seen.size;
}

test("wave: Play in the band shapes the run with no scroll at all", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  await page.waitForFunction(() => (window as unknown as W).__wavePath.frame()?.length);
  await page.mouse.move(4, 4);
  const quiet = await bandInkPixels(page);
  await accept(page);
  await expect.poll(async () => (await frame(page)).music, { timeout: 3000, message: "the music's hold on the wave, no scroll" }).toBeGreaterThan(0.5);
  await expect.poll(() => bandInkPixels(page), { timeout: 4000, message: "the band's ink grows with the music" }).toBeGreaterThan(quiet * 1.1);
  expect(await distinctBandFrames(page, 2000), "the band keeps changing while the music plays").toBeGreaterThan(5);
});

test("wave: Pause stops the music's hold on the wave, and Play brings it back, still with no scroll", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  await page.waitForFunction(() => (window as unknown as W).__wavePath.frame()?.length);
  await accept(page);
  const player = page.locator(BAND_CARD);
  await expect.poll(async () => (await frame(page)).music, { timeout: 3000 }).toBeGreaterThan(0.5);
  await player.getByRole("button", { name: S.ariaPause, exact: true }).click();
  await expect.poll(async () => (await frame(page)).music, { timeout: 3000, message: "the wave lets go when paused" }).toBe(0);
  await page.waitForTimeout(500);
  expect((await frame(page)).music, "still nothing while paused").toBe(0);
  await player.getByRole("button", { name: S.ariaPlay, exact: true }).click();
  await expect.poll(async () => (await frame(page)).music, { timeout: 3000 }).toBeGreaterThan(0.5);
});

test("wave: a scroll after Play still releases the hold and sends the ripple", async ({ page }) => {
  await openHome(page, { path: HOME });
  await parkBand(page);
  await page.waitForFunction(() => (window as unknown as W).__wavePath.frame()?.length);
  await accept(page);
  await expect.poll(async () => (await frame(page)).music, { timeout: 3000 }).toBeGreaterThan(0.5);
  expect((await frame(page)).ripple, "the ripple still waits for the release").toBe(0);
  await page.evaluate(() => window.scrollBy({ top: window.innerHeight, behavior: "instant" }));
  await expect.poll(async () => (await frame(page)).ripple, { timeout: 1500, message: "the ripple at the release" }).toBeGreaterThan(0);
});

test("wave: reduced motion: Play never starts the wave's loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(HOME);
  await settled(page);
  await page.waitForFunction(() => (window as unknown as W).__wavePath.frame()?.length);
  await parkBand(page);
  await accept(page);
  await page.waitForTimeout(1500);
  const f = await frame(page);
  expect(f.music, "no music shape under reduced motion").toBe(0);
});
