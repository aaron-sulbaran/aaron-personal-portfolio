import type { Page } from "@playwright/test";
import { COIL } from "@/lib/coil/constants";
import { LOADER } from "@/lib/loader/progress";
import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import { expectHeadingLockup, expectStillHeroAndUsableBook, settled, watchHydration } from "./support/fallback";
import { heroSamples, sampleHero } from "./support/heroSamples";
import { MUTED_ARGS } from "./support/launch";
import { luminanceSpread, shoot } from "./support/pixels";
import { noWebgl2Api, noWebglContext } from "./support/webgl";
import type { HookWindow } from "./support/hooks";

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

// A still that never decodes: the loader hands its lockup to the h1 lockup
// as a decoded still would, minus the still. The resting lockup never fades
// (its drawn opacity only rises, as its ink eases to the h1's) and leaves in
// one frame onto the identical h1 lockup; no frame shows the h1 before then.
type Events = string[];
const loaderEvents = (page: Page): Promise<Events> =>
  page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
const goneLoader = () => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone";

function expectGaveUp(events: Events) {
  expect(events).toContain("still-failed");
  expect(events, "the give-up hand-off").toContain("still-gaveup");
  expect(events.indexOf("still-failed")).toBeLessThan(events.indexOf("still-gaveup"));
  expect(events, "no fade on the still path").not.toContain("fade");
  expect(events).not.toContain("dissolve");
}

async function expectNoFadeAndOneFrame(page: Page) {
  const samples = (await heroSamples(page)).filter((s) => s.state !== null);
  const goneAt = samples.findIndex((s) => s.state === "gone");
  expect(goneAt, "a frame with the loader gone").toBeGreaterThan(0);
  const held = samples.slice(0, goneAt);
  const runs: string[] = [];
  for (const s of held) {
    const value = s.restOpacity.toFixed(3);
    const last = runs.at(-1);
    if (last?.startsWith(`${value} x`)) runs[runs.length - 1] = `${value} x${Number(last.split(" x")[1]) + 1}`;
    else runs.push(`${value} x1`);
  }
  test.info().annotations.push({ type: "resting lockup opacity per frame", description: `${runs.join(", ")}, then gone` });
  expect(held.every((s) => s.rest), "the resting lockup shows in every frame before gone").toBe(true);
  const dips = held.filter((s, i) => i > 0 && s.restOpacity < held[i - 1].restOpacity - 1e-4);
  expect(dips.map((s) => `${s.t.toFixed(0)}ms ${s.restOpacity.toFixed(3)}`), "frames where the resting lockup's opacity fell").toEqual([]);
  expect(held.at(-1)!.restOpacity, "the resting lockup's ink near the h1's in its last frame").toBeGreaterThan(0.85 * COIL.lockup.stillInk);
  const h1Early = held.filter((s) => s.h1 || s.h1Opacity > 0);
  expect(h1Early.length, `frames before gone showing the h1 (first at ${h1Early[0]?.t.toFixed(0)}ms)`).toBe(0);
  expect(samples[goneAt].h1, "the h1 lockup shows in the first frame the loader has gone").toBe(true);
  expect(samples[goneAt].h1Opacity, "the h1's opacity in that frame").toBe(1);
}

