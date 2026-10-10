// The analyser levelled for this track (wave lab round 6): the site's band
// shaping saturates on it, so each column is levelled to its own range and
// quiet passages are lifted like a radio's automatic gain. The lab did both
// offline over the whole file; here they run causally (a trailing loudness
// and quantile trackers), stepped per frame with no allocation. The first
// numbers are the lab's; the rates are new.
export const LEVEL = {
  peak: 0.6, exponent: 1.35, deadRange: 8, levelGain: 2.2,
  agcWindowS: 4, agcMaxLift: 30, agcTarget: 0.75,
  rangeLo: 0.1, rangeHi: 0.98,
  rangeRate: 40, // bytes per second a column's range estimates move
  targetRate: 8, // bytes per second the loudness target moves
  warmS: 3, warmBoost: 5, // the first seconds of music learn faster
};

export interface Leveller { lo: Float32Array; hi: Float32Array; windowed: number; target: number; heard: number; lift: number }
export const createLeveller = (columns: number): Leveller => ({ lo: new Float32Array(columns), hi: new Float32Array(columns), windowed: 0, target: 0, heard: 0, lift: 0 });

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Levels one frame of column means (bytes) into `out` (0..LEVEL.peak); returns the overall level.
export function levelColumns(state: Leveller, means: Float32Array, dt: number, out: Float32Array): number {
  const n = Math.min(means.length, out.length, state.lo.length);
  let sum = 0;
  let sounding = 0;
  for (let c = 0; c < n; c++) {
    if (means[c] <= 0) continue;
    sum += means[c];
    sounding++;
  }
  if (!sounding) {
    out.fill(0);
    return 0;
  }
  const loud = sum / sounding;
  if (state.heard === 0) {
    state.windowed = loud;
    state.target = loud;
    for (let c = 0; c < n; c++) state.lo[c] = state.hi[c] = means[c];
  }
  state.heard += dt;
  const boost = state.heard < LEVEL.warmS ? LEVEL.warmBoost : 1;
  state.windowed += (loud - state.windowed) * (1 - Math.exp(-dt / (LEVEL.agcWindowS / 2)));
  state.target += LEVEL.targetRate * boost * dt * (state.windowed > state.target ? LEVEL.agcTarget : LEVEL.agcTarget - 1);
  state.lift = Math.max(0, Math.min(LEVEL.agcMaxLift, state.target - state.windowed));
  const r = LEVEL.rangeRate * boost * dt;
  let total = 0;
  for (let c = 0; c < n; c++) {
    const byte = means[c] > 0 ? Math.min(255, means[c] + state.lift) : 0;
    state.lo[c] += r * (LEVEL.rangeLo - (byte < state.lo[c] ? 1 : 0));
    state.hi[c] += r * (LEVEL.rangeHi - (byte < state.hi[c] ? 1 : 0));
    const range = state.hi[c] - state.lo[c];
    out[c] = range < LEVEL.deadRange ? 0 : LEVEL.peak * Math.pow(clamp01((byte - state.lo[c]) / range), LEVEL.exponent);
    total += out[c];
  }
  return clamp01((total / n) * LEVEL.levelGain);
}
