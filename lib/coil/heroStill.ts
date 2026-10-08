import { COIL } from "./constants";
import { HERO_STILL_RECTS } from "./heroStill.rects";

// The hero still: the scene at rest (?coildebug=still, scripts/render-posters.mjs),
// shown when no scene can run. data-scene on the hero: "on" the scene draws,
// "off" one is on its way (the field poster), "still" none can run.
export type HeroScene = "on" | "off" | "still";
export type StillTheme = "light" | "dark";
export type StillCut = "wide" | "square" | "narrow";
export type StillFormat = "avif" | "webp";

// Three cuts, each rendered at HERO_STILL_DPR: narrow under the scene's
// narrow line (isNarrow, strict), square under SQUARE_BELOW, wide above.
// The render script keeps a copy of the sizes.
export const HERO_STILL_DPR = 2;
export const HERO_STILL_SIZE: Readonly<Record<StillCut, { width: number; height: number }>> = {
  wide: { width: 1440, height: 900 },
  square: { width: 1000, height: 1000 },
  narrow: { width: 390, height: 844 },
};
// A still cut's line, not a scene value: where a square still beats the wide one.
const SQUARE_BELOW = 1.2;

export function stillCut(aspect: number): StillCut {
  if (aspect < COIL.narrow.aspectBelow) return "narrow";
  return aspect < SQUARE_BELOW ? "square" : "wide";
}

// The lockup a still baked behind its cards: nameRect()'s geometry (the
// name's ink left edge, baseline, ink width and size; the greeting's; the
// gradient's span) in CSS px from the top left of the box it shows in.
export type BakedLockup = {
  readonly left: number;
  readonly baseline: number;
  readonly width: number;
  readonly fontPx: number;
  readonly greeting: { readonly left: number; readonly baseline: number; readonly fontPx: number };
  readonly gradient: { readonly top: number; readonly height: number };
};

// Where a cut's baked lockup (heroStill.rects.ts, recorded by the render
// script) lands in a box viewportW by viewportH showing the still with
// object-fit cover, centred: scaled by the larger of the two ratios, the
// overflow cropped equally from both sides. The box is the still's own
// ([data-hero-still]), in its own px from its top left.
export function bakedLockupRect(cut: StillCut, viewportW: number, viewportH: number): BakedLockup {
  const size = HERO_STILL_SIZE[cut];
  const s = Math.max(viewportW / size.width, viewportH / size.height);
  const ox = (viewportW - size.width * s) / 2;
  const oy = (viewportH - size.height * s) / 2;
  const x = (v: number) => v * s + ox;
  const y = (v: number) => v * s + oy;
  const r = HERO_STILL_RECTS[cut];
  return {
    left: x(r.left),
    baseline: y(r.baseline),
    width: r.width * s,
    fontPx: r.fontPx * s,
    greeting: { left: x(r.greeting.left), baseline: y(r.greeting.baseline), fontPx: r.greeting.fontPx * s },
    gradient: { top: y(r.gradient.top), height: r.gradient.height * s },
  };
}

// "Aspect below r" in Level 3 syntax (Safari before 16.4 has no range
// syntax): not all and (min-aspect-ratio: r) is exactly a strict less-than.
const below = (ratio: number) => `not all and (min-aspect-ratio: ${Math.round(ratio * 1000)}/1000)`;
export const STILL_MEDIA: Readonly<Record<Exclude<StillCut, "wide">, string>> = {
  narrow: below(COIL.narrow.aspectBelow),
  square: below(SQUARE_BELOW),
};

// The cut the picture's sources pick, by the same media queries in the same
// order: matches is window.matchMedia(query).matches in the browser.
export function mediaStillCut(matches: (query: string) => boolean): StillCut {
  if (matches(STILL_MEDIA.narrow)) return "narrow";
  return matches(STILL_MEDIA.square) ? "square" : "wide";
}

export function heroStillSrc(theme: StillTheme, cut: StillCut, format: StillFormat): string {
  return `/coil/hero-${theme}-${cut}.${format}`;
}

export type StillSource = { media?: string; type: string; src: string; cut: StillCut };

// The picture's sources in the order the browser tries them, AVIF before
// WebP in each cut (Safari before 16 has no AVIF); the img is the wide WebP.
export function stillSources(theme: StillTheme): StillSource[] {
  const sources: StillSource[] = [];
  for (const cut of ["narrow", "square", "wide"] as const) {
    const media = cut === "wide" ? undefined : STILL_MEDIA[cut];
    sources.push({ media, type: "image/avif", src: heroStillSrc(theme, cut, "avif"), cut });
    if (cut !== "wide") sources.push({ media, type: "image/webp", src: heroStillSrc(theme, cut, "webp"), cut });
  }
  return sources;
}

export function stillFallback(theme: StillTheme): string {
  return heroStillSrc(theme, "wide", "webp");
}

// Why the hero is still, for the notice (components/coil/StillNotice.tsx).
export type StillCause = "noWebgl" | "unavailable" | "reducedMotion";
// Why a scene that could have run did not: no context could start
// ("noWebgl"), or it started and failed (a chunk, a render error, a second
// lost context).
export type StillFailure = "noWebgl" | "unavailable";

export function stillCause({ reducedMotion, hasApi, failure }: { reducedMotion: boolean; hasApi: boolean; failure: StillFailure | null }): StillCause {
  if (reducedMotion) return "reducedMotion";
  if (!hasApi) return "noWebgl";
  return failure ?? "unavailable";
}
