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

// The scroll speed behind the look-ahead, tracked from samples of the scroll
// position on the wall clock (seconds). A sample counts only when it follows
// the last one within `maxGapS`: after a gap (the first paint, the strip's
// return, an unfreeze, a tab coming back) the whole gap's scroll is not a
// flick, so the tracker resyncs and the speed starts again from 0. A jump past
// the speed that already gives the full look-ahead only lengthens the release,
// so the instant speed is capped there; under SPEED_REST_PX_S (a look-ahead
// under a pixel) the speed rests at 0.
export type ScrollTracker = { speed: number; lastTop: number; lastTime: number };

const SPEED_REST_PX_S = 5;

export function createScrollTracker(): ScrollTracker {
  return { speed: 0, lastTop: Number.NaN, lastTime: Number.NaN };
}

export function resetScroll(tracker: ScrollTracker, scrollTop: number, time: number): void {
  tracker.speed = 0;
  tracker.lastTop = scrollTop;
  tracker.lastTime = time;
}

// Returns the smoothed downward speed in px/s. A sample at the same time as
// the last one carries nothing; its scroll is counted by the next.
export function trackScroll(tracker: ScrollTracker, scrollTop: number, time: number, maxGapS: number): number {
  const dt = time - tracker.lastTime;
  if (dt === 0) return tracker.speed;
  if (!(dt > 0 && dt <= maxGapS && Number.isFinite(tracker.lastTop))) {
    resetScroll(tracker, scrollTop, time);
    return 0;
  }
  const down = Math.min(Math.max((scrollTop - tracker.lastTop) / dt, 0), DUCK.fullLookAheadAtPxPerS);
  tracker.lastTop = scrollTop;
  tracker.lastTime = time;
  const speed = stepScrollSpeed(tracker.speed, Number.isFinite(down) ? down : 0, dt);
  tracker.speed = speed < SPEED_REST_PX_S ? 0 : speed;
  return tracker.speed;
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
