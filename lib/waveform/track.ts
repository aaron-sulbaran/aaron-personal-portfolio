import type { DotLayout } from "./dots";
import { junction, swell, trainX, type Junction } from "./sweep";

// One track of the train for this frame: where each column paints, its
// junction lift, and its strength from `base` sampled at the painted x (so
// the band's copy clearance and the page-edge taper follow the column as it
// travels), thinned at the junction and swollen in transit. The swell fades
// with that strength, so a column held clear of the copy never gets the
// transit boost. Writes into the caller's preallocated arrays.
export function layTrack(
  layout: DotLayout,
  sweep: number,
  side: "band" | "horizon",
  curlPx: number,
  base: Float32Array,
  xs: Float32Array,
  offsets: Float32Array,
  weights: Float32Array,
  scratch: Junction,
): void {
  const { columns, startX, spacing } = layout;
  const grow = swell(sweep);
  for (let i = 0; i < columns; i++) {
    const x = trainX(i, layout, columns, sweep, side);
    xs[i] = x;
    junction(i, columns, sweep, side, curlPx, scratch);
    offsets[i] = scratch.dy;
    const home = Math.min(columns - 1, Math.max(0, Math.round((x - startX) / spacing)));
    const strength = base[home] ?? 1;
    weights[i] = strength * scratch.scale * (1 + (grow - 1) * strength);
  }
}
