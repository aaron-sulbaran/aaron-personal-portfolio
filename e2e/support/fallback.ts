import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { expect } from "./fixtures";

export async function settled(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.home === "ready" && document.body.style.overflow !== "hidden");
  // The scene chunk is requested one frame after first paint when it can run; give it the load to show up.
  await page.waitForLoadState("networkidle");
}

// Hydration errors on a page (React reports them on the console).
export function watchHydration(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

// What the hero looks like when no scene can run: the hero still (the scene
// at rest, decoded), the h1 kept for assistive tech but visually hidden, and
// a book that still opens its photos.
export async function expectStillHeroAndUsableBook(page: Page) {
  const hero = page.locator("section[data-scene]");
  await expect(hero).toHaveAttribute("data-scene", "still");
  await expect(hero.locator("canvas")).toHaveCount(0);
  await expect(hero.locator("[data-hero-still]")).toHaveAttribute("data-still-ready", "");
  const still = hero.locator("[data-hero-still] img").filter({ visible: true });
  await expect(still).toHaveCount(1);
  await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading });
  await expect(h1).toBeAttached();
  expect(await h1.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  // The book still opens a photo.
  const row = page.locator("#work button.book-row", { hasText: "Drum major" });
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
