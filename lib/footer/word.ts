import { FOOTER } from "./constants";
import { REST_POSE, eggBusy, eggPoseAt, letterDip, rippleLifeMs, stepEgg, type EggPose, type EggState } from "./egg";
import type { Point } from "./geometry";
import { approach, falloff, pressTarget, riseProgress, springAtRest, springStep, type Spring } from "./motion";

// One frame of the wordmark, pure: each letter's swell eases toward the
// pointer's falloff, its press springs toward the pointer's dent or a passing
// ripple's (the period has its own landing squash), the word rises as one
// from the first time the footer is seen, and the period's egg steps. `busy`
// is false once everything has settled, so the loop can sleep until the
// pointer, the egg or the view wakes it. Reduced motion holds every letter at
// rest and in place; the egg only turns.

export type LetterFrame = { swell: number; squash: number; rise: number };
export type Pointer = { x: number; y: number; inside: boolean; pressed: boolean };
export type WordEgg = { state: EggState; index: number; landing: Point; reach: number };

export type WordInput = {
  size: number; // the ascender height, px
  centers: readonly Point[]; // each letter's center at rest, stage px
  reduced: boolean;
  pointer: Pointer; // a mouse or pen over the footer, stage px
  riseStart: number | null; // ms: when the footer was first seen, null before
  egg: WordEgg | null;
};

export type WordState = { infl: number[]; springs: Spring[]; frames: LetterFrame[] };

export function createWordState(count: number): WordState {
  return {
    infl: Array.from({ length: count }, () => 0),
    springs: Array.from({ length: count }, () => ({ x: 1, v: 0 })),
    frames: Array.from({ length: count }, () => ({ swell: 0, squash: 1, rise: 0 })),
  };
}

const EPS = 1e-4;

export function stepWord(state: WordState, input: WordInput, now: number, dt: number): { pose: EggPose; busy: boolean } {
  const { size, centers, reduced, pointer, riseStart, egg } = input;
  const e = FOOTER.egg;
  if (egg) stepEgg(egg.state, now, { e, reduced, landing: egg.landing, unitPx: size }, rippleLifeMs(e, egg.reach));
  const ripples = egg && !reduced ? egg.state.ripples : null;
  const radius = FOOTER.swell.radius * size;
  const rising = !reduced && FOOTER.rise.ms > 0;
  const rise = !rising ? 1 : riseStart === null ? 0 : riseProgress(now - riseStart, FOOTER.rise.ms);
  const live = pointer.inside && !reduced;
  let busy = rising && riseStart !== null && rise < 1;
  for (let i = 0; i < state.frames.length; i++) {
    const c = centers[i] ?? { x: 0, y: 0 };
    const near = live ? falloff(Math.hypot(pointer.x - c.x, pointer.y - c.y), radius) : 0;
    let infl = reduced ? 0 : approach(state.infl[i], near, dt, FOOTER.swell.easeS);
    if (Math.abs(infl - near) < EPS) infl = near;
    state.infl[i] = infl;
    const pressed = pointer.pressed && live ? pressTarget(FOOTER.press.depth, near) : 1;
    const dip = ripples && ripples.length > 0 && i !== egg?.index ? letterDip(c.x, c.y, ripples, now, size, e) : 0;
    const target = Math.min(pressed, 1 - dip);
    let spring = reduced ? { x: 1, v: 0 } : springStep(state.springs[i], target, FOOTER.press.stiffness, FOOTER.press.damping, dt);
    if (springAtRest(spring, target)) spring = { x: target, v: 0 };
    state.springs[i] = spring;
    const f = state.frames[i];
    f.swell = infl;
    f.squash = Math.max(0.05, Math.min(1, spring.x));
    f.rise = rise;
    if (infl !== near || spring.x !== target || spring.v !== 0) busy = true;
  }
  if (egg && eggBusy(egg.state)) busy = true;
  return { pose: egg ? eggPoseAt(egg.state, now, e) : REST_POSE, busy };
}
