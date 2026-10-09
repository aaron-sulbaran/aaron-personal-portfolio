import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
// The inline links' e2e helpers (e2e/inline-links.spec.ts and
// e2e/inline-links-touch.spec.ts). Until C5 lands Aaron's copy the links come
// from fixture strings on /fixtures/inline, a route that exists only while the
// server runs with E2E_FIXTURES=1 (playwright.config.ts).
export const DEF = "I'm a [product](def:product)-focused engineer.";
export const TIP = "I performed as a [Rango](tip:aango) knockoff that rapped.";
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
export const rango = (page: Page) => page.locator('[data-inline="tip"][data-inline-key="aango"]');
