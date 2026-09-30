import type { Field } from "./field";

// Turns the field into dots: each column is a centerline dot displaced off the
// midline, with a stack of fuzz dots above and below it as thick as the
// column's magnitude. Presence comes from size and density, not opacity; the
// one accent only paints the loud columns. The cursor both hollows the columns
// under it (carve, fed back into the field) and pushes nearby dots away
// (repel, applied here). Both scale with the column weight, so a column held
// still under the band's copy stays still even with the cursor on it.

export interface DotLayout {
  columns: number;
  startX: number;
  spacing: number;
  baseline: number;
  maxAmp: number;
}

export interface Cursor {
  x: number;
  y: number;
  on: boolean;
}

export const CENTER_RADIUS = 2.2;
const FUZZ_RADIUS = 1.8;
const DOT_GAP = 6.5;
// Above the idle drift's ~0.25 ceiling, so only music-on peaks turn accent.
const ACCENT_LINE = 0.3;
const ACCENT_PEAK = 0.36;
const REPEL_RADIUS = 92;
const REPEL_FORCE = 26;
const CARVE_RADIUS = 74;
// |displacement| + magnitude, in max amplitudes: the idle drift peaks near
// 0.41 (the paused wave far lower), the loudest music near 1.62. Each leaves
// a little headroom.
const EXTENT = { calm: 0.45, loud: 1.7 };

// The farthest a column's dots can sit from the midline at weight 1, px, for
// the calm regimes (idle, paused, still) or for music at full level.
export function reachOf(maxAmp: number, loudness: keyof typeof EXTENT): number {
  return EXTENT[loudness] * maxAmp + REPEL_FORCE;
}

export function carveTargets(layout: DotLayout, cursor: Cursor, out: Float32Array): void {
  const near = cursor.on && Math.abs(cursor.y - layout.baseline) < layout.maxAmp + 70;
  for (let i = 0; i < layout.columns; i++) {
    const distance = Math.abs(layout.startX + i * layout.spacing - cursor.x);
    out[i] = near && distance < CARVE_RADIUS ? 1 - distance / CARVE_RADIUS : 0;
  }
}

function pushDot(out: number[], x: number, y: number, r: number, cursor: Cursor, weight: number) {
  if (cursor.on && weight > 0) {
    const dx = x - cursor.x;
    const dy = y - cursor.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < REPEL_RADIUS * REPEL_RADIUS && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const force = (1 - d / REPEL_RADIUS) * REPEL_FORCE * weight;
      x += (dx / d) * force;
      y += (dy / d) * force;
    }
  }
  out.push(x, y, r);
}

// Fill `muted` and `accent` with flat [x, y, r, ...] triples for one frame.
// `time` is in seconds (the fuzz shimmer).
export function buildDots(
  field: Field,
  layout: DotLayout,
  time: number,
  weights: Float32Array,
  cursor: Cursor,
  muted: number[],
  accent: number[],
): void {
  muted.length = 0;
  accent.length = 0;
  const { columns, startX, spacing, baseline, maxAmp } = layout;
  for (let i = 0; i < columns; i++) {
    const x = startX + i * spacing;
    const weight = weights[i] ?? 1;
    const magnitude = field.mag[i];
    const cy = baseline - field.disp[i] * maxAmp;
    const peak = magnitude > ACCENT_PEAK;
    pushDot(magnitude > ACCENT_LINE ? accent : muted, x, cy, CENTER_RADIUS, cursor, weight);

    const thick = Math.floor((magnitude * maxAmp) / DOT_GAP);
    for (let k = 1; k <= thick; k++) {
      const offset = k * DOT_GAP;
      const fade = 1 - k / (thick + 1.5);
      const shimmer = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.3 + k * 2.1);
      if (shimmer >= 0.5 + fade * 0.45) continue;
      const target = k >= thick && peak ? accent : muted;
      pushDot(target, x, cy - offset, FUZZ_RADIUS, cursor, weight);
      pushDot(target, x, cy + offset, FUZZ_RADIUS, cursor, weight);
    }
  }
}
