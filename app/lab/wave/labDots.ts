import { ACCENT_LINE, CENTER_RADIUS } from "@/lib/waveform/dots";
import { FLOOR } from "@/lib/waveform/field";

// The site's dot vocabulary (lib/waveform/dots.ts) with the knobs the lab
// needs exposed: dot size and row gap scale together, the fuzz cap is a
// setting, a column can be partly present (draw and dissolve dithers its dots
// out by a fixed per-dot hash rather than fading them, so the dissolve stays
// dotted), and the wave can stand vertically. At dotScale 1, presence 1 and
// a horizontal wave, a column paints exactly as buildDots paints it.

const FUZZ_RADIUS = 1.8;
const DOT_GAP = 6.5;
// buildDots' ACCENT_PEAK, not exported there: only the loudest columns' tips turn accent.
const ACCENT_PEAK = 0.36;

export interface DotGeometry {
  columns: number;
  spacing: number;
  baseline: number; // px across the canvas
  maxAmp: number;
  maxThick: number;
  dotScale: number;
  vertical: boolean;
  seed: number;
}

function push(out: number[], vertical: boolean, along: number, across: number, r: number) {
  if (vertical) out.push(across, along, r);
  else out.push(along, across, r);
}

const hash = (i: number, k: number, seed: number) => {
  const h = Math.sin(i * 12.9898 + k * 78.233 + seed * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

export function buildLabDots(
  geo: DotGeometry,
  mag: Float32Array,
  disp: Float32Array,
  presence: Float32Array,
  tip: Float32Array,
  weights: Float32Array,
  time: number,
  muted: number[],
  accent: number[],
): void {
  muted.length = 0;
  accent.length = 0;
  const { columns, spacing, baseline, maxAmp, maxThick, dotScale, vertical, seed } = geo;
  const gap = DOT_GAP * dotScale;

  for (let i = 0; i < columns; i++) {
    const p = presence[i];
    if (p <= 0) continue;
    const along = i * spacing + spacing / 2;
    const weight = weights[i];
    const magnitude = FLOOR + (mag[i] - FLOOR) * weight;
    const centre = baseline - disp[i] * weight * maxAmp;
    const grow = (p < 1 ? 0.6 + 0.4 * p : 1) * (1 + 0.45 * tip[i]) * dotScale;
    const peak = magnitude > ACCENT_PEAK;

    if (p >= 1 || hash(i, 0, seed) < p) {
      push(magnitude > ACCENT_LINE ? accent : muted, vertical, along, centre, CENTER_RADIUS * grow);
    }

    const thick = Math.min(maxThick, Math.floor((magnitude * maxAmp) / gap));
    for (let k = 1; k <= thick; k++) {
      const offset = k * gap;
      const fade = 1 - k / (thick + 1.5);
      const shimmer = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.3 + k * 2.1);
      if (shimmer >= 0.5 + fade * 0.45) continue;
      if (p < 1 && hash(i, k, seed) >= p) continue;
      const target = k >= thick && peak ? accent : muted;
      push(target, vertical, along, centre - offset, FUZZ_RADIUS * grow);
      push(target, vertical, along, centre + offset, FUZZ_RADIUS * grow);
    }
  }
}
