import { RIPPLE, SWELL } from "./constants";

// The ripple an answer sends along the line, modelled on the footer egg's: one
// Gaussian crest (not a wavelet) that starts at the arc s0 and travels out
// both ways at RIPPLE.speed, decaying exponentially, until it is too small to
// see or past RIPPLE.lifeS. Keyed by arc length like the pluck, so the band's
// run and the path share one crest. One at a time: a new press restarts it.
// A Not now sends the same crest in a gentler shape (SWELL): a "swell", low
// and broad, gone in about a second. Pure and allocation-free; the conductor
// owns the one state.
export type RippleKind = "answer" | "swell";
export interface RippleState { s0: number; age: number; live: boolean; kind: RippleKind }
const SHAPES = { answer: RIPPLE, swell: SWELL } as const;

const GONE = 0.005; // below this amplitude the crest is gone
const REACH = 4; // beyond this many half widths from the crest the Gaussian is under 1e-7

export const createRipple = (): RippleState => ({ s0: 0, age: 0, live: false, kind: "answer" });

export function startRipple(r: RippleState, s0: number, kind: RippleKind = "answer"): void {
  r.kind = kind;
  r.s0 = s0;
  r.age = 0;
  r.live = true;
}

// Advances the crest; true while it is still live.
export function stepRipple(r: RippleState, dt: number): boolean {
  if (!r.live) return false;
  r.age += dt;
  const shape = SHAPES[r.kind];
  if (r.age >= shape.lifeS || shape.amp * Math.exp(-shape.decay * r.age) < GONE) r.live = false;
  return r.live;
}

// The crest's share at s, 0 to 1, with its decay in: shared by the height and the swell.
function envelope(r: RippleState, s: number): number {
  if (!r.live) return 0;
  const shape = SHAPES[r.kind];
  const off = (Math.abs(s - r.s0) - shape.speed * r.age) / shape.width;
  if (off > REACH || off < -REACH) return 0;
  return Math.exp(-shape.decay * r.age) * Math.exp(-off * off);
}

// The displacement at arc length s, in amplitudes.
export const rippleAt = (r: RippleState, s: number): number => SHAPES[r.kind].amp * envelope(r, s);

// The extra dot weight at s: the shape's swell at the crest's full height, tapering with it.
export const rippleSwell = (r: RippleState, s: number): number => SHAPES[r.kind].swell * envelope(r, s);

// The crest's height now, in amplitudes (0 when none): what the QA probe reads.
export const rippleHeight = (r: RippleState): number => (r.live ? SHAPES[r.kind].amp * Math.exp(-SHAPES[r.kind].decay * r.age) : 0);
