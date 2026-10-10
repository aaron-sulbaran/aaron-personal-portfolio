import { test, expect } from "./support/fixtures";

// The site's public routes after the placeholder sweep: the home document, the
// anchors the old pages fold into, and nothing else in the sitemap.

for (const [from, to] of [["/work", "/#work"], ["/work/capital-one-pm", "/#work"], ["/about", "/#about"]] as const) {
  test(`routes: ${from} sends visitors to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe(to);
  });
}

test("routes: the logo files under /work/logos are still served", async ({ request }) => {
  const response = await request.get("/work/logos/talos/mark.svg", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
});

test("routes: the sitemap lists the home page alone", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml.match(/<loc>/g)).toHaveLength(1);
  expect(xml).not.toContain("/work/");
});

test("routes: the home page requests nothing that is gone", async ({ page }) => {
  const missing: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 404) missing.push(response.url());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(missing).toEqual([]);
});
