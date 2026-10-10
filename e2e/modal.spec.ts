import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { test, expect } from "./support/fixtures";
import { cardRow } from "./support/cards";
import { openHome } from "./support/coil";

// A book row from the keyboard: Enter opens its modal, the close button
// closes it, focus comes back to the row, and the row is marked seen (one
// store with the coil) with its title dimmed once focus and hover leave it.

test("modal: Enter on a book row opens it, Close closes it, focus returns and the row reads as seen", async ({ page }) => {
  await openHome(page);
  const row = cardRow(page, "mentorship");
  await row.scrollIntoViewIfNeeded();
  await row.focus();

  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Mentorship", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
  await expect(row).toContainText("opened");
  expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "[]"), SEEN_STORAGE_KEY)).toContain("mentorship");

  // Seen titles sit at the dim a hovered list gives its other rows, and come
  // back to full ink under focus or hover; so move both away first.
  await page.locator("body").evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(5, 5);
  const title = row.locator("span").first().locator("span").first();
  await expect.poll(() => title.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeCloseTo(0.55, 2);
  const unseen = cardRow(page, "band").locator("span").first().locator("span").first();
  expect(await unseen.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});
