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
    expect(headers["content-security-policy"], path).toBe("frame-ancestors 'none'");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});
