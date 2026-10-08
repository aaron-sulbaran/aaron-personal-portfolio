import type { Page } from "@playwright/test";

// The hero sampled every frame from the first one until the loader has gone,
// the hero has decided (data-scene not "off") and a still hero has marked its
// still decoded (data-still-ready), at most 2000 frames. h1 is whether the h1
// lockup shows; h1Opacity is the h1 element's own opacity; restOpacity the
// resting lockup's as drawn (its layer's opacity times the loader root's, 0
// while it does not show); ready is data-still-ready; locked is the body
// scroll lock (lib/modal.ts writes overflow hidden on the body); restBox the
// resting name's text box as drawn (its transform included), CSS px, while it shows.
// window.__restNameRect keeps the resting lockup's name box from the last
// frame it showed, for a shot after the loader has gone.
export type HeroSample = {
  t: number; scene: string | null; state: string | null; dissolve: boolean;
  h1: boolean; h1Opacity: number; rest: boolean; restOpacity: number; still: number; stillReady: boolean;
  ready: boolean; locked: boolean; restBox: { left: number; top: number; width: number; height: number } | null;
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
      samples.push({
        t: performance.now(), scene, state,
        dissolve: !!loader?.hasAttribute("data-dissolve"),
        h1: shows(document.getElementById("hero-heading")),
        h1Opacity: Number(getComputedStyle(document.getElementById("hero-heading") ?? document.body).opacity),
        rest,
        restOpacity: rest && layer && loader ? Number(getComputedStyle(layer).opacity) * Number(getComputedStyle(loader).opacity) : 0,
        still: still && still.getClientRects().length ? Number(getComputedStyle(still).opacity) : 0,
        stillReady: !!img && img.complete && img.naturalWidth > 0,
        ready,
        locked: document.body.style.overflow === "hidden",
        restBox: drawn && { left: drawn.left, top: drawn.top, width: drawn.width, height: drawn.height },
      });
      if ((state !== "gone" || scene === "off" || (scene === "still" && !ready)) && samples.length < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

export async function heroSamples(page: Page): Promise<HeroSample[]> {
  return page.evaluate(() => (window as unknown as { __heroSamples: HeroSample[] }).__heroSamples);
}

// The resting lockup's name box from the last frame it showed (CSS px).
export async function restNameRect(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return page.evaluate(() => (window as unknown as { __restNameRect: { x: number; y: number; width: number; height: number } }).__restNameRect);
}
