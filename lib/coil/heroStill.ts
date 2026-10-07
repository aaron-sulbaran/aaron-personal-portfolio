import { COIL } from "./constants";

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

// "Aspect below r" in Level 3 syntax (Safari before 16.4 has no range
// syntax): not all and (min-aspect-ratio: r) is exactly a strict less-than.
const below = (ratio: number) => `not all and (min-aspect-ratio: ${Math.round(ratio * 1000)}/1000)`;
export const STILL_MEDIA: Readonly<Record<Exclude<StillCut, "wide">, string>> = {
  narrow: below(COIL.narrow.aspectBelow),
  square: below(SQUARE_BELOW),
};

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
