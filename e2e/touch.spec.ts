import type { CDPSession } from "@playwright/test";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
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

test("touch: the first visit shows no hint line, \"Tap a card\" or any other", async ({ page }) => {
  await openHome(page);
  // The line would be set in the effect that runs once the hero is ready.
  await nextFrames(page, 10);
  const lines = page.locator("section[data-scene] p[data-hint-line]");
  await expect(lines).toHaveCount(1);
  await expect(lines).toHaveText("");
  await expect(page.locator("section[data-scene] p", { hasText: "Tap a card" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("aaron-hint-tap"))).toBeNull();

  // A touch screen's later visits are the same.
  await openHome(page);
  await nextFrames(page, 10);
  await expect(page.locator("section[data-scene] p", { hasText: "Tap a card" })).toHaveCount(0);
  await expect(page.locator("section[data-scene] p[data-hint-line]")).toHaveText("");
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
  await expect(page.getByText(chart.hintFlatTouch, { exact: true })).toHaveCount(1);
  await expect(page.getByText(chart.hintFlat, { exact: true })).toHaveCount(0);

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

// The flat chart's touch hint tells the truth: a tap on a day shows its details.
test("touch: a tap on a day of the flat chart shows its details, as the hint says", async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => document.querySelector("[data-metrics-block]")!.scrollIntoView({ block: "center", behavior: "instant" }));
  const stage = page.locator("[data-skyline-stage]");
  await expect(stage).toHaveAttribute("data-view-state", "skyline", { timeout: 15_000 });
  await page.locator("[data-metrics-block]").getByRole("button", { name: siteContent.metrics.chart.flat, exact: true }).tap();
  await expect(stage).toHaveAttribute("data-view-state", "flat", { timeout: 15_000 });
  await expect(page.locator("[data-metrics-block]").getByText(/ on [A-Z][a-z]+day, /)).toHaveCount(0);
  const box = (await stage.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await expect(page.locator("[data-metrics-block]").getByText(/\d+ contributions? on [A-Z][a-z]+day, /)).toBeVisible();
});

// The MVP's short name does not unfurl on a touch screen (no hover to read, and
// the MVP page's own title does the reveal there): page 1's line just says
// "In a rush? The MVP", and the Menu sheet shows "MVP" with a quiet second line
// naming it. Nothing moves.
test("touch: page 1's line says In a rush? The MVP and never unfurls; its words are still and its name is the whole MVP", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await page.waitForFunction(() => !document.documentElement.dataset.introWords);
  const { teaser } = siteContent.intro;
  const line = page.getByRole("link", { name: teaser.quickName, exact: true });
  await expect(line).toHaveCount(1);
  await expect(line.locator(".mvp-short")).toHaveText(quickCopy.titleShort);
  expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), "no hover to read").toBe(false);
  const state = await line.evaluate((el, short) => {
    const fan = el.querySelector<HTMLElement>(".mvp-fan")!;
    return {
      fan: getComputedStyle(fan).display,
      slots: [...el.querySelectorAll<HTMLElement>(".mvp-slot")].map((slot) => [slot.getBoundingClientRect().width, getComputedStyle(slot).transitionDuration]),
      text: (el.textContent ?? "").split(short)[0],
    };
  }, quickCopy.titleShort);
  expect(state.fan, "the unfurled words are not drawn").toBe("none");
  expect(state.slots.every(([width, duration]) => width === 0 && duration === "0s"), "no slot opens or moves").toBe(true);
  expect(state.text).toBe(teaser.quick.slice(0, -quickCopy.titleShort.length));
  const before = await line.boundingBox();
  await page.locator("[data-intro-cta] a[href='#work']").evaluate((el) => el.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch", bubbles: true })));
  await nextFrames(page, 4);
  expect(await line.boundingBox()).toEqual(before);
});

test("touch: the Menu sheet shows MVP with a quiet second line, Minimum Viable Portfolio, in the label face, and the chip does not grow", async ({ page }) => {
  await openHome(page, { at: "top" });
  await page.getByRole("button", { name: siteContent.menu.ariaLabelOpen }).click();
  const dialog = page.getByRole("dialog", { name: siteContent.menu.dialogLabel });
  const chip = dialog.getByRole("link", { name: quickCopy.menuChipName, exact: true });
  await expect(chip).toBeVisible();
  await page.waitForTimeout(1200);
  const note = dialog.locator("[data-menu-mvp-note]");
  await expect(note).toHaveText(quickCopy.menuChipNote);
  await expect(note).toBeVisible();
  const [chipBox, noteBox] = [(await chip.boundingBox())!, (await note.boundingBox())!];
  const viewport = page.viewportSize()!;
  expect(chipBox.width, "the chip is its short word").toBeLessThan(90);
  expect(noteBox.y, "the line is under the chip").toBeGreaterThanOrEqual(chipBox.y + chipBox.height - 1);
  expect(noteBox.x + noteBox.width, "the line fits the sheet").toBeLessThanOrEqual(viewport.width);
  expect(noteBox.y + noteBox.height, "the line fits the sheet").toBeLessThanOrEqual(viewport.height);
  const faces = await page.evaluate(() => {
    const family = (selector: string) => getComputedStyle(document.querySelector(selector)!).fontFamily;
    return { note: family("[data-menu-mvp-note]"), chip: family("[data-menu-mvp]") };
  });
  expect(faces.note, "the label face").toBe(faces.chip);
  await chip.hover();
  await nextFrames(page, 4);
  expect((await chip.boundingBox())!.width, "no unfurl").toBe(chipBox.width);
});
