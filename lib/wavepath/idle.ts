import { IDLE } from "./constants";

// The idle ripple's shape, pure: a wave travelling along the line's arc s as
// the clock runs, with a long swell riding on it. -1 to 1.
const TAU = Math.PI * 2;

export function idleAt(s: number, clock: number): number {
  const wave = Math.sin((TAU * (s - IDLE.speed * clock)) / IDLE.wavelength);
  const swell = 0.7 + 0.3 * Math.sin((TAU * (s - IDLE.envelopeSpeed * clock)) / IDLE.envelope + 1.3);
  return wave * swell;
}

// The displacement it adds, in amplitudes, and the magnitude it adds to a
// column (never negative, so a column is only ever lifted, not thinned below
// its resting dots). `gain` is the strength and, with music playing, how much
// of the idle is left.
export const idleDisplacement = (s: number, clock: number, gain: number): number => IDLE.amp * gain * idleAt(s, clock);
export const idleLift = (s: number, clock: number, gain: number): number => IDLE.height * gain * (0.5 + 0.5 * idleAt(s, clock));
