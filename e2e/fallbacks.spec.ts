import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { watchScripts } from "./support/chunks";
import { expectStillHeroAndUsableBook, settled, watchHydration } from "./support/fallback";
import { heroSamples, sampleHero } from "./support/heroSamples";

// The hero without its scene: reduced motion, a scene that throws, and a
// browser with no WebGL. The hero still, the h1 lockup in front of it and the
// book carry the page, and the scene's chunk (three) is never fetched where
// it could not run.

test("control: a normal load fetches the scene chunk, never the hero still, and never reports still", async ({ page }) => {
  const scripts = watchScripts(page);
  const stills: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/coil/hero-")) stills.push(request.url());
  });
  await sampleHero(page);
  await openHome(page);
  expect(await scripts.sceneChunks()).toHaveLength(1);
  expect(stills, "hero still requests with a scene").toEqual([]);
  expect((await heroSamples(page)).filter((s) => s.scene === "still"), "frames reporting still").toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("no canvas and no scene chunk: no resting lockup, the h1 lockup from first paint, the hero still and the book", async ({ page }) => {
    const scripts = watchScripts(page);
    const hydration = watchHydration(page);
    await sampleHero(page);
    await page.goto("/");
    await settled(page);

    await expectStillHeroAndUsableBook(page);
    expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
    expect(hydration).toEqual([]);
    // Reduced motion has no resting lockup and nothing holds the h1: the h1
    // lockup is the greeting from the first frame, under the loader's fade.
    const samples = (await heroSamples(page)).filter((s) => s.state !== null);
    expect(samples.length, "frames sampled").toBeGreaterThan(2);
    expect(samples.filter((s) => s.rest), "frames showing the resting lockup").toEqual([]);
    const hidden = samples.filter((s) => !s.h1 || s.h1Opacity !== 1);
    expect(hidden.length, `frames without the h1 lockup (first at ${hidden[0]?.t.toFixed(0)}ms)`).toBe(0);
    const still = page.locator("[data-hero-still]");
    await expect(still).toHaveAttribute("data-still-ready", "");
    await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test("failure: a scene that throws on render leaves the hero still and a usable book", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const hydration = watchHydration(page);
  await page.goto("/?coildebug=throw=render");
  await settled(page);

  await expectStillHeroAndUsableBook(page);
  // The throw is caught by the scene's boundary, never an uncaught page error.
  expect(errors.filter((message) => !message.includes("coildebug"))).toEqual([]);
  expect(hydration).toEqual([]);
});
