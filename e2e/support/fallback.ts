import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { expect } from "./fixtures";

export async function settled(page: Page) {
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.home === "ready" &&
      document.body.style.overflow !== "hidden" &&
      !["on", "shrink"].includes(document.documentElement.dataset.introLoader ?? "") &&
      !document.documentElement.dataset.introWords,
  );
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

// What the cards section looks like when no scene can run: its stage holds no
// canvas but the hero still (the scene at rest, decoded; page 1 carries the
// name, so none is baked into it), page 1's name is live text, and a title
// still opens its card.
export async function expectStillHeroAndUsableBook(page: Page) {
  const hero = page.locator("section[data-scene]");
  await expect(hero).toHaveAttribute("data-scene", "still");
  await expect(hero.locator("canvas")).toHaveCount(0);
  await expect(hero.locator("[data-hero-still]")).toHaveAttribute("data-still-ready", "");
  const still = hero.locator("[data-hero-still] img").filter({ visible: true });
  await expect(still).toHaveCount(1);
  await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expectNameText(page);
  // A title still opens a card.
  const title = page.locator('#work button[data-card="band"]');
  await title.scrollIntoViewIfNeeded();
  await title.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// Page 1's name as the page's h1, with the whole heading as its accessible
// name, drawn at full opacity and laid out. With no name canvas (reduced
// motion, no WebGL: data-name-canvas "still") the name is plain text in the
// lockup's two lines; while the canvas draws it ("on", as when only the cards'
// scene threw) the lines are its hidden source and are left alone.
export async function expectNameText(page: Page) {
  const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading, exact: true });
  await expect(h1).toHaveAccessibleName(siteContent.hero.heading);
  await expect(page.locator(".intro-loader")).toBeHidden();
  await expect.poll(() => h1.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  expect(await h1.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(100);
  if ((await page.locator(".intro-name").getAttribute("data-name-canvas")) !== "still") return;
  const shown = await h1.evaluate((el) =>
    [".name-lockup__greet", ".name-lockup__name"].map((selector) => {
      const line = el.querySelector(selector)!;
      const r = line.getBoundingClientRect();
      return { text: line.firstChild?.textContent ?? "", width: r.width, height: r.height, shows: line.checkVisibility({ opacityProperty: true, visibilityProperty: true }) };
    }),
  );
  expect(shown.map((line) => line.text)).toEqual([siteContent.hero.greeting, siteContent.hero.name]);
  for (const line of shown) {
    expect(line.shows, `${line.text} shows`).toBe(true);
    expect(line.width, `${line.text} width`).toBeGreaterThan(20);
    expect(line.height, `${line.text} height`).toBeGreaterThan(5);
  }
}
