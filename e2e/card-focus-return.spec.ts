import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { coilPoints, nextFrames, openHome, waitForCoil, waitForCoilSettled } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { panelAtRest } from "./support/cards";

// Closing a card's modal never moves the page (found on a phone, 2026-10-30): Deal me in keeps focus through the deal, a card opened from
// the Coil's canvas (which has nothing to focus) left it there, and the dialog's focus return scrolled back up to it, 499px, to page 1's
// foot. Now focus returns to what opened the modal (the title or list row clicked, or for a Coil card its title in the columns), and no
// return ever scrolls the page.

const dialogOf = (page: Page) => page.locator('[role="dialog"][data-card-modal]');

// Deal me in from page 1's foot, as a visitor does, and wait for the dealt, settled Coil. The control keeps focus through the deal (a
// click on a link focuses it; a tap may not, so the test puts focus there as a click would, never scrolling).
async function dealIn(page: Page, tap: boolean) {
  await openHome(page, { at: "foot" });
  const deal = page.locator("[data-deal-button]");
  if (tap) await deal.tap();
  else await deal.click();
  await waitForCoil(page);
  await waitForCoilSettled(page);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>("[data-deal-button]");
    if (button && document.activeElement !== button) button.focus({ preventScroll: true });
  });
  expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-deal-button")), "Deal me in holds focus after the deal").toBe(true);
}

// Closes the open modal with its close button and waits for it (and any card flying home) to be gone, and the page to rest.
async function close(page: Page, tap: boolean) {
  const button = dialogOf(page).getByRole("button", { name: siteContent.modals.closeAriaLabel, exact: true });
  if (tap) await button.tap();
  else await button.click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0, { timeout: 5000 });
  await nextFrames(page, 6);
}

// The page did not move, and focus sits on the opened card's title in the columns, the next Tab going on from there.
async function expectReturned(page: Page, key: string, before: number) {
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before), "the page did not move").toBeLessThanOrEqual(1);
  expect(await page.evaluate((k) => document.activeElement?.matches(`#work button[data-card="${k}"]`) ?? false, key), "focus on the card's title").toBe(true);
  await page.keyboard.press("Tab");
  const order = await page.evaluate((k) => {
    const title = document.querySelector(`#work button[data-card="${k}"]`)!;
    const now = document.activeElement;
    return !!now && now !== document.body && !!(title.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, key);
  expect(order, "Tab goes on from the title, not back to page 1").toBe(true);
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("card focus: after Deal me in, a card tapped in the Coil closes with the page where it was, focus on its title", async ({ page }) => {
    await dealIn(page, true);
    const before = await page.evaluate(() => window.scrollY);
    const { card } = await coilPoints(page);
    await page.touchscreen.tap(card.x, card.y);
    await expect(dialogOf(page)).toBeVisible();
    const key = (await dialogOf(page).getAttribute("data-card-modal"))!;
    await panelAtRest(page, key as never);
    await close(page, true);
    await expectReturned(page, key, before);
  });
});

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("card focus: after Deal me in, a card clicked in the Coil flies, and closes with the page where it was, focus on its title", async ({ page }) => {
    await dealIn(page, false);
    const before = await page.evaluate(() => window.scrollY);
    const { card } = await coilPoints(page);
    await page.mouse.move(card.x, card.y, { steps: 4 });
    await page.waitForFunction(() => (window as HookWindow).__coil!.hovered() >= 0, null, { timeout: 5000 });
    await page.mouse.click(card.x, card.y);
    await expect(dialogOf(page)).toBeVisible();
    const key = (await dialogOf(page).getAttribute("data-card-modal"))!;
    await panelAtRest(page, key as never);
    await close(page, false);
    await expectReturned(page, key, before);
  });

  test("card focus: under reduced motion, a card opened from its title after Deal me in closes with the page where it was, focus on the title", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.home === "ready");
    const deal = page.locator("[data-deal-button]");
    await deal.scrollIntoViewIfNeeded();
    await deal.click();
    await page.waitForFunction(() => (document.getElementById("work")?.getBoundingClientRect().top ?? 1e9) < window.innerHeight);
    await nextFrames(page, 4);
    const title = page.locator('#work button[data-card="capital-one"]');
    await title.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await title.click();
    await expect(dialogOf(page)).toBeVisible();
    await panelAtRest(page, "capital-one");
    await close(page, false);
    await expectReturned(page, "capital-one", before);
  });
});
