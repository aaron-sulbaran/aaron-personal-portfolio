import { LOADER } from "@/lib/loader/progress";
import { test, expect } from "./support/fixtures";
import { expectHeadingHidden } from "./support/fallback";
import { heroSamples, sampleHero, type HeroSample } from "./support/heroSamples";
import { noWebglContext } from "./support/webgl";
import type { HookWindow } from "./support/hooks";

// A still that decodes only after the loader has given up on it (the slow
// phone): the loader handed its lockup to the h1 lockup and went, so the
// still comes in with its own dissolve (data-still-late): it fades in under
// the h1 lockup over stillFadeMs, then the h1 lockup fades out over
// lockupFadeMs, both linear, and only then is the h1 visually hidden. No
// landing: on a box at another aspect than the cut's the two names differ in
// pose for that moment (accepted on this slow path).

test.use({ colorScheme: "light" });

const goneLoader = () => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone";
const named = (s: HeroSample) => s.rest || (s.h1 && s.h1Opacity > 0.5) || (s.ready && s.stillReady && s.still > 0.5);
// After the give-up (handoffGiveUpMs from the loader's "still"), this much longer: about 2.5s in all.
const LATE_BY_MS = 1000;

test("a still that decodes after the loader's give-up dissolves in under the h1 lockup, never leaving the hero without a name", async ({ page }) => {
  // Every request for the light still is held until the loader has given up, then LATE_BY_MS more.
  const released: number[] = [];
  await page.route("**/coil/hero-light-*", async (route) => {
    await page
      .waitForFunction(() => (window as HookWindow).__coilLoader?.events.some((e) => e.event === "still-failed"), null, { timeout: 30_000, polling: 20 })
      .catch(() => undefined);
    await new Promise((done) => setTimeout(done, LATE_BY_MS));
    released.push(Date.now());
    await route.continue().catch(() => undefined);
  });
  await page.addInitScript(noWebglContext);
  await sampleHero(page);
  await page.goto("/?coildebug=1", { waitUntil: "commit" });
  await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
  const box = page.locator("[data-hero-still]");
  await expect(box).toHaveAttribute("data-still-ready", "", { timeout: 15_000 });
  await expect(box).not.toHaveAttribute("data-still-late", { timeout: 5_000 });
  await expectHeadingHidden(page);
  expect(released.length, "the still's requests were held and released").toBeGreaterThan(0);

  const timed = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.filter((e) => e.event !== "frame").map((e) => ({ event: e.event, t: e.t })));
  const at = (event: string) => timed.find((e) => e.event === event)?.t ?? NaN;
  const events = timed.map((e) => e.event);
  expect(events, "the loader gave up on the still").toContain("still-failed");
  expect(events, "and handed its lockup to the h1 lockup").toContain("still-gaveup");
  expect(events, "the loader's own dissolve never ran").not.toContain("dissolve");

  const samples = (await heroSamples(page)).filter((s) => s.state !== null);
  const frameMs = samples.slice(1).map((s, i) => s.t - samples[i].t).sort((a, b) => a - b)[Math.floor((samples.length - 1) / 2)];
  const lateAt = samples.findIndex((s) => s.late);
  expect(lateAt, "a frame with data-still-late").toBeGreaterThan(0);
  const t0 = samples[lateAt].t;
  const dissolve = samples.slice(lateAt);
  const rel = (s: HeroSample | undefined) => (s ? (s.t - t0).toFixed(0) : "none");
  test.info().annotations.push({
    type: "late dissolve per frame (ms from data-still-late)",
    description: `give-up at ${(at("still-failed") - at("still")).toFixed(0)}ms after "still", late at ${(t0 - at("still")).toFixed(0)}ms; ${dissolve
      .map((s) => `${rel(s)} still ${s.still.toFixed(2)} h1 ${s.h1Width <= 1 ? "sr-only" : s.h1Opacity.toFixed(2)}${s.late ? "" : " (late off)"}`)
      .join(", ")}; frame ${frameMs.toFixed(1)}ms`,
  });
  expect(t0, "data-still-late came after the give-up's hand-off").toBeGreaterThan(at("still-gaveup"));
  expect(samples[lateAt].ready, "late and ready arrive together").toBe(true);
  expect(samples.slice(0, lateAt).some((s) => s.ready), "no frame marked ready before late").toBe(false);

  const stillIn = dissolve.findIndex((s) => s.still === 1);
  const falls = dissolve.findIndex((s) => s.h1Width > 1 && s.h1Opacity < 0.999);
  const hidden = dissolve.findIndex((s) => s.h1Width <= 1);
  expect(stillIn, "the still reached 1").toBeGreaterThan(0);
  expect(falls, "the h1 lockup's fade began").toBeGreaterThan(0);
  expect(hidden, "the h1 went sr-only").toBeGreaterThan(falls);
  // The still is in before the h1 lockup starts to go.
  const early = dissolve.filter((s) => s.h1Width > 1 && s.h1Opacity < 0.999 && s.still < 1);
  expect(early.map((s) => `${rel(s)} still ${s.still.toFixed(3)} h1 ${s.h1Opacity.toFixed(3)}`), "frames with the h1 fading before the still is in").toEqual([]);
  // The still rose over stillFadeMs, linear, from 0.
  const rising = dissolve.slice(0, stillIn);
  expect(dissolve[0].still, "the still starts at 0 under the h1 lockup").toBeLessThan(0.1);
  expect(dissolve[stillIn].t - t0, "the still took about stillFadeMs").toBeGreaterThanOrEqual(LOADER.stillFadeMs - 2 * frameMs);
  expect(dissolve[stillIn].t - t0, "the still in within stillFadeMs plus two frames").toBeLessThanOrEqual(LOADER.stillFadeMs + 2 * frameMs + 1);
  expect(rising.filter((s, i) => i > 0 && s.still < rising[i - 1].still - 1e-4).length, "frames where the still's opacity fell").toBe(0);
  // Then the h1 lockup fell over lockupFadeMs, never rising, to about 0, and only then went sr-only.
  const fading = dissolve.slice(falls, hidden);
  expect(fading.filter((s, i) => i > 0 && s.h1Opacity > fading[i - 1].h1Opacity + 1e-4).length, "frames where the h1's opacity rose").toBe(0);
  expect(fading.at(-1)!.h1Opacity, "the h1's opacity in its last laid-out frame").toBeLessThan(0.2);
  expect(dissolve[hidden].t - t0, "sr-only once both fades are done").toBeGreaterThanOrEqual(LOADER.stillFadeMs + LOADER.lockupFadeMs - 2 * frameMs);
  expect(dissolve[hidden].t - t0, "sr-only within both fades plus three frames").toBeLessThanOrEqual(LOADER.stillFadeMs + LOADER.lockupFadeMs + 3 * frameMs + 1);
  expect(dissolve[hidden].late, "data-still-late ends with the dissolve").toBe(false);

  const bare = samples.filter((s) => !named(s));
  expect(bare.map((s) => `${s.t.toFixed(0)}ms ${s.state} still ${s.still.toFixed(2)} ready ${s.ready} pixels ${s.stillReady} h1 ${s.h1} ${s.h1Opacity.toFixed(2)}`), "frames with no name").toEqual([]);
});
