import { siteContent } from "@/lib/content";
import { STING } from "@/lib/talos/sting";
import { test, expect } from "./support/fixtures";
import { openCardFromBook } from "./support/cards";

const team = siteContent.cards.talos.team;

test("talos sting: it plays once between the first two paragraphs, then rests on the lockup for the light theme", async ({ page }) => {
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

test("talos modal: the order is the title, the first paragraph, the sting, the second paragraph, the Discord channel, then the team's two paragraphs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const { dialog } = await openCardFromBook(page, "talos", { home: false });
  const top = async (locator: import("@playwright/test").Locator) => (await locator.boundingBox())!.y;
  const [first, second] = siteContent.cards.talos.modal.blocks;
  const order = [
    await top(dialog.locator("h2")),
    await top(dialog.getByText(first.slice(0, 40))),
    await top(dialog.locator("[data-sting-stage]")),
    await top(dialog.getByText(second.slice(0, 40))),
    await top(dialog.locator("[data-talos-discord]")),
    await top(dialog.getByText(team.next.slice(0, 40))),
    await top(dialog.getByText(team.reactions.slice(0, 40))),
  ];
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(new Set(order).size).toBe(order.length);
  await expect(dialog.locator("[data-talos-specialists], [data-talos-states]")).toHaveCount(0);
  await expect(dialog).toContainText("Only one is bronze: needs-you");
});

for (const [theme, shown, hidden] of [["light", "discord-light", "discord-dark"], ["dark", "discord-dark", "discord-light"]] as const) {
  test(`talos modal: the Discord channel shows its ${theme} file in the ${theme} theme, rounded, with no shadow, and a theme switch swaps it`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    const { dialog } = await openCardFromBook(page, "talos", { home: false });
    const figure = dialog.locator("[data-talos-discord]");
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.locator("img").filter({ visible: true })).toHaveCount(1);
    await expect(figure.locator("img:visible")).toHaveAttribute("src", new RegExp(shown));
    await expect(figure.locator("img:visible")).toHaveAttribute("alt", team.discord.alt);
    await expect(figure.locator(`img[src*="${hidden}"]`)).toBeHidden();
    await expect(figure).toHaveCSS("border-top-left-radius", "12px");
    await expect(figure).toHaveCSS("box-shadow", "none");
    const loaded = await figure.locator("img:visible").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
    await page.evaluate((next) => document.documentElement.setAttribute("data-theme", next), theme === "light" ? "dark" : "light");
    await expect(figure.locator("img:visible")).toHaveAttribute("src", new RegExp(hidden));
  });
}

test("talos modal: at 390px wide the Discord channel just scales and nothing goes sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const { dialog } = await openCardFromBook(page, "talos", { home: false });
  const figure = dialog.locator("[data-talos-discord]");
  await figure.scrollIntoViewIfNeeded();
  const box = await figure.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.width).toBeGreaterThan(280);
  expect(Math.abs(box!.height / box!.width - team.discord.height / team.discord.width)).toBeLessThan(0.02);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("talos sting: a sting below the fold waits, and starts once it scrolls into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  const { dialog } = await openCardFromBook(page, "talos");
  const stage = dialog.locator("[data-sting-stage]");
  await page.waitForTimeout(STING.durationMs);
  await expect(stage).toHaveAttribute("data-sting", "waiting");
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-sting", "playing", { timeout: 3000 });
  await expect(stage).toHaveAttribute("data-sting", "done", { timeout: STING.durationMs + 4000 });
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
