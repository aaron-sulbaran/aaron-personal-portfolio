import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { settled } from "./support/fallback";
import { startStillSamples, stillIsWhole, stillSamples, type StillSample } from "./support/heroSamples";
import { noWebglContext } from "./support/webgl";

// The still path through a theme toggle (the Menu's control): the still shows
// only once the current theme's picture has decoded (until then its box waits
// at opacity 0 over the field poster), so a toggle never paints a half-decoded
// picture. The other theme's still is warmed once the first is in, so a toggle
// is usually instant; when it is not, the field poster carries the stage until
// that theme's still decodes. Page 1's name is live text throughout.

test.use({ colorScheme: "light" });

const menu = siteContent.menu;
const runs = (samples: StillSample[]) => {
  const out: string[] = [];
  for (const s of samples) {
    const key = `${s.theme} ${s.ready ? "ready" : "-"}${s.late ? " late" : ""} still ${s.shown.toFixed(2)}${s.pixels ? "" : " (no pixels)"}`;
    const last = out.at(-1);
    if (last?.startsWith(`${key} x`)) out[out.length - 1] = `${key} x${Number(last.split(" x").at(-1)) + 1}`;
    else out.push(`${key} x1`);
  }
  return out.join("; ");
};

async function stillShown(page: Page) {
  await settled(page);
  const still = page.locator("[data-hero-still]");
  await expect(still).toHaveAttribute("data-still-ready", "");
  await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
}

// Opens the Menu and toggles the theme while the still is sampled every frame,
// from before the click until at least ms after the theme changed (the click
// itself may wait for the panel to settle).
async function toggleSampled(page: Page, to: "dark" | "light", ms: number) {
  const pill = page.getByRole("button", { name: menu.ariaLabelOpen });
  if (await pill.isVisible()) await pill.click();
  const toggle = page.getByRole("button", { name: to === "dark" ? menu.themeAriaLabelToDark : menu.themeAriaLabelToLight });
  await expect(toggle).toBeVisible();
  await startStillSamples(page, ms + 1500);
  await toggle.click();
  await page.waitForTimeout(ms + 1600);
  const samples = await stillSamples(page);
  test.info().annotations.push({ type: `toward ${to}, per frame`, description: runs(samples) });
  const after = samples.filter((s) => s.theme === to);
  expect(after.length, "frames sampled after the toggle").toBeGreaterThan(10);
  expect(after.at(-1)!.t - after[0].t, `the frames after the toggle span at least ${ms}ms`).toBeGreaterThanOrEqual(ms);
  return samples;
}

test("a theme toggle on the still path never paints a still that is not decoded, either way, and the still is back at full opacity", async ({ page }) => {
  await page.addInitScript(noWebglContext);
  await page.goto("/");
  await settled(page);
  await page.reload();
  await stillShown(page);
  // The dark still warmed once the light one was in: its picture's img loaded ahead of any toggle.
  const warmed = await page
    .waitForFunction(() => {
      const img = document.querySelectorAll<HTMLImageElement>("[data-hero-still] img")[1];
      return img.complete && img.naturalWidth > 0;
    }, null, { timeout: 5000 })
    .then(() => true, () => false);
  for (const to of ["dark", "light"] as const) {
    const samples = await toggleSampled(page, to, 1500);
    const torn = samples.filter((s) => !stillIsWhole(s));
    expect(torn.map((s) => `${s.t.toFixed(0)}ms ${s.theme} ready ${s.ready} shown ${s.shown}`), `frames toward ${to} showing a still that is not whole`).toEqual([]);
    const last = samples.at(-1)!;
    expect(last.theme).toBe(to);
    expect(last.shown, `the ${to} still at full opacity at the end`).toBe(1);
  }
  expect(warmed, "the dark still loaded before the first toggle").toBe(true);
});

test("a toggle to a theme whose still never loads leaves the field poster and live text, never a half-decoded still", async ({ page }) => {
  await page.route("**/coil/hero-dark-*", (route) => route.abort());
  await page.addInitScript(noWebglContext);
  await page.goto("/");
  await stillShown(page);
  const samples = await toggleSampled(page, "dark", 2000);
  const dark = samples.filter((s) => s.theme === "dark");
  const shown = dark.filter((s) => s.ready || s.shown > 0);
  expect(shown.map((s) => `${s.t.toFixed(0)}ms ready ${s.ready} shown ${s.shown}`), "dark frames with the still marked ready or showing").toEqual([]);
  await expect(page.locator("[data-hero-still]")).not.toHaveAttribute("data-still-ready", "");
  await expect(page.locator("[data-coil-poster]")).toBeAttached();
  // Page 1's name is untouched: still the page's live h1.
  await expect(page.getByRole("heading", { level: 1, name: siteContent.hero.heading, exact: true })).toBeVisible();
});
