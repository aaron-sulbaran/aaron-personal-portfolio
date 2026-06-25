import type { CSSProperties } from "react";

// Shared deceleration ease for the site's motion. Mirrored from the TileRing
// entrance and flight so the back-half scroll journey moves in the same hand:
// a smooth ease-out with no overshoot. EASE is the Framer cubic-bezier tuple;
// EASE_CSS is the same curve as a CSS transition-timing-function string (used by
// the reveal classes in globals.css, where CSS owns the transition).
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

// Stagger order for a .reveal-item or .reveal-mask descendant: the Nth one lands
// N * 70ms after the first (see the reveal rules in globals.css). Lives here, not
// in the "use client" Reveal module, so Server Components can call it directly
// (a function imported from a client module is a client reference, not callable
// on the server).
export function revealIndex(i: number): CSSProperties {
  return { "--reveal-i": i } as CSSProperties;
}
