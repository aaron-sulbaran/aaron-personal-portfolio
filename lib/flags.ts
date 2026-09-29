// Build-time feature flags. NEXT_PUBLIC_ so each value is inlined at build time
// and every gate is a constant in the bundle, the same pattern as lib/holding.ts.
//
// HOME_HERO picks the home hero. "coil" (the default since slice 9) serves the
// Coil: the controller, greeting, scene and book. Only the exact value "ring"
// opts back into the retiring TileRing home, until that code is deleted.
export type HomeHero = "ring" | "coil";

export function parseHomeHero(value: string | undefined): HomeHero {
  return value === "ring" ? "ring" : "coil";
}

export const HOME_HERO: HomeHero = parseHomeHero(process.env.NEXT_PUBLIC_HOME_HERO);
export const COIL_HOME = HOME_HERO === "coil";
