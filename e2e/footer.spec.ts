import { siteContent } from "@/lib/content";
import { bandShare } from "@/lib/footer/geometry";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome } from "./support/coil";
import { FOOTER, footerBoxes, toFooter } from "./support/footer";

// The footer (slice C6): the server's small lines and reserved band, the
// wordmark at rest and its egg, the field's chunk and its fallbacks.

const C = siteContent.footer;
const SHARE = bandShare(C.wordmark);
const LINES_ROW = 180; // the small lines' row from md: the footer lab's Connect row (pt-20 plus 100px)

// ---- Task 7: the shell ----

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("footer: the server reserves the word's band under the small lines", async ({ page }) => {
    await page.goto("/");
    const b = await footerBoxes(page);
    expect(b.band.height).toBeCloseTo(SHARE * b.width, 0);
    expect(b.lines.height).toBeCloseTo(LINES_ROW, 0);
    expect(b.height).toBeCloseTo(LINES_ROW + SHARE * b.width, 0);
    const footer = page.locator(FOOTER);
    await expect(footer.getByText(C.tagline(""), { exact: false })).toBeVisible();
    await expect(footer.getByText(C.copyright, { exact: true })).toBeVisible();
    await expect(footer.getByText(C.wordmark, { exact: true })).toBeAttached();
  });
});

test("footer: the word mounts into its band, so nothing below Connect moves", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await nextFrames(page, 30); // Task 8: the word at rest
  const b = await footerBoxes(page);
  expect(b.band.height).toBeCloseTo(SHARE * b.width, 0);
  expect(b.height).toBeCloseTo(LINES_ROW + SHARE * b.width, 0);
  expect(b.lines.top).toBeCloseTo(0, 0);
});

test("footer: from its first layout to the word at rest, the footer never changes height", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __footerHeights: number[] };
    w.__footerHeights = [];
    const watch = () => {
      const footer = document.querySelector("footer[data-footer]");
      if (!footer) return false;
      new ResizeObserver((entries) => entries.forEach((e) => w.__footerHeights.push(e.borderBoxSize[0].blockSize))).observe(footer);
      return true;
    };
    if (!watch()) {
      const mo = new MutationObserver(() => watch() && mo.disconnect());
      mo.observe(document, { childList: true, subtree: true });
    }
  });
  await openHome(page);
  await toFooter(page);
  await nextFrames(page, 30); // Task 8: the word at rest
  const heights = await page.evaluate(() => (window as unknown as { __footerHeights: number[] }).__footerHeights);
  expect(heights.length).toBeGreaterThan(0);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.5);
});
