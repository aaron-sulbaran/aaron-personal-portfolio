import { test, expect } from "./support/fixtures";

// The share card: og:image and twitter:image are absolute URLs on the real
// domain, and the route they name serves a 1200 by 630 PNG built from the hero
// still (the holding build serves the name alone, see holding.spec.ts).

test("social card: the head names a PNG for og and twitter, and the route serves it", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const twitter = await page.locator('meta[name="twitter:image"]').getAttribute("content");
  expect(og).toMatch(/^https:\/\/aaronsulbaran\.com\/opengraph-image/);
  expect(twitter).toBe(og);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");

  const local = new URL(og as string);
  const response = await request.get(`${local.pathname}${local.search}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.subarray(1, 4).toString()).toBe("PNG");
  expect(body.readUInt32BE(16), "width").toBe(1200);
  expect(body.readUInt32BE(20), "height").toBe(630);
  // The still carries the cards; the name-only card is a tenth of this.
  expect(body.length, "full card bytes").toBeGreaterThan(150_000);
});
