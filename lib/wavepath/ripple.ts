import { RIPPLE } from "./constants";

// The ripple an answer sends along the line, modelled on the footer egg's: one
// Gaussian crest (not a wavelet) that starts at the arc s0 and travels out
// both ways at RIPPLE.speed, decaying exponentially, until it is too small to
// see or past RIPPLE.lifeS. Keyed by arc length like the pluck, so the band's
// run and the path share one crest. One at a time: a new press restarts it.
// Pure and allocation-free; the conductor owns the one state.
export interface RippleState { s0: number; age: number; live: boolean }

const GONE = 0.005; // below this amplitude the crest is gone
const REACH = 4; // beyond this many half widths from the crest the Gaussian is under 1e-7

export const createRipple = (): RippleState => ({ s0: 0, age: 0, live: false });

export function startRipple(r: RippleState, s0: number): void {
  r.s0 = s0;
  r.age = 0;
  r.live = true;
}

// Advances the crest; true while it is still live.
export function stepRipple(r: RippleState, dt: number): boolean {
  if (!r.live) return false;
  r.age += dt;
  if (r.age >= RIPPLE.lifeS || RIPPLE.amp * Math.exp(-RIPPLE.decay * r.age) < GONE) r.live = false;
  return r.live;
}

// The crest's share at s, 0 to 1, with its decay in: shared by the height and the swell.
function envelope(r: RippleState, s: number): number {
  if (!r.live) return 0;
  const off = (Math.abs(s - r.s0) - RIPPLE.speed * r.age) / RIPPLE.width;
  if (off > REACH || off < -REACH) return 0;
  return Math.exp(-RIPPLE.decay * r.age) * Math.exp(-off * off);
}

// The displacement at arc length s, in amplitudes.
export const rippleAt = (r: RippleState, s: number): number => RIPPLE.amp * envelope(r, s);

// The extra dot weight at s: RIPPLE.swell at the crest's full height, tapering with it.
export const rippleSwell = (r: RippleState, s: number): number => RIPPLE.swell * envelope(r, s);
