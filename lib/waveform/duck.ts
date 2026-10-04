import { easeToward } from "./field";
import type { Rect } from "./weights";

// The horizon ducks under text the way a sidechain compressor ducks a pad
// under the kick: any column under a text box, or under one about to scroll
// in from below, falls to a still centreline. The boxes are measured once per
// layout in document space and arrive padded; each frame only compares them
// with the strip's document-space span, so there is no layout read per frame.
// The attack is fast enough to beat the text onto the strip and the release
// slow enough that the wave breathes back in rather than snapping.
//
// DUCK_ALPHA is the alpha ceiling for ducked dots; contrast.test.ts checks it
// against the token hexes so muted body text over the darkest dot stays at
// 4.5 to 1 or better.

export const DUCK = { padPx: 20, lookAheadPx: 160, attackRate: 0.4, releaseRate: 0.06 };
export const DUCK_ALPHA = { light: 0.07, dark: 0.11 };

const REST_EPSILON = 1e-3;

// `rects` must be sorted by `top`: the scan stops at the first one below the look-ahead.
export function duckTargets(
  rects: Rect[],
  columnXs: ArrayLike<number>,
  strip: { top: number; bottom: number },
  out: Float32Array,
): void {
  out.fill(0);
  const reach = strip.bottom + DUCK.lookAheadPx;
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