async function expectFieldPoster(page: Page) {
  const field = page.locator('section[data-scene] img[src*="/coil/field-"]').filter({ visible: true });
  await expect(field, "the field poster under the h1 lockup").toHaveCount(1);
  await expect.poll(() => field.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

test("stills that never load: the resting lockup hands to the h1 lockup in one frame, never fading, over the field poster", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/coil/hero-*", (route) => route.abort());
  await page.addInitScript(noWebglContext);
  await sampleHero(page);
  await page.goto("/?coildebug=1");
  await settled(page);
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
  expect(await page.locator("[data-hero-still]").getAttribute("data-still-ready")).toBeNull();
  const events = await loaderEvents(page);
  test.info().annotations.push({ type: "loader events", description: events.filter((e) => e !== "frame").join(", ") });
  expectGaveUp(events);
  await expectNoFadeAndOneFrame(page);
  await expectHeadingLockup(page);
  await expectFieldPoster(page);
  expect(errors).toEqual([]);
});

test("stills that never load: the name never weakens through the give-up's ink ease", async ({ page }) => {
  await page.route("**/coil/hero-*", (route) => route.abort());
  await page.addInitScript(noWebglContext);
  await page.goto("/?coildebug=1");
  await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
  // handoff: the give-up waits on __coilLoader.finish() before its hand-off, then again before the lockup leaves.
  await page.goto("/?coildebug=handoff");
  await page.waitForFunction(() => (window as HookWindow).__coilLoader?.events.some((e) => e.event === "still-failed"), null, { timeout: 30_000 });
  expect(await loaderEvents(page), "a warm load: the pane never armed").not.toContain("100");
  const box = await page.evaluate(() => {
    const r = document.querySelector(".coil-loader__rest-name")!.getBoundingClientRect();
    return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  });
  const rest = luminanceSpread(await shoot(page, box));
  await page.evaluate(() => (window as HookWindow).__coilLoader!.finish!());
  await page.waitForFunction(() => document.querySelector(".coil-loader__rest")!.getAnimations().length > 0);
  await page.evaluate(() => {
    const ease = document.querySelector(".coil-loader__rest")!.getAnimations()[0];
    ease.pause();
    (window as unknown as { __ease: Animation }).__ease = ease;
  });
  const spreads = [`rest ${rest.toFixed(1)}`];
  for (const ms of [0, 100, 200, 300, LOADER.stillFadeMs - 1]) {
    await page.evaluate((t) => ((window as unknown as { __ease: Animation }).__ease.currentTime = t), ms);
    const spread = luminanceSpread(await shoot(page, box));
    spreads.push(`${ms}ms ${spread.toFixed(1)}`);
    expect(spread, `name box spread at ${ms}ms of the ease`).toBeGreaterThanOrEqual(rest - 2);
  }
  const handed = await page.evaluate(() => {
    (window as unknown as { __ease: Animation }).__ease.finish();
    (window as HookWindow).__coilLoader!.finish!();
    return {
      gone: document.querySelector<HTMLElement>(".coil-loader")!.dataset.state === "gone",
      h1: getComputedStyle(document.getElementById("hero-heading")!).opacity,
    };
  });
  expect(handed.gone, "the loader went in the finishing task").toBe(true);
  expect(handed.h1, "the h1's opacity the frame the loader goes").toBe("1");
  const after = luminanceSpread(await shoot(page, box));
  test.info().annotations.push({ type: "name box spread", description: `${spreads.join(", ")}, gone ${after.toFixed(1)}` });
  expect(after, "name box spread after the lockup left").toBeGreaterThanOrEqual(rest - 3);
  expectGaveUp(await loaderEvents(page));
});

test("a still that never answers: the give-up fires at handoffGiveUpMs and hands off the same way", async ({ page }) => {
  // Never fulfilled: the request stays pending, so the decode neither resolves nor rejects.
  await page.route("**/coil/hero-*", () => {});
  await page.addInitScript(noWebglContext);
  await sampleHero(page);
  // The pending still holds the load event back: no waiting on it.
  await page.goto("/?coildebug=1", { waitUntil: "commit" });
  await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
  const timed = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.filter((e) => e.event !== "frame").map((e) => ({ event: e.event, t: e.t })));
  const at = (event: string) => timed.find((e) => e.event === event)?.t ?? NaN;
  test.info().annotations.push({ type: "loader events", description: timed.map((e) => `${e.event} ${e.t.toFixed(0)}`).join(", ") });
  expectGaveUp(timed.map((e) => e.event));
  expect(at("still-failed") - at("still"), "the give-up waited handoffGiveUpMs").toBeGreaterThanOrEqual(LOADER.handoffGiveUpMs - 5);
  await expectNoFadeAndOneFrame(page);
  await expectHeadingLockup(page);
});

test("a deep reload with no WebGL 2 shows the still at full opacity", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  // lib/scroll.ts's saved position, past half a viewport: the fast start.
  await page.addInitScript(() => sessionStorage.setItem("aps:home-scroll-y", String(window.innerHeight * 2)));
  // The still's opacity one frame after it is marked decoded, and whether the
  // loader was skipped then: off the loader's hand-off the still never fades.
  await page.addInitScript(() => {
    const host = window as unknown as { __stillReadyFrame?: { opacity: string; loaderSkipped: boolean } };
    new MutationObserver((records, observer) => {
      const still = records
        .map((record) => record.target)
        .find((target): target is HTMLElement => target instanceof HTMLElement && target.matches("[data-hero-still][data-still-ready]"));
      if (!still) return;
      observer.disconnect();
      requestAnimationFrame(() => {
        host.__stillReadyFrame = {
          opacity: getComputedStyle(still).opacity,
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
  const { opacity, loaderSkipped } = (await frame.jsonValue()) as { opacity: string; loaderSkipped: boolean };
  expect(loaderSkipped, "the loader was skipped (the deep path)").toBe(true);
  expect(opacity, "the still's opacity one frame after data-still-ready").toBe("1");
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
