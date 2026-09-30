import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import { expectPosterHeroAndUsableBook, settled } from "./support/fallback";

// No WebGL: a browser launched without the GPU, and WebGL taken away in the
// page, the two ways a visitor's browser can lack it. The poster, the h1 and
// the book carry the page, and the scene's chunk is never fetched.

test.use({ launchOptions: { args: ["--disable-gpu"] } });

test("a browser without WebGL 2 never fetches the scene chunk", async ({ page }) => {
  await page.addInitScript(() => {
    // As a browser that ships no WebGL 2 at all.
    Reflect.deleteProperty(window, "WebGL2RenderingContext");
  });
  const scripts = watchScripts(page);
  await page.goto("/");
  await settled(page);

  await expectPosterHeroAndUsableBook(page);
  expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
});

test("a context that cannot be created never fetches the scene chunk", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  });
  const scripts = watchScripts(page);
  await page.goto("/");
  await settled(page);

  await expectPosterHeroAndUsableBook(page);
  expect(await scripts.sceneChunks(), "scene chunks fetched").toEqual([]);
});
