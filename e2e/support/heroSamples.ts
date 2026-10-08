import type { Page } from "@playwright/test";

// The hero sampled every frame from the first one until the loader has gone,
// the hero has decided (data-scene not "off") and a still hero has marked its
// still decoded (data-still-ready) and any late dissolve has ended
// (data-still-late), at most 2000 frames. h1 is whether the h1 lockup shows;
// h1Opacity is the h1 element's own opacity, h1Width its box (1px at most
// once sr-only); late is data-still-late; restOpacity the
// resting lockup's as drawn (its layer's opacity times the loader root's, 0
// while it does not show); ready is data-still-ready; locked is the body
// scroll lock (lib/modal.ts writes overflow hidden on the body); restBox the
// resting name's text box as drawn (its transform included), CSS px, while it shows.
// window.__restNameRect keeps the resting lockup's name box from the last
// frame it showed, for a shot after the loader has gone.
export type HeroSample = {
  t: number; scene: string | null; state: string | null; dissolve: boolean;
  h1: boolean; h1Opacity: number; h1Width: number; rest: boolean; restOpacity: number; still: number; stillReady: boolean;
  ready: boolean; late: boolean; locked: boolean; restBox: { left: number; top: number; width: number; height: number } | null;
};

export async function sampleHero(page: Page) {
  await page.addInitScript(() => {
    const samples: unknown[] = [];
    (window as unknown as { __heroSamples: unknown[] }).__heroSamples = samples;
    const shows = (el: Element | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const sample = () => {
      const hero = document.querySelector<HTMLElement>("section[data-scene]");
      const loader = document.querySelector<HTMLElement>(".coil-loader");
      const still = document.querySelector<HTMLElement>("[data-hero-still]");
      const img = [...(still?.querySelectorAll("img") ?? [])].find((el) => el.getClientRects().length > 0);
      const state = loader ? (loader.dataset.state ?? "armed") : null;
      const scene = hero?.dataset.scene ?? null;
      const restName = document.querySelector(".coil-loader__rest-name");
      const rest = shows(document.querySelector(".coil-loader__rest-greet")) && shows(restName);
      const drawn = rest ? restName!.getBoundingClientRect() : null;
      if (rest) {
        const r = drawn!;
        (window as unknown as { __restNameRect: object }).__restNameRect = { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
      }
      const layer = document.querySelector(".coil-loader__rest");
      const ready = !!still?.hasAttribute("data-still-ready");
      const late = !!still?.hasAttribute("data-still-late");
      samples.push({
        t: performance.now(), scene, state,
        dissolve: !!loader?.hasAttribute("data-dissolve"),
        h1: shows(document.getElementById("hero-heading")),
        h1Opacity: Number(getComputedStyle(document.getElementById("hero-heading") ?? document.body).opacity),
        h1Width: document.getElementById("hero-heading")?.getBoundingClientRect().width ?? 0,
        rest,
        restOpacity: rest && layer && loader ? Number(getComputedStyle(layer).opacity) * Number(getComputedStyle(loader).opacity) : 0,
        still: still && still.getClientRects().length ? Number(getComputedStyle(still).opacity) : 0,
        stillReady: !!img && img.complete && img.naturalWidth > 0,
        ready,
        late,
        locked: document.body.style.overflow === "hidden",
        restBox: drawn && { left: drawn.left, top: drawn.top, width: drawn.width, height: drawn.height },
      });
      if ((state !== "gone" || scene === "off" || (scene === "still" && !ready) || late) && samples.length < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

export async function heroSamples(page: Page): Promise<HeroSample[]> {
  return page.evaluate(() => (window as unknown as { __heroSamples: HeroSample[] }).__heroSamples);
}

// How long a run of frames lasts (ms, first to last): bounds stated in time,
// not in frame counts, hold on a slow or busy machine.
export const spanMs = (frames: { t: number }[]) => (frames.length ? frames.at(-1)!.t - frames[0].t : 0);

// The resting lockup's name box from the last frame it showed (CSS px).
export async function restNameRect(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return page.evaluate(() => (window as unknown as { __restNameRect: { x: number; y: number; width: number; height: number } }).__restNameRect);
}

// The hero's name, sampled every frame for a while from now (a theme toggle,
// a late still): theme is <html data-theme>; h1 whether the h1 lockup shows
// (laid out, not sr-only, visible) and h1Opacity its own opacity, h1Width its
// box (1px at most once sr-only); ready and late are data-still-ready and
// data-still-late; still the still box's opacity; stillReady the visible img
// complete with a natural width.
export type NameSample = {
  t: number; theme: string; h1: boolean; h1Opacity: number; h1Width: number;
  ready: boolean; late: boolean; still: number; stillReady: boolean;
};

export async function startNameSamples(page: Page, ms: number) {
  await page.evaluate((forMs) => {
    const samples: unknown[] = [];
    (window as unknown as { __nameSamples: unknown[] }).__nameSamples = samples;
    const until = performance.now() + forMs;
    const sample = () => {
      const h1 = document.getElementById("hero-heading")!;
      const box = document.querySelector<HTMLElement>("[data-hero-still]")!;
      const img = [...box.querySelectorAll("img")].find((el) => el.getClientRects().length > 0);
      const r = h1.getBoundingClientRect();
      samples.push({
        t: performance.now(),
        theme: document.documentElement.dataset.theme ?? "",
        h1: r.width > 1 && r.height > 1 && h1.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
        h1Opacity: Number(getComputedStyle(h1).opacity),
        h1Width: r.width,
        ready: box.hasAttribute("data-still-ready"),
        late: box.hasAttribute("data-still-late"),
        still: box.getClientRects().length ? Number(getComputedStyle(box).opacity) : 0,
        stillReady: !!img && img.complete && img.naturalWidth > 0,
      });
      if (performance.now() < until) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, ms);
}

export async function nameSamples(page: Page): Promise<NameSample[]> {
  return page.evaluate(() => (window as unknown as { __nameSamples: NameSample[] }).__nameSamples);
}

// A name shows in the frame: the h1 lockup above half its opacity, or the
// still (which bakes the name) decoded, marked ready and at least at stillAt.
export const hasName = (s: NameSample, stillAt: number) => (s.h1 && s.h1Opacity > 0.5) || (s.ready && s.stillReady && s.still >= stillAt);
