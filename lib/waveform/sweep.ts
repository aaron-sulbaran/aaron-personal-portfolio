import { smoothstep01 } from "./weights";

// The handoff from the band to the horizon as one train of columns on two
// tracks. `sweep` runs from 0 (all of the wave in the band) to 1 (all of it on
// the horizon); a scroll trigger writes the target and one exponential stage,
// speed capped, closes the gap, so an anchor jump plays as a short glide and
// reversing the scroll reverses the train for free.
//
// The train is as long as its columns (floor(width / spacing) of them, as
// bandLayout lays them), not the view's width: shifting both tracks by that
// length puts the horizon's head exactly one spacing past the band's last
// column at every sweep, whatever the centering margin. The junction curl and
// the swell only exist in transit and are identities at rest.

export const SWEEP = { lambda: 8, capPerSecond: 1.5, curlColumns: 10, swell: 0.6 };

const REST_EPSILON = 1e-4;
const TIP_THINNING = 0.7;

export interface SweepState {
  value: number;
  target: number;
}

export function createSweep(): SweepState {
  return { value: 0, target: 0 };
}

export function stepSweep(state: SweepState, dt: number): boolean {
  const gap = state.target - state.value;
  if (Math.abs(gap) < REST_EPSILON) {
    state.value = state.target;
    return false;
  }
  let step = gap * (1 - Math.exp(-SWEEP.lambda * dt));
  const cap = SWEEP.capPerSecond * dt;
  if (step > cap) step = cap;
  else if (step < -cap) step = -cap;
  state.value += step;
  return true;
}

export function trainX(
  i: number,
  layout: { startX: number; spacing: number },
  width: number,
  sweep: number,
  side: "band" | "horizon",
): number {
  const length = Math.floor(width / layout.spacing) * layout.spacing;
  const x = layout.startX + i * layout.spacing;
  return side === "band" ? x - sweep * length : x + (1 - sweep) * length;
}

// Transit gates the curl so the band at 0 and the horizon at 1 paint flat.
export function junction(
  i: number,
  columns: number,
  sweep: number,
  side: "band" | "horizon",
  curlPx: number,
): { dy: number; scale: number } {
  const curl = SWEEP.curlColumns;
  let t: number;
  if (side === "band" && i >= columns - curl) t = (i - (columns - curl)) / curl;
  else if (side === "horizon" && i < curl) t = 1 - i / curl;
  else return { dy: 0, scale: 1 };
  if (sweep <= 0 || sweep >= 1) return { dy: 0, scale: 1 };
  const transit = Math.sin(Math.PI * sweep);
  const dy = curlPx * smoothstep01(t) * transit;
  return { dy: side === "band" ? dy : -dy, scale: 1 - TIP_THINNING * t * transit };
}

export function swell(sweep: number): number {
  return 1 + SWEEP.swell * Math.sin(Math.PI * sweep);
}
