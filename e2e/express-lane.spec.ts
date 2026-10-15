import { siteContent } from "@/lib/content";
import { quickCopy, quickEntries } from "@/lib/content/quick";
import { INVITE_KEY } from "@/lib/quick/invite";
import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import type { Page } from "@playwright/test";

// The Express lane (docs/superpowers/specs/2026-10-13-express-lane-design.md):
// its tiles open the cards' own modals, the first-visit invite asks once, the
// transition runs both ways and lands focus on the new page's heading, and the
// lane never fetches the Coil's chunk.

const tile = (page: Page, slot: string) => page.locator(`main button[data-quick-slot="${slot}"]`);
const homeReady = (page: Page) => expect(page.locator("html")).toHaveAttribute("data-home", "ready", { timeout: 20_000 });
const idle = (page: Page) => expect(page.locator("[data-transition]")).toHaveAttribute("data-transition", "idle", { timeout: 10_000 });

test("express lane: every tile opens its own card's modal, Escape closes it and focus returns to the tile", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.locator("h1")).toHaveText(quickCopy.title);
  await expect(page.locator("[data-quick-hint]")).toHaveText(quickCopy.hint);
  for (const entry of quickEntries) {
    const button = tile(page, entry.slot);
    await button.click();
    const dialog = page.locator(`[role="dialog"][data-card-modal="${entry.id}"]`);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2").first()).toHaveText(siteContent.cards[entry.id].modal.title);
    await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

test("express lane: the page reads whole at first paint and never requests the scene's chunk", async ({ page }) => {
  const scripts = watchScripts(page);
  await page.goto("/quick");
  await page.waitForLoadState("networkidle");
  for (const year of ["2021", "2022", "2023", "2024", "2025", "2026"]) await expect(page.locator(`#year-${year} h2`)).toHaveText(year);
  await expect(page.locator("main h2").first()).toHaveText("2026");
  await expect(page.locator("main button[data-card]")).toHaveCount(quickEntries.length);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
  expect(await scripts.sceneChunks()).toEqual([]);
});

test("express lane: the first-visit invite shows once, and never again once dismissed", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  const pill = page.locator('[data-express-invite="pill"]');
  const toast = page.locator('[data-express-invite="toast"]');
  await expect(toast).toBeVisible({ timeout: 6_000 });
  await expect(pill).toHaveCount(0);
  await toast.getByRole("button", { name: quickCopy.invite.no }).click();
  await expect(pill).toHaveCount(0);
  await expect(toast).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), INVITE_KEY)).toBe("dismissed");
  await page.reload();
  await homeReady(page);
  await page.waitForTimeout(3_000);
  await expect(pill).toHaveCount(0);
  await expect(toast).toHaveCount(0);
});

test("express lane: the invite never shows on a deep landing past the hero", async ({ page }) => {
  await page.goto("/#about");
  await homeReady(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(3_000);
  await expect(page.locator('[data-express-invite="pill"], [data-express-invite="toast"]')).toHaveCount(0);
});

test("express lane: the transition runs both ways and lands focus on each page's heading", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  await page.locator('[data-express-invite="toast"]').getByRole("button", { name: quickCopy.invite.yes }).click({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), INVITE_KEY)).toBe("used");

  await page.locator("main").getByRole("link", { name: quickCopy.back }).click();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-home", "ready");
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await page.goBack();
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
});

test("express lane: the Menu chip takes either page to the other", async ({ page }) => {
  await page.goto("/quick");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: quickCopy.back }).click();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: quickCopy.menuChip }).click();
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
});
