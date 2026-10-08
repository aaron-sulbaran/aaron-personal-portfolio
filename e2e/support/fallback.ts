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
// at rest, decoded, the name baked behind its cards), the h1 visually hidden
// once it has decoded (the whole heading still its accessible name), and a
// book that still opens its photos.
export async function expectStillHeroAndUsableBook(page: Page) {
  const hero = page.locator("section[data-scene]");
  await expect(hero).toHaveAttribute("data-scene", "still");
  await expect(hero.locator("canvas")).toHaveCount(0);
  await expect(hero.locator("[data-hero-still]")).toHaveAttribute("data-still-ready", "");
  const still = hero.locator("[data-hero-still] img").filter({ visible: true });
  await expect(still).toHaveCount(1);
  await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expectHeadingHidden(page);
  // The book still opens a photo.
  const row = page.locator("#work button.book-row", { hasText: "Drum major" });
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// The h1 once the still carries the name: visually hidden (sr-only, a box of
// 1px at most), the whole heading as its accessible name.
export async function expectHeadingHidden(page: Page) {
  const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading, exact: true });
  await expect(h1).toHaveAccessibleName(siteContent.hero.heading);
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect.poll(() => h1.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  expect(await h1.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
}

// The h1 as the lockup (the still never decoded): shown at opacity 1 with both lines laid out, and the
// whole heading as its accessible name.
export async function expectHeadingLockup(page: Page) {
  const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading, exact: true });
  await expect(h1).toHaveAccessibleName(siteContent.hero.heading);
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect.poll(() => h1.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  const lines = await h1.evaluate((el) =>
    [".hero-lockup__greet", ".hero-lockup__name"].map((selector) => {
      const line = el.querySelector(selector)!;
      const r = line.getBoundingClientRect();
      return { text: line.firstChild?.textContent ?? "", width: r.width, height: r.height, shows: line.checkVisibility({ opacityProperty: true, visibilityProperty: true }) };
    }),
  );
  expect(lines.map((line) => line.text)).toEqual([siteContent.hero.greeting, siteContent.hero.name]);
  for (const line of lines) {
    expect(line.shows, `${line.text} shows`).toBe(true);
    expect(line.width, `${line.text} width`).toBeGreaterThan(20);
    expect(line.height, `${line.text} height`).toBeGreaterThan(5);
  }
}
