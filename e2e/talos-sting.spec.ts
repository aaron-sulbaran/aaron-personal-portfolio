import { siteContent } from "@/lib/content";
import { STING } from "@/lib/talos/sting";
import { test, expect } from "./support/fixtures";
import { openCardFromBook } from "./support/cards";

const team = siteContent.cards.talos.team;

test("talos sting: it plays once under the header, then rests on the lockup for the light theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  const { dialog } = await openCardFromBook(page, "talos");
  const stage = dialog.locator("[data-sting-stage]");
  await expect(stage).toHaveAttribute("role", "img");
  await expect(stage).toHaveAttribute("aria-label", team.lockup.alt);
  await expect(stage.locator("svg")).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-sting", "playing", { timeout: 4000 });
  await expect(stage).toHaveAttribute("data-sting", "done", { timeout: STING.durationMs + 4000 });
  await expect(stage.locator("svg")).toHaveCount(0);
  await expect(stage.locator('img[src*="lockup-light.svg"]')).toBeVisible();
  await expect(stage.locator('img[src*="lockup-dark.svg"]')).toBeHidden();
  const header = await dialog.locator("h2").boundingBox();
  const box = await stage.boundingBox();
  expect(box!.y).toBeGreaterThan(header!.y + header!.height - 1);
});

test("talos sting: it never replays on hover or click, and a theme switch swaps to the matching cut", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  const { dialog } = await openCardFromBook(page, "talos");
  const stage = dialog.locator("[data-sting-stage]");
  await expect(stage).toHaveAttribute("data-sting", "done", { timeout: STING.durationMs + 5000 });
  await stage.hover();
  await stage.click();
  await page.waitForTimeout(600);
  await expect(stage).toHaveAttribute("data-sting", "done");
  await expect(stage.locator("svg")).toHaveCount(0);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect(stage.locator('img[src*="lockup-dark.svg"]')).toBeVisible();
  await expect(stage.locator('img[src*="lockup-light.svg"]')).toBeHidden();
});

test("talos sting: in the dark theme it ends on the dark lockup, and reopening plays it again", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
  const { dialog } = await openCardFromBook(page, "talos");
  await expect(dialog.locator("[data-sting-stage]")).toHaveAttribute("data-sting", "done", { timeout: STING.durationMs + 5000 });
  await expect(dialog.locator('[data-sting-stage] img[src*="lockup-dark.svg"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const again = await openCardFromBook(page, "talos", { home: false });
  await expect(again.dialog.locator("[data-sting-stage]")).not.toHaveAttribute("data-sting", "done");
});

test("talos sting: reduced motion shows the static lockup at once, live in both directions", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const { dialog } = await openCardFromBook(page, "talos", { home: false });
  const stage = dialog.locator("[data-sting-stage]");
  await expect(stage).toHaveAttribute("data-sting", "reduced");
  await expect(stage.locator("svg")).toHaveCount(0);
  await expect(stage.locator('img[src*="lockup-light.svg"]')).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(stage).not.toHaveAttribute("data-sting", "reduced");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(stage).toHaveAttribute("data-sting", "reduced");
  await expect(stage.locator("svg")).toHaveCount(0);
});

test("talos modal: four specialists in 48px rounded squares and eight reactions, each with its words", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const { dialog } = await openCardFromBook(page, "talos", { home: false });
  const specialists = dialog.locator("[data-talos-specialists] li");
  await expect(specialists).toHaveCount(4);
  for (const [i, specialist] of team.specialists.entries()) {
    const item = specialists.nth(i);
    await expect(item).toContainText(specialist.name);
    await expect(item).toContainText(specialist.job);
    const mark = item.locator("img");
    await expect(mark).toHaveAttribute("alt", specialist.alt);
    const size = await mark.boundingBox();
    expect([Math.round(size!.width), Math.round(size!.height)]).toEqual([48, 48]);
    await expect(mark).toHaveCSS("border-top-left-radius", "16px");
    await expect(mark).toHaveCSS("box-shadow", "none");
    await expect(mark).toHaveCSS("border-top-width", "0px");
  }
  const states = dialog.locator("[data-talos-states] li");
  await expect(states).toHaveCount(8);
  for (const [i, state] of team.states.entries()) {
    await expect(states.nth(i)).toContainText(state.name);
    await expect(states.nth(i)).toContainText(state.meaning);
    const size = await states.nth(i).locator("img").boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(48);
  }
  await expect(dialog).toContainText("Only one is bronze: needs-you");
  await expect(dialog).toContainText("Next, Talos becomes a team of specialists");
});

test("talos modal: the legend reads at 390px wide, two columns, nothing sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const { dialog } = await openCardFromBook(page, "talos", { home: false });
  const states = dialog.locator("[data-talos-states] li");
  const first = await states.nth(0).boundingBox();
  const second = await states.nth(1).boundingBox();
  const third = await states.nth(2).boundingBox();
  expect(second!.y).toBeCloseTo(first!.y, 0);
  expect(second!.x).toBeGreaterThan(first!.x + 100);
  expect(third!.y).toBeGreaterThan(first!.y + 40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const li of await dialog.locator("[data-talos-team] li").all()) {
    const box = await li.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
});

test("talos modal: the brand kit link opens in a new tab with noopener noreferrer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const { dialog } = await openCardFromBook(page, "talos", { home: false });
  const link = dialog.getByRole("link", { name: /See the Talos brand kit/ });
  await expect(link).toHaveAttribute("href", "https://claude.ai/artifact/YX8BJc8uetSyL7WPD7aEhX");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
