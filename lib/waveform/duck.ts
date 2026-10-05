import { easeToward } from "./field";
import type { Rect } from "./weights";

// The horizon ducks under text the way a sidechain compressor ducks a pad
// under the kick: any column under a text box, or (while the reader scrolls
// down fast) under one about to scroll in from below, falls to a still
// centreline. The look-ahead scales with the downward scroll speed, from 0 at
// rest to DUCK.lookAheadPx at DUCK.fullLookAheadAtPxPerS, so text parked just
// below the viewport never ducks the open air. The boxes are measured once per
// layout in document space and arrive padded; each frame only compares them
// with the strip's document-space span, so there is no layout read per frame.
// The attack is fast enough to beat the text onto the strip and the release
// slow enough that the wave breathes back in rather than snapping.
//
// DUCK_ALPHA is the alpha ceiling for ducked dots; contrast.test.ts checks it
// against the token hexes so muted body text over the darkest dot stays at
// 4.5 to 1 or better.

export const DUCK = { padPx: 20, lookAheadPx: 160, fullLookAheadAtPxPerS: 1500, attackRate: 0.4, releaseRate: 0.06 };
export const DUCK_ALPHA = { light: 0.07, dark: 0.11 };
// A column whose envelope is past this paints at the DUCK_ALPHA ceiling.
export const DUCK_SPLIT = 0.5;

const REST_EPSILON = 1e-3;
const SPEED_RELEASE_S = 0.25;

// The look-ahead for a downward scroll speed in px/s: 0 at rest (or scrolling
// up), DUCK.lookAheadPx at DUCK.fullLookAheadAtPxPerS and above, linear between.
export function lookAheadFor(speedPxPerS: number): number {
  if (!Number.isFinite(speedPxPerS) || speedPxPerS <= 0) return 0;
  return DUCK.lookAheadPx * Math.min(speedPxPerS / DUCK.fullLookAheadAtPxPerS, 1);
}

// The smoothed scroll speed: instant attack, released with a 250ms time
// constant, so the look-ahead outlasts the end of a flick. `dt` in seconds.
export function stepScrollSpeed(previous: number, instant: number, dt: number): number {
  const decayed = previous * Math.exp(-Math.max(dt, 0) / SPEED_RELEASE_S);
  const next = Math.max(instant, decayed);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

// `rects` must be sorted by `top`: the scan stops at the first one below the look-ahead.
export function duckTargets(
  rects: Rect[],
  columnXs: ArrayLike<number>,
  strip: { top: number; bottom: number },
  out: Float32Array,
  lookAhead: number = DUCK.lookAheadPx,
): void {
  out.fill(0);
  const reach = strip.bottom + lookAhead;
  for (const rect of rects) {
    if (rect.top > reach) break;
    if (rect.bottom <= strip.top) continue;
    for (let i = 0; i < out.length; i++) {
      const x = columnXs[i];
      if (rect.left <= x && x <= rect.right) out[i] = 1;
    }
  }
}

export function stepDuck(env: Float32Array, targets: Float32Array, dt: number): boolean {
  let moving = false;
  for (let i = 0; i < env.length; i++) {
    const target = targets[i];
    const next = easeToward(env[i], target, target > env[i] ? DUCK.attackRate : DUCK.releaseRate, dt);
    if (Math.abs(next - target) > REST_EPSILON) {
      env[i] = next;
      moving = true;
    } else {
      env[i] = target;
    }
  }
  return moving;
}
