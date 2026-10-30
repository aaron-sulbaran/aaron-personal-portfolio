import type { CDPSession } from "@playwright/test";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { coilPoints, nextFrames, openHome, type Point } from "./support/coil";
import type { HookWindow } from "./support/hooks";

// A phone (the touch project: a Pixel 7 with touch and a coarse pointer).
// The hero is touch-action: pan-y, so a vertical swipe that starts on a card
// scrolls the page; a horizontal drag spins the coil and the release coasts
// it onto a card; a tap opens the card's modal directly, with no flight.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One finger from `from` to `to` in `steps` moves a frame apart, as a hand swipes.
async function swipe(cdp: CDPSession, from: Point, to: Point, steps = 12) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("touch: the phone gets the coarse driver", async ({ page }) => {
  await openHome(page);
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-input", "coarse");
});

test("touch: a vertical swipe that starts on a card scrolls the page", async ({ page, cdp }) => {
  await openHome(page);
  const { card } = await coilPoints(page);
  const before = await page.evaluate(() => ({ offset: (window as HookWindow).__coil!.offset(), t: performance.now() }));

  await swipe(cdp, card, { x: card.x, y: card.y - 300 });

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(150);
  expect(await page.evaluate(() => (window as HookWindow).__coil!.drag().dragging)).toBe(false);
  // No spin from the swipe, and none from the page scroll it caused: the coil kept its idle pace.
  const after = await page.evaluate(() => ({ offset: (window as HookWindow).__coil!.offset(), t: performance.now() }));
  const idleTravel = (COIL.idleCardsPerSecond * (after.t - before.t)) / 1000;
  expect(Math.abs(after.offset - before.offset), "coil travel, cards").toBeLessThan(idleTravel + 0.02);
});

test("touch: a horizontal drag spins the coil, and the release coasts onto a card", async ({ page, cdp }) => {
  await openHome(page);
  const { card } = await coilPoints(page);
  const start = await page.evaluate(() => (window as HookWindow).__coil!.offset());
  const pageY = await page.evaluate(() => window.scrollY);

  await swipe(cdp, card, { x: card.x - 180, y: card.y + 4 }, 10);

  const released = await page.evaluate(() => (window as HookWindow).__coil!.drag());
  expect(released.coast, "a coast target after the release").not.toBeNull();
  expect(Math.abs(released.target - start), "cards moved by the drag").toBeGreaterThan(0.5);
  expect(await page.evaluate(() => window.scrollY), "page scroll").toBe(pageY);
  // The coast settles exactly on a whole card.
  await page.waitForFunction(() => (window as HookWindow).__coil!.drag().coast === null, null, { timeout: 5000 });
  const rest = await page.evaluate(() => (window as HookWindow).__coil!.drag());
  expect(Math.abs(rest.offset - Math.round(rest.offset))).toBeLessThan(0.01);
});

test("touch: a tap on a card opens its modal with no flight", async ({ page }) => {
  await openHome(page);
  const { card } = await coilPoints(page);

  await page.touchscreen.tap(card.x, card.y);

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
});

test("touch: the first visit shows \"Tap a card\" once, never again", async ({ page }) => {
  await openHome(page);
  const hint = page.locator("section[data-scene] p[aria-hidden='true']", { hasText: "Tap a card" });
  await expect(hint).toHaveCount(1);
  await expect.poll(() => hint.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);

  await openHome(page);
  // The line would be set in the effect that runs once the hero is ready.
  await nextFrames(page, 10);
  await expect(page.locator("section[data-scene] p", { hasText: "Tap a card" })).toHaveCount(0);
});

// The skyline's hint says what a finger does, and a double-tap really resets the view: the hint reads "double-tap to reset" (a mouse's
// reads "double-click", metrics.spec), and after an orbit by a drag two taps in the same place bring the chart back to how it stood.
test("touch: the chart's hint says double-tap, and two taps on the chart reset an orbit", async ({ page, cdp }) => {
  const chart = siteContent.metrics.chart;
  await openHome(page);
  await page.evaluate(() => document.querySelector("[data-metrics-block]")!.scrollIntoView({ block: "center", behavior: "instant" }));
  const stage = page.locator("[data-skyline-stage]");
  await expect(stage).toHaveAttribute("data-view-state", "skyline", { timeout: 15_000 });
  await expect(page.getByText(chart.hintSkylineTouch, { exact: true })).toHaveCount(1);
  await expect(page.getByText(chart.hintSkyline, { exact: true })).toHaveCount(0);

  const canvas = stage.locator("canvas");
  const picture = () => canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await nextFrames(page, 20);
  const resting = await picture();
  const box = (await canvas.boundingBox())!;
  // An empty corner of the chart: a tap there pins no day, so the reset is the only thing the taps change.
  const corner = { x: box.x + 6, y: box.y + 6 };
  await swipe(cdp, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 }, { x: box.x + box.width * 0.5 - 140, y: box.y + box.height * 0.5 }, 14);
  await expect.poll(picture, { message: "the drag orbits the chart" }).not.toBe(resting);
  await page.touchscreen.tap(corner.x, corner.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(corner.x, corner.y);
  await expect.poll(picture, { message: "two taps put it back", timeout: 8000 }).toBe(resting);
});
