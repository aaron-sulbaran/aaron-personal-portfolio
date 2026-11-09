import { test, expect } from "./support/fixtures";

// The security headers on a production build (lib/security/headers.mjs).

const PAGES = ["/", "/quick"];

test("security headers: enforced on pages, assets and 404s, with no x-powered-by", async ({ request }) => {
  const home = await (await request.get("/")).text();
  const chunk = home.match(/\/_next\/static\/[^"'\s]+\.js/)?.[0];
  expect(chunk).toBeTruthy();
  for (const path of [...PAGES, "/no-such-page-probe", chunk as string]) {
    const headers = (await request.get(path, { maxRedirects: 0 })).headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"], path).toBe("frame-ancestors 'self'");
    expect(headers["x-frame-options"], path).toBe("SAMEORIGIN");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});

// The hero lab frames /?embed=1 from this origin, so a same-origin frame must
// load. 127.0.0.1 and localhost are different origins on the same server, which
// stands in for another site trying to frame this one.
async function frameHome(page: import("@playwright/test").Page, from: string, src: string) {
  await page.goto(from);
  await page.evaluate((url) => {
    const frame = document.createElement("iframe");
    frame.src = url;
    frame.dataset.probe = "";
    document.body.append(frame);
  }, src);
}

test("security headers: this origin can frame the site and another origin cannot", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const refused: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("frame-ancestors")) refused.push(message.text());
  });

  await frameHome(page, `${origin}/quick`, `${origin}/?embed=1`);
  await page.waitForFunction(() => {
    const doc = document.querySelector<HTMLIFrameElement>("iframe[data-probe]")?.contentDocument;
    return doc?.readyState === "complete" && doc.location.search === "?embed=1";
  });
  expect(refused).toEqual([]);

  const other = origin.replace("localhost", "127.0.0.1");
  expect(other).not.toBe(origin);
  await frameHome(page, `${other}/quick`, `${origin}/?embed=1`);
  await expect.poll(() => refused.length).toBeGreaterThan(0);
  expect(refused[0]).toContain("frame-ancestors 'self'");
});
