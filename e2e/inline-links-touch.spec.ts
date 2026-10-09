import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { bubble, fillOf, MATCHA, MATCHA_HREF, openFixture, productLink, tipLink, TIP } from "./support/inline";

// The inline links on a phone. The touch project (playwright.config.ts) runs
// this file as a Pixel 7 with touch; chromium, webkit and firefox skip it.
const { register } = siteContent;

test("inline links (touch): a tap pins a tip under its link and a tap elsewhere lets it go", async ({ page }) => {
  await openFixture(page, TIP);
  await tipLink(page).tap();
  await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
  await expect(tipLink(page)).toHaveAttribute("data-inline-open", "");
  await expect.poll(() => fillOf(tipLink(page))).toBe(1);
  await page.waitForTimeout(250);
  const link = (await tipLink(page).boundingBox())!;
  expect((await bubble(page).boundingBox())!.y).toBeGreaterThanOrEqual(link.y + link.height);
  await page.locator("main").tap({ position: { x: 4, y: 4 } });
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await expect(tipLink(page)).not.toHaveAttribute("data-inline-open", "");
  // A tap is a click: the link stays filled, like a visited one.
  expect(await fillOf(tipLink(page))).toBe(1);
});

test("inline links (touch): a link never tapped stays empty on a touch screen, and a tap marks it for the next visit", async ({ page }) => {
  await openFixture(page, TIP);
  expect(await fillOf(tipLink(page))).toBe(0);
  await tipLink(page).tap();
  await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
  expect(await page.evaluate(() => localStorage.getItem("aaron-inline-visited"))).toBe(JSON.stringify(["tip:killer-drones"]));
});

test("inline links (touch): the first tap on the matcha shows its pop and Maps link; that link opens the pin", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  let popups = 0;
  page.on("popup", () => void (popups += 1));
  await page.getByRole("link", { name: "or matcha" }).tap();
  const maps = bubble(page).getByText(register.pop.matcha.hrefLabel!);
  await expect(maps).toBeVisible();
  await page.waitForTimeout(300);
  expect(popups).toBe(0);
  const popup = page.waitForEvent("popup");
  await maps.tap();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
});

test("inline links (touch): a second tap on the matcha follows its href and lets the label go", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  const link = page.getByRole("link", { name: "or matcha" });
  await link.tap();
  await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
  const popup = page.waitForEvent("popup");
  await link.tap();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});

test("inline links (touch): a tap opens the definition and its close button closes it", async ({ page }) => {
  await (await productLink(page)).tap();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).tap();
  await expect(dialog).toBeHidden();
});
