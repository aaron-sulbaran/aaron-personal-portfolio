import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import { expectStillHeroAndUsableBook, settled, watchHydration } from "./support/fallback";
import { MUTED_ARGS } from "./support/launch";
import { noWebgl2Api, noWebglContext } from "./support/webgl";

// No WebGL: a browser launched without the GPU, and WebGL taken away in the
// page, the two ways a visitor's browser can lack it. The hero still (the
// name baked behind its cards, the h1 visually hidden once it has decoded)
// and the book carry the page, and the scene's chunk is never fetched. A
// still that never decodes leaves the h1 lockup as the hero's name.

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

test("a deep reload with no WebGL 2 shows the still at full opacity", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  // lib/scroll.ts's saved position, past half a viewport: the fast start.
  await page.addInitScript(() => sessionStorage.setItem("aps:home-scroll-y", String(window.innerHeight * 2)));
  // The still's opacity one frame after it is marked decoded, the h1's box in
  // that frame, whether its visible picture has its pixels then, and whether
  // the loader was skipped: off the loader's hand-off the still never fades,
  // and no frame paints neither name.
  await page.addInitScript(() => {
    const host = window as unknown as { __stillReadyFrame?: { opacity: string; pixels: boolean; loaderSkipped: boolean; h1: { width: number; height: number } } };
    new MutationObserver((records, observer) => {
      const still = records
        .map((record) => record.target)
        .find((target): target is HTMLElement => target instanceof HTMLElement && target.matches("[data-hero-still][data-still-ready]"));
      if (!still) return;
      observer.disconnect();
      requestAnimationFrame(() => {
        const h1 = document.getElementById("hero-heading")!.getBoundingClientRect();
        const img = [...still.querySelectorAll("img")].find((el) => el.getClientRects().length > 0);
        host.__stillReadyFrame = {
          opacity: getComputedStyle(still).opacity,
          pixels: !!img && img.complete && img.naturalWidth > 0,
          h1: { width: h1.width, height: h1.height },
          loaderSkipped: document.documentElement.dataset.coilLoader === "skip" || !document.querySelector(".coil-loader"),
        };
      });
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-still-ready"] });
  });
  await page.goto("/");
  await settled(page);
  const still = page.locator("[data-hero-still]");
  await expect(still).toHaveAttribute("data-still-ready", "");
  await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  const frame = await page.waitForFunction(() => (window as unknown as { __stillReadyFrame?: object }).__stillReadyFrame);
  const { opacity, pixels, loaderSkipped, h1 } = (await frame.jsonValue()) as { opacity: string; pixels: boolean; loaderSkipped: boolean; h1: { width: number; height: number } };
  expect(loaderSkipped, "the loader was skipped (the deep path)").toBe(true);
  expect(opacity, "the still's opacity one frame after data-still-ready").toBe("1");
  expect(pixels, "the visible picture complete with a natural width in that frame").toBe(true);
  expect(h1.width, "the h1 visually hidden (sr-only) in that same frame: width").toBeLessThanOrEqual(1);
  expect(h1.height, "the h1 visually hidden in that same frame: height").toBeLessThanOrEqual(1);
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
