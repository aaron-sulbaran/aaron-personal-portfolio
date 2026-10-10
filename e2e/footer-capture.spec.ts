import { siteContent } from "@/lib/content";
import { test } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { FOOTER, toFooter, waitForField, waitForWord } from "./support/footer";

// Manual captures for the PR (FOOTER_CAPTURE=1): the footer at 1440 by 900
// and 390 by 844 in both themes, and the egg's sequence at 1440, written to
// test-results/ (gitignored). The pointer rests outside the footer, so no
// swell or cursor ring is in a shot.

const C = siteContent.footer;

test("capture: the footer in both themes at both sizes, and the egg", async ({ page }) => {
  test.skip(process.env.FOOTER_CAPTURE !== "1", "manual capture");
  test.setTimeout(180_000);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await openHome(page);
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await toFooter(page);
      await waitForField(page, "gl");
      await waitForWord(page);
      await page.mouse.move(2, 2);
      await nextFrames(page, 10);
      await page.screenshot({ path: `test-results/footer-${theme}-${size.width}.png` });
    }
    // Back to the top, so the next size's load is not a deep reload (lib/home/recovery.ts) that skips the hero.
    await scrollToY(page, 0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await toFooter(page);
  await waitForWord(page);
  const footer = page.locator(FOOTER);
  const start = Date.now();
  await page.getByRole("button", { name: C.dropPeriod }).click();
  await page.mouse.move(2, 2);
  for (const at of [60, 200, 330, 450, 600, 680, 800, 1100]) {
    const wait = at - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
    await footer.screenshot({ path: `test-results/footer-egg-${String(Date.now() - start).padStart(4, "0")}ms.png` });
  }
});
