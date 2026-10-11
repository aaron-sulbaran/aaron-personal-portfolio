import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";

// The holding build (opt-in site mode, built with NEXT_PUBLIC_SITE_MODE=holding):
// the holding page at /, none of the full site's chrome, no scene chunk, and
// old case page URLs sent home.

test("holding: / is the holding page, with no bar, no pill and no scene chunk", async ({ page }) => {
  const scripts = watchScripts(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pardon the dust");
  await expect(page.getByRole("list", { name: "Where to find me" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  await expect(page.locator("section[data-scene]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
});

test("holding: an old case page URL redirects home", async ({ page }) => {
  const response = await page.goto("/work/capital-one-pm");
  expect(new URL(page.url()).pathname).toBe("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pardon the dust");
});

test("holding: the share card is the name alone, with no still from the unfinished site", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16), "width").toBe(1200);
  expect(body.readUInt32BE(20), "height").toBe(630);
  expect(body.length, "holding card bytes").toBeLessThan(80_000);
});
