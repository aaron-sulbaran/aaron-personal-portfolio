import { expect, test } from "@playwright/test";

// /splits is the share alias for /speedrun (next.config.mjs, app/splits).
// X's crawler gets a 200 page with the Splits card; everyone else gets a 307.
const CARD = "https://aaronsulbaran.com/speedrun/splits-card.png";
const metaContents = (html: string, attr: "property" | "name", key: string) =>
  [...html.matchAll(/<meta\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => new RegExp(`${attr}="${key}"`).test(tag))
    .map((tag) => /content="([^"]*)"/.exec(tag)?.[1]);

test("X's crawler reads a 200 page carrying the Splits card, not a redirect", async ({ request }) => {
  const res = await request.get("/splits", { headers: { "user-agent": "Twitterbot/1.0" }, maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(metaContents(html, "property", "og:image")).toEqual([CARD]);
  expect(metaContents(html, "name", "twitter:image")).toEqual([CARD]);
  expect(metaContents(html, "name", "twitter:card")).toEqual(["summary_large_image"]);
  expect(metaContents(html, "property", "og:url")).toEqual(["https://aaronsulbaran.com/splits"]);
  expect(html).not.toMatch(/http-equiv="refresh"/i);
});

test("everyone else is sent on to /speedrun with a temporary redirect", async ({ request }) => {
  const chrome =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const res = await request.get("/splits", { headers: { "user-agent": chrome }, maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/\/speedrun$/);
});
