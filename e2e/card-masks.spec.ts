import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardRow, flyCard, openCardFromBook } from "./support/cards";

// What a run may leave behind in the page: a split line, an armed body, or an
// inline clip-path or GSAP scale anywhere in a card's modal body. (The panel
// sits outside the body and rises on its own inline transform; the mask-in
// never writes it.)
async function leftovers(page: Page) {
  return page.evaluate(() => ({
    lines: document.querySelectorAll(".card-line").length,
    armed: document.querySelectorAll("[data-mask-armed]").length,
    written: [...document.querySelectorAll<HTMLElement>("[data-card-body] [style]")].filter((el) => el.style.clipPath !== "" || /scale\(/.test(el.style.transform)).length,
  }));
}
const CLEAN = { lines: 0, armed: 0, written: 0 };

test("masks: a card's modal masks in on a timer and leaves nothing behind", async ({ page }) => {
  await openHome(page);
  const opened = Date.now();
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await expect(dialog.locator('[data-mask="title"] .card-line').first()).toBeAttached();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(Date.now() - opened).toBeLessThan(3500);
  expect(await leftovers(page)).toEqual(CLEAN);
});

// A book open has no flight to wait for: by the time the panel rests (280ms),
// the title's first line (step one, 480ms long) is already opening.
test("masks: a book open starts its masks at once, with nothing landing to wait for", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  const right = await dialog.locator('[data-mask="title"] .card-line').first().evaluate((el) => parseFloat((el as HTMLElement).style.clipPath.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/)[1] ?? "102"));
  expect(right).toBeLessThan(100);
});

test("masks: a photo's clip edge travels left to right, and each line's clip opens left to right in place", async ({ page }) => {
  await openCardFromBook(page, "capital-one");
  const photo = await page.waitForFunction(() => {
    const clip = document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-mask="photo-0"]')?.style.clipPath ?? "";
    const inset = clip.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat);
    return inset && inset[1] > 1 && inset[1] < 99 ? inset : null;
  }, null, { polling: "raf", timeout: 5000 });
  const [top, right, bottom, left] = (await photo.jsonValue())!;
  expect([top, bottom, left]).toEqual([0, 0, 0]);
  expect(right).toBeGreaterThan(1);
  const line = await page.waitForFunction(() => {
    const clip = document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-mask="words-0"] .card-line')?.style.clipPath ?? "";
    const inset = clip.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat);
    return inset && inset[1] > -2 && inset[1] < 102 ? inset : null;
  }, null, { polling: "raf", timeout: 5000 });
  const parts = (await line.jsonValue())!;
  expect([parts[0], parts[2], parts[3]]).toEqual([-25, -25, -2]);
});

test("masks: Escape in the middle of the run leaves nothing behind, and the next open replays from the start", async ({ page }) => {
  const { row, dialog } = await openCardFromBook(page, "capital-one");
  await page.waitForFunction(() => !!document.querySelector('[data-card-modal="capital-one"] [data-mask="words-0"] .card-line'), null, { polling: "raf" });
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await leftovers(page)).toEqual(CLEAN);
  await row.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await expect(dialog.locator('[data-mask="title"] .card-line').first()).toBeAttached();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(await leftovers(page)).toEqual(CLEAN);
});

test("masks: a flown card's photo never masks, while its caption does", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo", { parked: false });
  const sample = await page.waitForFunction((k) => {
    const dialog = document.querySelector(`[data-card-modal="${k}"]`);
    const slot = dialog?.querySelector<HTMLElement>('[data-tile-slot="photo"]');
    const caption = dialog?.querySelector<HTMLElement>('[data-mask="caption-0"] .card-line');
    return slot && caption?.style.clipPath ? { slot: slot.style.clipPath, caption: caption.style.clipPath } : null;
  }, key, { polling: "raf", timeout: 5000 });
  const { slot, caption } = (await sample.jsonValue())!;
  expect(slot).toBe("");
  expect(caption).toMatch(/^inset\(/);
});

test("masks: under reduced motion nothing masks, and turning it on mid-run shows every part at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  expect(await leftovers(page)).toEqual(CLEAN);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await cardRow(page, "capital-one").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 1000 });
  expect(await leftovers(page)).toEqual(CLEAN);
});
