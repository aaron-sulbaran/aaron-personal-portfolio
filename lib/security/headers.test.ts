import { AsyncLocalStorage } from "node:async_hooks";
import { describe, expect, it } from "vitest";

// The security headers as next.config.mjs serves them, run through Next's own
// custom-routes logic. Next's server modules expect the AsyncLocalStorage
// global that `next start` sets up, so it is set before they load.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
const { unstable_getResponseFromNextConfig } = await import("next/experimental/testing/server");
const { default: nextConfig } = await import("../../next.config.mjs");

describe("security headers", () => {
  it("ride on every response: pages, the private route, assets and 404s", async () => {
    for (const url of ["/", "/quick", "/_next/static/chunks/app.js", "/photos/cards/x.avif", "/no-such-page"]) {
      const response = await unstable_getResponseFromNextConfig({ url: `https://aaronsulbaran.com${url}`, nextConfig });
      const headers = response.headers;
      expect(headers.get("x-content-type-options"), url).toBe("nosniff");
      expect(headers.get("referrer-policy"), url).toBe("strict-origin-when-cross-origin");
      expect(headers.get("content-security-policy"), url).toBe("frame-ancestors 'none'");
      expect(headers.get("x-frame-options"), url).toBe("DENY");
      expect(headers.get("permissions-policy"), url).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    }
  });

  it("drop the x-powered-by header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
