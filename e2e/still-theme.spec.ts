import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { hasName, nameSamples, startNameSamples, type NameSample } from "./support/heroSamples";
import { noWebglContext } from "./support/webgl";

// The still path through a theme toggle (the Menu's control): the still
// carries the name only once the current theme's picture has decoded, so a
// toggle never leaves the hero without a name. The other theme's still is
// warmed once the first is in, so a toggle is usually instant; when it is
// not, the h1 lockup is the name until that theme's still decodes.

test.use({ colorScheme: "light" });

const menu = siteContent.menu;
const goneLoader = () => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone";
const runs = (samples: NameSample[]) => {
  const out: string[] = [];
  for (const s of samples) {
    const key = `${s.theme} ${s.ready ? "ready" : "-"}${s.late ? " late" : ""} still ${s.still.toFixed(2)}${s.stillReady ? "" : " (no pixels)"} h1 ${s.h1 ? s.h1Opacity.toFixed(2) : "hidden"}`;
    const last = out.at(-1);
    if (last?.startsWith(`${key} x`)) out[out.length - 1] = `${key} x${Number(last.split(" x").at(-1)) + 1}`;
    else out.push(`${key} x1`);
  }
  return out.join("; ");
};

async function stillShown(page: Page) {
  await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
  const still = page.locator("[data-hero-still]");
  await expect(still).toHaveAttribute("data-still-ready", "");
  await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
}

// Opens the Menu and toggles the theme while the hero is sampled every frame,
// from before the click until at least ms after the theme changed (the click
// itself may wait for the panel to settle).
async function toggleSampled(page: Page, to: "dark" | "light", ms: number) {
  const pill = page.getByRole("button", { name: menu.ariaLabelOpen });
  if (await pill.isVisible()) await pill.click();
  const toggle = page.getByRole("button", { name: to === "dark" ? menu.themeAriaLabelToDark : menu.themeAriaLabelToLight });
  await expect(toggle).toBeVisible();
  await startNameSamples(page, ms + 1500);
  await toggle.click();
  await page.waitForTimeout(ms + 1600);
  const samples = await nameSamples(page);
  test.info().annotations.push({ type: `toward ${to}, per frame`, description: runs(samples) });
  const after = samples.filter((s) => s.theme === to);
  expect(after.length, "frames sampled after the toggle").toBeGreaterThan(10);
  expect(after.at(-1)!.t - after[0].t, `the frames after the toggle span at least ${ms}ms`).toBeGreaterThanOrEqual(ms);
  return samples;
}

test("a theme toggle on the still path never leaves the hero without a name, either way", async ({ page }) => {
  await page.addInitScript(noWebglContext);
  await page.goto("/");
  await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
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
    const bare = samples.filter((s) => !hasName(s, 1));
    expect(bare.map((s) => `${s.t.toFixed(0)}ms ${s.theme}`), `frames toward ${to} with no name`).toEqual([]);
  }
  expect(warmed, "the dark still loaded before the first toggle").toBe(true);
});

test("a toggle to a theme whose still never loads keeps the h1 lockup as the name", async ({ page }) => {
  await page.route("**/coil/hero-dark-*", (route) => route.abort());
  await page.addInitScript(noWebglContext);
  await page.goto("/");
  await stillShown(page);
  const samples = await toggleSampled(page, "dark", 2000);
  const dark = samples.filter((s) => s.theme === "dark");
  const off = dark.filter((s) => s.ready || !s.h1 || s.h1Opacity !== 1);
  expect(off.map((s) => `${s.t.toFixed(0)}ms ready ${s.ready} h1 ${s.h1} ${s.h1Opacity}`), "dark frames without the h1 lockup at full opacity, or marked ready").toEqual([]);
  expect(samples.filter((s) => !hasName(s, 1)).length, "frames with no name").toBe(0);
  await expect(page.locator("[data-hero-still]")).not.toHaveAttribute("data-still-ready", "");
});
