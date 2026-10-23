import type { Page } from "@playwright/test";

// The cards section's stage watched frame by frame. The hero still (the scene
// at rest, in Poster.tsx) is shown only where no scene can run, and only once
// the current theme's picture has decoded (data-still-ready); until then its
// box waits at opacity 0 over the field poster. Page 1's name is live text (or
// the name canvas), never part of the still.

// The section's data-scene ("on" the scene draws, "off" one is on its way,
// "still" none can run), collected from before the first paint for as long as
// the page lives, one entry per change.
export async function watchScene(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __sceneSeen: string[] }).__sceneSeen = seen;
    const sample = () => {
      const scene = document.querySelector<HTMLElement>("section[data-scene]")?.dataset.scene ?? null;
      if (scene && seen.at(-1) !== scene) seen.push(scene);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

export async function sceneSeen(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __sceneSeen: string[] }).__sceneSeen);
}

// One frame of the still: theme is <html data-theme>; ready and late are
// data-still-ready and data-still-late; shown is the still box's opacity while
// it is laid out (0 when it is not); pixels is whether the visible picture is
// complete with a natural width.
export type StillSample = { t: number; theme: string; ready: boolean; late: boolean; shown: number; pixels: boolean };

export async function startStillSamples(page: Page, ms: number) {
  await page.evaluate((forMs) => {
    const samples: unknown[] = [];
    (window as unknown as { __stillSamples: unknown[] }).__stillSamples = samples;
    const until = performance.now() + forMs;
    const sample = () => {
      const box = document.querySelector<HTMLElement>("[data-hero-still]")!;
      const img = [...box.querySelectorAll("img")].find((el) => el.getClientRects().length > 0);
      samples.push({
        t: performance.now(),
        theme: document.documentElement.dataset.theme ?? "",
        ready: box.hasAttribute("data-still-ready"),
        late: box.hasAttribute("data-still-late"),
        shown: box.getClientRects().length ? Number(getComputedStyle(box).opacity) : 0,
        pixels: !!img && img.complete && img.naturalWidth > 0,
      });
      if (performance.now() < until) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, ms);
}

export async function stillSamples(page: Page): Promise<StillSample[]> {
  return page.evaluate(() => (window as unknown as { __stillSamples: StillSample[] }).__stillSamples);
}

// A still never paints before it is whole: any frame that shows it (opacity
// above 0) has it marked decoded and its visible picture's pixels.
export const stillIsWhole = (s: StillSample) => s.shown === 0 || (s.ready && s.pixels);
