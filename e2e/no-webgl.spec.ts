import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import { expectStillHeroAndUsableBook, settled, watchHydration } from "./support/fallback";
import { MUTED_ARGS } from "./support/launch";
import { noWebgl2Api, noWebglContext } from "./support/webgl";
import type { HookWindow } from "./support/hooks";

// No WebGL: a browser launched without the GPU, and WebGL taken away in the
// page, the two ways a visitor's browser can lack it. The hero still, the
// hidden h1 and the book carry the page, and the scene's chunk is never fetched.

test.use({ launchOptions: { args: [...MUTED_ARGS, "--disable-gpu"] } });

test("a browser without WebGL 2 never fetches the scene chunk", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  const scripts = watchScripts(page);
  const hydration = watchHydration(page);
  await page.goto("/");
  await settled(page);

  await expectStillHeroAndUsableBook(page);
  expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
  expect(hydration).toEqual([]);
});

test("a context that cannot be created never fetches the scene chunk", async ({ page }) => {
  await page.addInitScript(noWebglContext);
  const scripts = watchScripts(page);
  const hydration = watchHydration(page);
  await page.goto("/");
  await settled(page);

  await expectStillHeroAndUsableBook(page);
  expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
  expect(hydration).toEqual([]);
});

test("stills that never load: the h1 carries the hero", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/coil/hero-*", (route) => route.abort());
  await page.addInitScript(noWebglContext);
  await page.goto("/?coildebug=1");
  await settled(page);
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
  expect(await page.locator("[data-hero-still]").getAttribute("data-still-ready")).toBeNull();
  const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
  expect(events).toContain("still-failed");
  expect(events).not.toContain("dissolve");
  const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading });
  await expect.poll(() => h1.evaluate((el) => el.getBoundingClientRect().width > 1 && el.checkVisibility({ opacityProperty: true }))).toBe(true);
  expect(errors).toEqual([]);
});

test("a deep reload with no WebGL 2 shows the still at full opacity", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  // lib/scroll.ts's saved position, past half a viewport: the fast start.
  await page.addInitScript(() => sessionStorage.setItem("aps:home-scroll-y", String(window.innerHeight * 2)));
  await page.goto("/");
  await settled(page);
  const still = page.locator("[data-hero-still]");
  await expect(still).toHaveAttribute("data-still-ready", "");
  await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

for (const [width, height, cut] of [[390, 844, "narrow"], [800, 1000, "square"], [1000, 1000, "square"], [1440, 900, "wide"]] as const) {
  test(`the still's cut at ${width}x${height} is ${cut}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(noWebgl2Api);
    await page.goto("/");
    await settled(page);
    const img = page.locator("[data-hero-still] img").filter({ visible: true });
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(new RegExp(`-${cut}\\.avif$`));
  });
}
