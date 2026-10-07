import type { Page } from "@playwright/test";

// The hero sampled every frame from the first one until the loader has gone
// and the hero has decided (data-scene not "off"), at most 2000 frames. h1 is
// whether the h1 lockup shows; h1Opacity is the h1 element's own opacity.
export type HeroSample = {
  t: number; scene: string | null; state: string | null; dissolve: boolean;
  h1: boolean; h1Opacity: number; rest: boolean; still: number; stillReady: boolean;
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
      samples.push({
        t: performance.now(), scene, state,
        dissolve: !!loader?.hasAttribute("data-dissolve"),
        h1: shows(document.getElementById("hero-heading")),
        h1Opacity: Number(getComputedStyle(document.getElementById("hero-heading") ?? document.body).opacity),
        rest: shows(document.querySelector(".coil-loader__rest-greet")) && shows(document.querySelector(".coil-loader__rest-name")),
        still: still && still.getClientRects().length ? Number(getComputedStyle(still).opacity) : 0,
        stillReady: !!img && img.complete && img.naturalWidth > 0,
      });
      if ((state !== "gone" || scene === "off") && samples.length < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

export async function heroSamples(page: Page): Promise<HeroSample[]> {
  return page.evaluate(() => (window as unknown as { __heroSamples: HeroSample[] }).__heroSamples);
}
