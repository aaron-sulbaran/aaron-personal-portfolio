import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import { test, expect } from "./support/fixtures";
import { bubble, CALENDAR, DEF, MATCHA, MATCHA_HREF, openFixture, POP, productLink, rango, tabTo, TIP } from "./support/inline";
// The copy's inline links (components/inline) by mouse and keyboard, each on a
// lines-split Block; touch is e2e/inline-links-touch.spec.ts (the touch project).
const { register } = siteContent;
const shift = (page: Page) => bubble(page).evaluate((el) => (({ m41: x, m42: y }) => ({ x, y }))(new DOMMatrixReadOnly(getComputedStyle(el).transform)));
test("inline links: a tip follows a mouse with no render per move, leaves with it, and Escape hides it", async ({ page }) => {
  await openFixture(page, TIP);
  const box = (await rango(page).boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await expect(bubble(page)).toHaveAttribute("data-mode", "hover");
  await expect(bubble(page)).toHaveText(tipText("aango")!);
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("transform"); // the trail
  const before = await shift(page);
  await page.evaluate(() => {
    const w = Object.assign(window, { __tipMutations: 0 });
    new MutationObserver((records) => void (w.__tipMutations += records.length)).observe(document.querySelector("[data-inline-tip]")!, { childList: true, subtree: true, characterData: true });
  });
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 6 });
  // The label trails the pointer (an 80ms transform transition), so poll until it settles.
  await expect.poll(async () => Math.abs((await shift(page)).x - before.x - (box.width - 8))).toBeLessThanOrEqual(1);
  expect((await shift(page)).y).toBe(before.y);
  expect(await page.evaluate(() => (window as Window & { __tipMutations?: number }).__tipMutations)).toBe(0); // style writes are not child mutations
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 160);
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await rango(page).hover();
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links: keyboard focus anchors a tip under its link; Escape, Enter and Tab drive it", async ({ page }) => {
  await openFixture(page, TIP);
  await expect(rango(page)).toHaveAccessibleDescription(tipText("aango")!);
  await tabTo(page, rango(page));
  await expect(bubble(page)).toHaveAttribute("data-mode", "focus");
  await page.waitForTimeout(250);
  const link = (await rango(page).boundingBox())!;
  const tip = (await bubble(page).boundingBox())!;
  expect(tip.y).toBeGreaterThanOrEqual(link.y + link.height);
  expect(Math.abs(tip.x + tip.width / 2 - (link.x + link.width / 2))).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await expect(rango(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  await page.keyboard.press("Tab");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links: a photo pop holds its photo, or its caption until the photo lands", async ({ page }) => {
  await openFixture(page, POP);
  const entry = register.pop["contrabass-clarinet"];
  const link = page.locator('[data-inline="pop"][data-inline-key="contrabass-clarinet"]');
  await expect(link).toHaveAccessibleDescription([entry.alt, entry.caption].filter(Boolean).join(". "));
  await link.hover();
  await expect(bubble(page)).toContainText(entry.caption!);
  if (entry.file) await expect(bubble(page).locator("img")).toHaveAttribute("alt", entry.alt);
  else await expect(bubble(page).locator("img")).toHaveCount(0);
});
test("inline links: the matcha shows its pop on hover and opens the Maps pin in a new tab on click", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  const link = page.getByRole("link", { name: "or matcha" });
  await expect(link).toHaveAttribute("href", MATCHA_HREF);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await link.hover();
  await expect(bubble(page)).toContainText(register.pop.matcha.caption!);
  await expect(bubble(page).getByText(register.pop.matcha.hrefLabel!)).toHaveCount(0);
  const popup = page.waitForEvent("popup");
  await link.click();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
});
test("inline links: every link is a named button or link, the footnote included; the label stays out of the tree", async ({ page }) => {
  await openFixture(page, MATCHA, CALENDAR, TIP, DEF);
  await expect(page.getByRole("button", { name: siteContent.inline.symbolLabel })).toHaveAccessibleDescription(tipText("killer-drones")!);
  await expect(page.getByRole("link", { name: "grab a time on my calendar" })).toHaveAttribute("rel", "noopener noreferrer");
  const tags = await page.locator("main [data-inline]").evaluateAll((els) => els.map((el) => el.tagName));
  expect(tags).toHaveLength(5);
  expect(tags.every((tag) => tag === "A" || tag === "BUTTON")).toBe(true);
  await expect(bubble(page)).toHaveAttribute("aria-hidden", "true");
});
test("inline links: a definition opens the house text modal by mouse; Escape closes it and focus returns", async ({ page }) => {
  const link = await productLink(page);
  await expect(link).toHaveAttribute("aria-haspopup", "dialog");
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toContainText(register.def.product.body);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});
test("inline links: a definition opens from the keyboard, holds focus inside, and returns it", async ({ page }) => {
  const link = await productLink(page);
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  const close = dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});
test("inline links: focus returns to the product link even when its line was rebuilt", async ({ page }) => {
  const link = await productLink(page);
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const old = document.querySelector('[data-inline="def"][data-inline-key="product"]')!;
    old.replaceWith(old.cloneNode(true)); // what a SplitText revert does to the node
  });
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-inline="def"][data-inline-key="product"]').first()).toBeFocused();
});
test("inline links: focus comes home when the line is rebuilt after the definition closes", async ({ page }) => {
  const link = await productLink(page);
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const old = document.querySelector('[data-inline="def"][data-inline-key="product"]')!;
    old.replaceWith(old.cloneNode(true)); // a font landing late re-splits the line like this
  });
  await expect(page.locator('[data-inline="def"][data-inline-key="product"]').first()).toBeFocused();
});
