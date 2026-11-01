import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { bubble, fillOf, MATCHA, MATCHA_HREF, openFixture, PRODUCT_POPS, productLink, productPop, tipLink, TIP } from "./support/inline";

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
  // The tap showed its tip, which is what discovers a word: the link stays filled.
  expect(await fillOf(tipLink(page))).toBe(1);
});

test("inline links (touch): a word never tapped stays empty on a touch screen, and the tap that shows its tip marks it for the next visit", async ({ page }) => {
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

test("inline links (touch): a tap pins a tip that holds a link, shows the link, and the link opens a new tab", async ({ page, offsite }) => {
  await openFixture(page, "My gamer tag growing up: [VoltaageArc](tip:voltaage).");
  await page.getByRole("button", { name: "VoltaageArc" }).tap();
  await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
  const link = bubble(page).getByRole("link", { name: /VoltaageArc on most platforms/ });
  await expect(link).toBeVisible();
  await page.waitForTimeout(300);
  const popup = page.waitForEvent("popup");
  await link.tap();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(register.tip.voltaage.link!.href);
});

test("inline links (touch): a tap on an inner pop of the open definition pins its photo above the panel and inside the screen; the panel stays open", async ({ page }) => {
  await (await productLink(page)).tap();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  for (const { key } of PRODUCT_POPS) {
    await productPop(dialog, key).tap();
    await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
    await expect(bubble(page)).toHaveAttribute("data-target", `pop:${key}`);
    await page.waitForTimeout(350);
    const read = await bubble(page).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const was = (el as HTMLElement).style.pointerEvents;
      (el as HTMLElement).style.pointerEvents = "auto"; // the label takes no pointer unless it holds a link; let it be hit for this one reading
      const mid = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      (el as HTMLElement).style.pointerEvents = was;
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight, topmost: !!mid && el.contains(mid) };
    });
    expect(read.left).toBeGreaterThanOrEqual(0);
    expect(read.top).toBeGreaterThanOrEqual(0);
    expect(read.right).toBeLessThanOrEqual(read.width);
    expect(read.bottom).toBeLessThanOrEqual(read.height);
    expect(read.topmost, "drawn above the panel").toBe(true);
    await expect(dialog).toBeVisible();
    // A tap on the panel's own words lets the pin go and leaves the panel open.
    await dialog.locator("[data-definition-body] p").nth(1).tap({ position: { x: 6, y: 6 } });
    await expect(bubble(page)).toHaveAttribute("data-shown", "false");
    await expect(dialog).toBeVisible();
  }
  // The same pop tapped twice lets go of its own pin.
  await productPop(dialog, "tool-user").tap();
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  await productPop(dialog, "tool-user").tap();
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await expect(dialog).toBeVisible();
});
