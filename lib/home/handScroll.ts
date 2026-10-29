import { COIL, type CoilConstants } from "@/lib/coil/constants";

// The cutscene's scroll when the reader's own scroll started the deal. The
// reader is already moving, so the deal's scroll takes over at the page's
// current speed and direction and eases to page 2's top: no stop and no start.
// Pure; lib/home/dealMaster.ts plays it as a child of the deal's clock.
//
// The curve is a cubic Hermite from (y0, speed v) to (landing, rest), over D:
//   y(s) = y0 + d * (a (s - 2s^2 + s^3) + 3s^2 - 2s^3), s = t / D, d = landing - y0,
//   a = v D / d  (the speed the curve starts at, in units of the plain ease's d / D)
// Its start speed is exactly v, its end speed 0, and while 0 <= a <= 3 it is
// monotone (it never passes the landing). a is held to that range: the leg is
// shortened (never below minLegMs) until v fits, and if it still does not (a fling
// that has all but reached the landing) the start speed is the fastest that fits.
// With v = 0 it is a smoothstep, the same stand-still start as the click's ease.

export type ScrollSample = { t: number; y: number };

// The page's speed down the page, px/s, from the scroll samples inside
// velocityWindowMs of the last one. 0 for a page at rest (the last sample is stale),
// for one sample alone, and for a page going up (the trigger only fires going down).
export function scrollVelocity(samples: readonly ScrollSample[], nowMs: number, c: CoilConstants = COIL): number {
  const { velocityWindowMs, staleMs } = c.deal.cutscene;
  const last = samples[samples.length - 1];
  if (!last || nowMs - last.t > staleMs) return 0;
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > velocityWindowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  if (dt < 1) return 0;
  return Math.max(0, ((last.y - first.y) / dt) * 1000);
}

export type HandPlan = {
  // How long the leg takes, ms.
  durationMs: number;
  // The speed it starts at, px/s (the page's own, unless it had to be held to what fits).
  startVelocity: number;
  // Progress in, how far along the way out, both 0 to 1.
  ease: (progress: number) => number;
};

// Cubic Hermite with start speed a (units of d / D) and a rest end. Monotone for 0 <= a <= 3.
export function hermiteEase(a: number): (progress: number) => number {
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    return a * (p - 2 * p * p + p * p * p) + 3 * p * p - 2 * p * p * p;
  };
}

const MAX_A = 3;
// The furthest a cubic with a <= 0 goes the wrong way past its start, as a share of v * D
// (s - 2s^2 + s^3 peaks at 4/27).
const BACK_REACH = 4 / 27;
// How fast an overshot page eases back, px/s on average.
const RETURN_PX_PER_S = 900;
const RETURN_MIN_MS = 300;

// Where the page is (y0, px), how fast it is going down the page (v0, px/s) and where
// the deal lands it. `nominalMs` is how long the leg may take (the click's leg ends
// at the same moment). Null when the page is already there.
export function planHandScroll(args: { y0: number; v0: number; landing: number; nominalMs: number }, c: CoilConstants = COIL): HandPlan | null {
  const { y0, landing, nominalMs } = args;
  const { minLegMs, overshootPx } = c.deal.cutscene;
  const d = landing - y0;
  if (Math.abs(d) <= 1) return null;
  const v = Math.max(0, args.v0);
  if (d > 0) {
    // As fast as the page is going, as far as the landing and no further.
    let durationMs = nominalMs;
    if (v > 0 && (v * durationMs) / 1000 > MAX_A * d) durationMs = Math.min(nominalMs, Math.max(minLegMs, ((MAX_A * d) / v) * 1000));
    const startVelocity = Math.min(v, (MAX_A * d) / (durationMs / 1000));
    return { durationMs, startVelocity, ease: hermiteEase((startVelocity * (durationMs / 1000)) / d) };
  }
  // A fling already carried the page past the landing: it keeps going no further than
  // overshootPx and eases back. (The start speed is what that budget allows.)
  const durationMs = Math.min(nominalMs, Math.max(RETURN_MIN_MS, (Math.abs(d) / RETURN_PX_PER_S) * 1000));
  const startVelocity = Math.min(v, overshootPx / (BACK_REACH * (durationMs / 1000)));
  return { durationMs, startVelocity, ease: hermiteEase((startVelocity * (durationMs / 1000)) / d) };
}
