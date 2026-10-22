import { test, expect } from "./support/fixtures";
import { cardDialog } from "./support/cards";
import { cardAt, coilPoints, openHome, scrollToCards } from "./support/coil";
import { approach } from "./support/input";
import type { HookWindow } from "./support/hooks";
import { siteContent } from "@/lib/content";

// The cards section (#work): the Coil between two columns of short titles,
// and the fork at the intro's foot that scrolls to it.

const { columns, intro } = siteContent;
const titles = columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles));

test("cards section: the two columns hold the fourteen cards, Work on the left and Builds with Off the clock on the right", async ({ page }) => {
  await openHome(page);
  expect(titles).toHaveLength(14);
  const left = await page.locator("#work h2").first().boundingBox();
  const right = await page.locator("#work h2").nth(1).boundingBox();
  expect(left!.x).toBeLessThan(right!.x);
  await expect(page.locator("#work h2")).toHaveText(["Work", "Builds"]);
  await expect(page.locator("#work h3")).toHaveText(["Off the clock"]);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toHaveText(title.short);
});

test("cards section: the Deal me in button scrolls to the cards, and a visit starts at the top of the intro", async ({ page }) => {
  await openHome(page, { at: "top" });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole("button", { name: intro.teaser.deal }).click();
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 5000 });
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("[aria-current]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: intro.teaser.quick })).toHaveAttribute("href", "/quick");
});

test("cards section: hovering a title brings its card to the front and holds the Coil there", async ({ page }) => {
  await openHome(page);
  await page.locator('#work button[data-card="talos"]').hover();
  await expect.poll(() => page.evaluate(() => (window as HookWindow).__coil!.focusKey())).toBe("talos");
  await page.mouse.move(720, 4);
  await expect.poll(() => page.evaluate(() => (window as HookWindow).__coil!.focusKey())).toBeNull();
});

test("cards section: hovering a card in the Coil lights its title", async ({ page, cdp }) => {
  await openHome(page);
  const { card } = await coilPoints(page);
  await approach(cdp, card);
  const hit = (await cardAt(page, card))!;
  await expect(page.locator(`#work button[data-card="${hit.key}"]`)).toHaveAttribute("data-lit", "");
  await expect(page.locator("#work button[data-lit]")).toHaveCount(1);
});

test("cards section: clicking a title opens its card with the flight, and the title carries the seen dot once it is closed", async ({ page }) => {
  await openHome(page);
  const title = page.locator('#work button[data-card="ieee"]');
  await expect(title.locator("[aria-hidden]")).toHaveCount(0);
  await title.click();
  await expect(cardDialog(page, "ieee")).toBeVisible();
  await expect(page.locator("[data-flying-tile]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(cardDialog(page, "ieee")).toHaveCount(0);
  await expect(title.locator("[aria-hidden]")).toHaveCount(1);
  await expect(title).toBeFocused();
});

test("cards section: the nav's scroll-spy reads Work in the cards and About in the intro", async ({ page }) => {
  await openHome(page, { at: "top" });
  await scrollToCards(page, 200);
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("[aria-current]").first()).toContainText("Work");
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("[aria-current]").first()).toContainText("About");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("cards section: all fourteen titles are on one screen under the Coil, and a tap turns the Coil and opens the card", async ({ page }) => {
    await openHome(page);
    for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeInViewport({ ratio: 1 });
    const coilBottom = await page.locator("#work [data-coil-stage]").evaluate((el) => el.getBoundingClientRect().bottom);
    const firstTitleTop = await page.locator('#work button[data-card="capital-one"]').evaluate((el) => el.getBoundingClientRect().top);
    expect(firstTitleTop).toBeGreaterThanOrEqual(coilBottom - 2);
    await page.locator('#work button[data-card="travel"]').tap();
    await expect(cardDialog(page, "travel")).toBeVisible({ timeout: 8000 });
  });
});
