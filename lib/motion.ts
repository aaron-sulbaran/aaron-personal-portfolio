import type { CSSProperties } from "react";

// Shared deceleration ease for the site's motion. Mirrored from the TileRing
// entrance and flight so the back-half scroll journey moves in the same hand:
// a smooth ease-out with no overshoot. EASE is the Framer cubic-bezier tuple;
// the same curve is written out as a CSS timing function where CSS owns the
// transition (the --ease-out custom property in globals.css).
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Stagger order for a .reveal-item or .reveal-mask descendant: the Nth one lands
// N * 70ms after the first (see the reveal rules in globals.css). Lives here, not
// in the "use client" Reveal module, so Server Components can call it directly
// (a function imported from a client module is a client reference, not callable
// on the server).
export function revealIndex(i: number): CSSProperties {
  return { "--reveal-i": i } as CSSProperties;
}
