import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

// What the hero looks like with no scene: the poster, the server-rendered h1,
// and a book that still opens its photos.

export async function settled(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.home === "ready" && document.body.style.overflow !== "hidden");
  // The scene chunk is requested one frame after first paint when it can run; give it the load to show up.
  await page.waitForLoadState("networkidle");
}

export async function expectPosterHeroAndUsableBook(page: Page) {
  const hero = page.locator("section[data-scene]");
  await expect(hero).toHaveAttribute("data-scene", "off");
  await expect(hero.locator("canvas")).toHaveCount(0);
  await expect(hero.locator('img[src*="/coil/field-"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { level: 1, name: "Hi, I'm Aaron." })).toBeVisible();
  // The book still opens a photo.
  const row = page.locator("#work button.book-row", { hasText: "Drum major" });
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
