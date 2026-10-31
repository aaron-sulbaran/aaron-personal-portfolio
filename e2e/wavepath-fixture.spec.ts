import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { openHome, scrollToY } from "./support/coil";
import { pageRects, pageSettled, parkBand } from "./support/wave";
import type { PathProbe } from "@/lib/wavepath/probe";

// Writes the page the wave's unit checks run on (lib/wavepath/fixtures/layout.json): at each size, the anchors the page lays the
// line on and every line of text, link and control as the browser drew them, after the deal and a walk down the page. Runs only
// with WAVE_LAYOUT_OUT set to the file to write (sizes merge into it), so a copy or layout change is one command away:
//   WAVE_LAYOUT_OUT=lib/wavepath/fixtures/layout.json E2E_NO_BUILD=1 pnpm exec playwright test e2e/wavepath-fixture.spec.ts
// Phones are measured as phones (touch, a coarse pointer, device scale 3): page 1's line reads differently under a fine pointer.
const OUT = process.env.WAVE_LAYOUT_OUT;
type W = Window & { __wavePath: PathProbe };
const SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function measure(page: Page) {
  await openHome(page, { path: "/?wavedebug" });
  await parkBand(page);
  await page.locator("#listen").getByRole("button", { name: siteContent.listen.decline, exact: true }).click();
  const end = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const vh = page.viewportSize()!.height;
  for (let y = 0; y <= end; y += Math.round(vh * 0.6)) {
    await scrollToY(page, y);
    await page.waitForTimeout(250);
  }
  await scrollToY(page, 0);
  await pageSettled(page);
  const before = await page.evaluate(() => (window as unknown as W).__wavePath.layouts);
  await page.evaluate(() => window.dispatchEvent(new Event("wavepath:relayout")));
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__wavePath.layouts)).toBeGreaterThan(before);
  await pageSettled(page);
  const layout = await page.evaluate(() => (window as unknown as W).__wavePath.layout!);
  const cards = await page.evaluate((origin) => {
    const r = document.getElementById("work")!.getBoundingClientRect();
    return { top: r.top + window.scrollY - origin, bottom: r.bottom + window.scrollY - origin };
  }, layout.origin);
  return { viewport: layout.viewport, anchors: layout.anchors, cards, ...(await pageRects(page)) };
}

for (const size of SIZES) {
  const phone = size.width < 600;
  test.describe(`wavepath fixture ${size.width}x${size.height}`, () => {
    test.use({ viewport: size, deviceScaleFactor: phone ? 3 : 1, hasTouch: phone, isMobile: phone });
    test(`measures the page at ${size.width}x${size.height}`, async ({ page }) => {
      test.skip(!OUT, "set WAVE_LAYOUT_OUT to write the fixture");
      test.setTimeout(180_000);
      const measured = await measure(page);
      const all = existsSync(OUT!) ? JSON.parse(readFileSync(OUT!, "utf8")) : {};
      all[`${size.width}x${size.height}`] = measured;
      const ordered = Object.fromEntries(SIZES.map((s) => `${s.width}x${s.height}`).filter((k) => all[k]).map((k) => [k, all[k]]));
      writeFileSync(OUT!, `${JSON.stringify(ordered)}\n`);
    });
  });
}
