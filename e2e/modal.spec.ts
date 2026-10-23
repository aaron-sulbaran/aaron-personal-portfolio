import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { cardRow } from "./support/cards";
import { openHome } from "./support/coil";

// A title from the keyboard: Enter opens its modal, the close button closes
// it, focus comes back to the title, and the title is marked seen (one store
// with the Coil): its dot, a spoken "seen" and the saved set, with the title's
// own ink unchanged (the dim a seen row used to take is gone).

test("modal: Enter on a title opens it, Close closes it, focus returns and the title carries the seen dot", async ({ page }) => {
  await openHome(page);
  const title = cardRow(page, "mentorship");
  await title.scrollIntoViewIfNeeded();
  await title.focus();
  await expect(title.locator("[data-seen-dot]")).toHaveCount(0);

  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Mentorship", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(title).toBeFocused();
  await expect(title.locator("[data-seen-dot]")).toHaveCount(1);
  await expect(title).toContainText(siteContent.columns.seenLabel);
  expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "[]"), SEEN_STORAGE_KEY)).toContain("mentorship");

  // Seen or not, a title keeps its full ink once focus and hover leave it.
  await page.locator("body").evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(5, 5);
  const ink = (key: "mentorship" | "band") => cardRow(page, key).evaluate((el) => getComputedStyle(el).color + getComputedStyle(el).opacity);
  expect(await ink("mentorship")).toBe(await ink("band"));
});
