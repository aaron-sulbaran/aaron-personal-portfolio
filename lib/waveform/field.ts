// The wave's clock and easing conventions. The path (lib/wavepath) and the band
// view (components/soundtrack/waveView.ts) share them.
//
// Every clock runs in SECONDS. The conductor converts the rAF timestamp once
// (`t / 1000`); feeding raw milliseconds aliases the sines about 1000 times too
// fast, which is the jitter the AGENTS.md invariant exists to prevent.
//
// Easing is time-based. Each rate is a per-frame lerp tuned at the
// playground's ~45fps; easeToward turns it into the same felt speed at any
// refresh rate, so a 120Hz display no longer runs the transitions faster than
// a 60Hz one.

// The magnitude every column rests at: the thin dotted centerline.
export const FLOOR = 0.016;

const REFERENCE_FPS = 45;

// Exponential approach toward `target`: `rate` is the fraction covered per
// reference frame, dt is seconds. Composes exactly, so two half steps equal
// one whole step.
export function easeToward(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.pow(1 - rate, dt * REFERENCE_FPS);
}
