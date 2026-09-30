// Per-column strength of the wave, computed once per resize from the boxes the
// band's copy occupies. Text must never sit over moving dots, so a column under
// a box is scaled down until its farthest dot (`reach` px from the midline at
// full strength) stops short of the box's nearest edge; a box that already sits
// clear of the reach leaves the wave alone. The edges of each box are feathered
// so the wave eases down and back up instead of stepping, and an optional
// taper softens the wave toward the page edges, as in Aaron's sketch.

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface WeightLayout {
  columns: number;
  startX: number; // x of column 0, px
  spacing: number; // px between columns
  baseline: number; // the wave's midline, px from the canvas top
  reach: number; // farthest a dot can sit from the midline at weight 1, px
  feather: number; // px over which a box's influence fades out sideways
  edgeTaper: number; // px from each page edge over which the wave softens, 0 for none
  rects: Rect[]; // boxes to keep clear, in canvas px
}

const EDGE_FLOOR = 0.3;

const smoothstep = (edge: number, x: number) => {
  if (edge <= 0) return x > 0 ? 1 : 0;
  const t = Math.min(1, Math.max(0, x / edge));
  return t * t * (3 - 2 * t);
};

function clearanceWeight(rect: Rect, baseline: number, reach: number): number {
  const clearance =
    rect.bottom <= baseline ? baseline - rect.bottom : rect.top >= baseline ? rect.top - baseline : 0;
  return Math.min(1, Math.max(0, clearance / reach));
}

export function columnWeights(layout: WeightLayout): Float32Array {
  const { columns, startX, spacing, baseline, reach, feather, edgeTaper, rects } = layout;
  const weights = new Float32Array(columns).fill(1);
  const width = 2 * startX + (columns - 1) * spacing;

  for (let i = 0; i < columns; i++) {
    const x = startX + i * spacing;
    let weight = 1;
    for (const rect of rects) {
      const outside = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const influence = 1 - smoothstep(feather, outside);
      if (influence <= 0) continue;
      const allowed = clearanceWeight(rect, baseline, reach);
      weight = Math.min(weight, 1 + (allowed - 1) * influence);
    }
    if (edgeTaper > 0) {
      const fromEdge = Math.min(x, width - x);
      weight *= EDGE_FLOOR + (1 - EDGE_FLOOR) * smoothstep(edgeTaper, fromEdge);
    }
    weights[i] = weight;
  }
  return weights;
}

// The copy only has to clear what the wave is actually doing: the calm set
// (computed against the idle reach) lets the drift run full size beside the
// text, and the band hands over to the loud set as the music comes up. Both
// sets are computed once per resize; this blend is a lerp per column.
export function blendWeights(calm: Float32Array, loud: Float32Array, reactive: number, out: Float32Array): void {
  for (let i = 0; i < out.length; i++) out[i] = calm[i] + (loud[i] - calm[i]) * reactive;
}
