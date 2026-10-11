// The analyser-to-columns mapping, pure so it can be tested and cached. Each
// column covers a log-spaced slice of the spectrum from 40Hz to 8kHz; its
// energy is the mean of the analyser's byte magnitudes in that slice, shaped
// into the range the wave was tuned against (idle ceiling about 0.25, reactive
// peaks past the 0.36 accent gate).

export const BAND_MIN_HZ = 40;
export const BAND_MAX_HZ = 8000;
const BAND_EXPONENT = 1.35;
const BAND_GAIN = 1.9;
const LEVEL_GAIN = 2.2;

export interface BandEdges {
  columns: number;
  binCount: number;
  sampleRate: number;
  start: Int32Array; // first bin of each column, inclusive
  end: Int32Array; // last bin of each column, exclusive
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function computeBandEdges(columns: number, binCount: number, sampleRate: number): BandEdges {
  const start = new Int32Array(columns);
  const end = new Int32Array(columns);
  const nyquist = sampleRate / 2;
  const ratio = BAND_MAX_HZ / BAND_MIN_HZ;
  for (let i = 0; i < columns; i++) {
    const f0 = BAND_MIN_HZ * Math.pow(ratio, i / columns);
    const f1 = BAND_MIN_HZ * Math.pow(ratio, (i + 1) / columns);
    const b0 = Math.min(binCount - 1, Math.floor((f0 / nyquist) * binCount));
    start[i] = b0;
    end[i] = Math.min(binCount, Math.max(b0 + 1, Math.ceil((f1 / nyquist) * binCount)));
  }
  return { columns, binCount, sampleRate, start, end };
}

// The edges only change when the column count, the analyser or the context
// rate does, so the per-frame sampler reuses the last set instead of running
// two Math.pow calls per column per frame.
let cached: BandEdges | null = null;
export function bandEdgesFor(columns: number, binCount: number, sampleRate: number): BandEdges {
  if (!cached || cached.columns !== columns || cached.binCount !== binCount || cached.sampleRate !== sampleRate) {
    cached = computeBandEdges(columns, binCount, sampleRate);
  }
  return cached;
}

// Fill `out` with each column's energy, scaled by `intro` (the ramp that makes
// the wave spring up after play), and return the overall level.
export function computeBands(freq: Uint8Array, edges: BandEdges, out: Float32Array, intro: number): number {
  let sum = 0;
  for (let i = 0; i < edges.columns; i++) {
    const b0 = edges.start[i];
    const b1 = edges.end[i];
    let acc = 0;
    for (let b = b0; b < b1; b++) acc += freq[b];
    const mean = acc / ((b1 - b0) * 255);
    out[i] = clamp01(Math.pow(mean, BAND_EXPONENT) * BAND_GAIN) * intro;
    sum += out[i];
  }
  return edges.columns ? clamp01((sum / edges.columns) * LEVEL_GAIN) * intro : 0;
}

// Each column's mean analyser byte (0 to 255), before any shaping: what the
// leveller (lib/waveform/level.ts) reads.
export function columnMeans(freq: Uint8Array, edges: BandEdges, out: Float32Array): void {
  for (let i = 0; i < edges.columns; i++) {
    let acc = 0;
    for (let b = edges.start[i]; b < edges.end[i]; b++) acc += freq[b];
    out[i] = acc / (edges.end[i] - edges.start[i]);
  }
}
