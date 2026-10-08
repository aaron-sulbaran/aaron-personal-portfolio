import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { watchScripts } from "./support/chunks";
import { expectStillHeroAndUsableBook, settled, watchHydration } from "./support/fallback";
import { heroSamples, sampleHero } from "./support/heroSamples";

// The hero without its scene: reduced motion, a scene that throws, and a
// browser with no WebGL. The hero still (its name baked behind the cards,
// the h1 visually hidden once it has decoded) and the book carry the page,
// and the scene's chunk (three) is never fetched where it could not run.

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

  test("no canvas and no scene chunk: no resting lockup, the h1 lockup until the still decodes, then the still at once and the book", async ({ page }) => {
    const scripts = watchScripts(page);
    const hydration = watchHydration(page);
    await sampleHero(page);
    await page.goto("/");
    await settled(page);

    await expectStillHeroAndUsableBook(page);
    expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
    expect(hydration).toEqual([]);
    // Reduced motion has no resting lockup and nothing holds the h1: the h1
    // lockup is the greeting from the first frame, under the loader's fade,
    // until the still has decoded; from that frame the still shows at full
    // opacity (no fade) and the h1 is visually hidden, and the visible
    // picture has its pixels (no frame paints neither name).
    const samples = (await heroSamples(page)).filter((s) => s.state !== null);
    expect(samples.length, "frames sampled").toBeGreaterThan(2);
    expect(samples.filter((s) => s.rest), "frames showing the resting lockup").toEqual([]);
    const readyAt = samples.findIndex((s) => s.ready);
    expect(readyAt, "a sampled frame with the still marked decoded").toBeGreaterThanOrEqual(0);
    const before = samples.slice(0, readyAt).filter((s) => !s.h1 || s.h1Opacity !== 1);
    expect(before.length, `frames before the still without the h1 lockup (first at ${before[0]?.t.toFixed(0)}ms)`).toBe(0);
    const after = samples.slice(readyAt);
    test.info().annotations.push({ type: "still marked decoded", description: `frame ${readyAt} of ${samples.length}, at ${samples[readyAt].t.toFixed(0)}ms, loader ${samples[readyAt].state}` });
    expect(after.filter((s) => s.h1).length, "frames from the still on showing the h1").toBe(0);
    expect(after.filter((s) => s.still !== 1).map((s) => s.still), "the still's opacity from its first frame").toEqual([]);
    const gaps = after.filter((s) => !s.stillReady).map((s) => `${s.t.toFixed(0)}ms`);
    expect(gaps, "frames from the still on whose visible picture has no pixels yet").toEqual([]);
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
