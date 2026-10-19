import { test, expect } from "./support/fixtures";

// The site's public routes: the home document, the quick page, and the
// anchors the old pages fold into.

for (const [from, to] of [
  ["/work", "/#work"],
  ["/work/capital-one-pm", "/#work"],
  ["/about", "/#about"],
  ["/express", "/quick"],
  ["/simple", "/quick"],
  ["/recruiter", "/quick"],
] as const) {
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

test("routes: the sitemap lists the home page and the quick page", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml.match(/<loc>/g)).toHaveLength(2);
  expect(xml).toContain("/quick");
  expect(xml).not.toContain("/work/");
});

// Vercel Web Analytics serves /_vercel/insights/script.js only on Vercel, so a
// local production server answers it 404 and the page carries on.
test("routes: the home page requests nothing that is gone", async ({ page }) => {
  const missing: string[] = [];
  page.on("response", (response) => {
    const isVercelInsights = new URL(response.url()).pathname.startsWith("/_vercel/insights/");
    if (response.status() === 404 && !isVercelInsights) missing.push(response.url());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(missing).toEqual([]);
});
