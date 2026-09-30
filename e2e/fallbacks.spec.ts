import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { watchScripts } from "./support/chunks";
import { expectPosterHeroAndUsableBook, settled } from "./support/fallback";

// The hero without its scene: reduced motion, a scene that throws, and a
// browser with no WebGL. The poster, the server-rendered h1 and the book
// carry the page, and the scene's chunk (three) is never fetched where it
// could not run.

test("control: a normal load fetches the scene chunk (the detector below sees it)", async ({ page }) => {
  const scripts = watchScripts(page);
  await openHome(page);
  expect(await scripts.sceneChunks()).toHaveLength(1);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("no canvas and no scene chunk: the poster, the h1 and the book", async ({ page }) => {
    const scripts = watchScripts(page);
    await page.goto("/");
    await settled(page);

    await expectPosterHeroAndUsableBook(page);
    expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
  });
});

test("failure: a scene that throws on render leaves the poster and a usable book", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?coildebug=throw=render");
  await settled(page);

  await expectPosterHeroAndUsableBook(page);
  // The throw is caught by the scene's boundary, never an uncaught page error.
  expect(errors.filter((message) => !message.includes("coildebug"))).toEqual([]);
});
