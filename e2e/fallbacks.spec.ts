import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { watchScripts } from "./support/chunks";
import { expectStillHeroAndUsableBook, settled, watchHydration } from "./support/fallback";
import { sceneSeen, watchScene } from "./support/heroSamples";

// The cards section without its scene: reduced motion, a scene that throws,
// and a browser with no WebGL. The hero still (the scene at rest, decoded) and
// the titles carry the section, page 1's name is live text, and the scene's
// chunk (three) is never fetched where it could not run.

test("control: a normal load fetches the scene chunk, never the hero still, and never reports still", async ({ page }) => {
  const scripts = watchScripts(page);
  const stills: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/coil/hero-")) stills.push(request.url());
  });
  await watchScene(page);
  await openHome(page);
  expect(await scripts.sceneChunks()).toHaveLength(1);
  expect(stills, "hero still requests with a scene").toEqual([]);
  expect(await sceneSeen(page), "the states the section reported").not.toContain("still");
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("no canvas and no scene chunk: the name is plain text, the still is decoded in the stage, and a title opens its card", async ({ page }) => {
    const scripts = watchScripts(page);
    const hydration = watchHydration(page);
    await watchScene(page);
    await page.goto("/");
    await settled(page);

    await expectStillHeroAndUsableBook(page);
    expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
    expect(hydration).toEqual([]);
    // The section never reports a scene drawing, and ends on still.
    const seen = await sceneSeen(page);
    expect(seen, "the states the section reported").not.toContain("on");
    expect(seen.at(-1)).toBe("still");
    await expect(page.locator("[data-hero-still]")).toHaveAttribute("data-still-ready", "");
    await expect.poll(() => page.locator("[data-hero-still]").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test("failure: a scene that throws on render leaves the hero still and usable titles", async ({ page }) => {
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
