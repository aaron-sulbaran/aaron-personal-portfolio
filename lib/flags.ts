// Build-time feature flags. NEXT_PUBLIC_ so each value is inlined at build time
// and every gate is a constant in the bundle, the same pattern as lib/holding.ts.
//
// HOME_HERO picks the home hero while the Coil is built beside the ring:
// "ring" (the default) serves today's TileRing home byte for byte; "coil"
// serves the new controller, greeting, and book. Only the exact value "coil"
// opts in, so a typo can never ship the unfinished hero. The flag retires in
// slice 9 when the Coil becomes the only home.
export type HomeHero = "ring" | "coil";

export function parseHomeHero(value: string | undefined): HomeHero {
  return value === "coil" ? "coil" : "ring";
}

export const HOME_HERO: HomeHero = parseHomeHero(process.env.NEXT_PUBLIC_HOME_HERO);
export const COIL_HOME = HOME_HERO === "coil";
