import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { walkStrings } from "@/lib/testing/walk";
import { openHome } from "./coil";
import { expect } from "./fixtures";
// The inline links' e2e helpers (e2e/inline-links.spec.ts and
// e2e/inline-links-touch.spec.ts). Tips, pops and calendar links come from
// fixture strings on /fixtures/inline, a route that exists only while the
// server runs with E2E_FIXTURES=1 (playwright.config.ts); the definition is
// Who I am's own.
export const DEF = "I'm a [product](def:product)-focused engineer.";
export const TIP = "I'll build [anything](tip:killer-drones) that helps people.";
export const POP = "I played [bass clarinet](pop:contrabass-clarinet).";
export const MATCHA = "Let's grab a coffee ([or matcha](pop:matcha)). No matter what you're building[*](tip:killer-drones).";
export const CALENDAR = "Or [grab a time on my calendar](https://cal.com/aaron-sulbaran).";
export const MATCHA_HREF = siteContent.register.pop.matcha.href!;
export async function openFixture(page: Page, ...copies: string[]) {
  await page.goto(`/fixtures/inline?${copies.map((copy) => `copy=${encodeURIComponent(copy)}`).join("&")}`);
  await page.waitForSelector("html[data-inline-links='ready']", { state: "attached" });
  // Each lines-split block has masked its lines in (or is still under reduced motion).
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>("main [data-sections-block]")].every((block) => block.dataset.sectionsState !== "armed"
    || [...block.querySelectorAll<HTMLElement>(".sections-line")].every((line) => ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(line).transform))));
}
export async function tabTo(page: Page, link: Locator) {
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Tab never reached the link");
}
export const bubble = (page: Page) => page.locator("[data-inline-tip]");
export const tipLink = (page: Page) => page.locator('[data-inline="tip"][data-inline-key="killer-drones"]');
const PRODUCT_ON_HOME = walkStrings(siteContent.whoIAm).some((leaf) => leaf.text.includes("](def:product)"));
// The definition lives in Who I am; the fixture stands in only if the copy ever drops it.
export async function productLink(page: Page): Promise<Locator> {
  if (PRODUCT_ON_HOME) await openHome(page);
  else await openFixture(page, DEF);
  const link = page.locator('[data-inline="def"][data-inline-key="product"]').first();
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  return link;
}
