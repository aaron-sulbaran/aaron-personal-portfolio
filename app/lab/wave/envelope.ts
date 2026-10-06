import { computeBands, type BandEdges } from "@/lib/waveform/bands";

// The real track's spectrum, replayed in silence. tools/analyseTrack.mjs
// decoded public/audio/track-01.mp3 (no playback) and ran the site's
// analysis over its first 90 seconds: per frame (30 a second), each of 64
// log-spaced columns' mean analyser byte, 0 to 255. Nothing here touches
// audio; the lab reads the numbers on its own clock.
//
// Two shapings:
//   "site": the site's own computeBands (lib/waveform/bands.ts) on the
//           stored means, exactly what the band would show. On this track it
//           saturates: the middle columns sit at 1.0 for more than half of
//           every second, so the hits barely register.
//   "auto": levelled twice. First like a radio's automatic gain: the
//           track's loudness over a 4 s window is lifted toward its loud
//           sections (at most 30 bytes, about 8 dB; never cut), so the soft
//           intro (its first 30 s) hits as clearly as the body. Then each
//           column to its own range over the 90 seconds (its 10th percentile
//           to its 98th), the site's exponent, up to AUTO_PEAK. Every column
//           moves through its range with the music, so the hits show; the
//           spectrum's balance is the price (the treble moves as much as the
//           bass). Offline over the track, in rows a side (amplitude 80,
//           intensity 1.2, cap 5): a column's median swing per 2 s is 1.1
//           rows in the intro and 1.5 in the body, against 0 for the site
//           shaping (saturated) and 0.4 and 1.2 levelled per column alone.

export interface EnvelopeFile {
  fps: number;
  columns: number;
  frames: number;
  bins: string; // base64, frames x columns bytes, frame-major
  credit?: string;
}

export interface Envelope {
  fps: number;
  columns: number;
  frames: number;
  duration: number; // s, the loop
  bins: Uint8Array; // as analysed: the site shaping reads these
  levelled: Uint8Array; // after the automatic gain: the auto shaping reads these
  lo: Float32Array; // each column's 10th percentile levelled byte
  hi: Float32Array; // and its 98th
}

export type Shaping = "auto" | "site";

export const AUTO_PEAK = 0.6;
const AUTO_EXPONENT = 1.35;
const LEVEL_GAIN = 2.2;
const DEAD_RANGE = 8; // bytes: a column that never moves more than this stays silent
const AGC_WINDOW_S = 4;
const AGC_MAX_LIFT = 30; // bytes; the analyser's 70 dB over 255 bytes makes this about 8 dB
const AGC_TARGET = 0.75; // the loudness lifted toward: this quantile of the windowed loudness

// The automatic gain: each frame's loudness (the mean of its sounding
// columns), averaged over a centred window, lifted toward the loud sections.
// Bytes are decibels, so a lift is a gain; a silent column (0) stays silent.
export function levelEnvelope(bins: Uint8Array, columns: number, frames: number, fps: number): Uint8Array {
  const loud = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let n = 0;
    for (let c = 0; c < columns; c++) {
      const v = bins[f * columns + c];
      if (v > 0) {
        sum += v;
        n++;
      }
    }
    loud[f] = n ? sum / n : 0;
  }
  const half = Math.round((AGC_WINDOW_S * fps) / 2);
  const windowed = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const a = Math.max(0, f - half);
    const b = Math.min(frames - 1, f + half);
    for (let k = a; k <= b; k++) sum += loud[k];
    windowed[f] = sum / (b - a + 1);
  }
  const target = Float64Array.from(windowed).sort()[Math.floor(frames * AGC_TARGET)];
  const out = new Uint8Array(bins.length);
  for (let f = 0; f < frames; f++) {
    const lift = Math.max(0, Math.min(AGC_MAX_LIFT, target - windowed[f]));
    for (let c = 0; c < columns; c++) {
      const v = bins[f * columns + c];
      out[f * columns + c] = v > 0 ? Math.min(255, Math.round(v + lift)) : 0;
    }
  }
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function base64Bytes(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function decodeEnvelope(file: EnvelopeFile): Envelope {
  const bins = base64Bytes(file.bins);
  const { columns, frames } = file;
  if (!(columns > 0 && frames > 0 && file.fps > 0) || bins.length !== columns * frames) {
    throw new Error(`envelope: ${bins.length} bytes for ${frames} frames of ${columns} columns`);
  }
  const levelled = levelEnvelope(bins, columns, frames, file.fps);
  const lo = new Float32Array(columns);
  const hi = new Float32Array(columns);
  const column = new Uint8Array(frames);
  for (let c = 0; c < columns; c++) {
    for (let f = 0; f < frames; f++) column[f] = levelled[f * columns + c];
    column.sort();
    lo[c] = column[Math.floor(frames * 0.1)];
    hi[c] = column[Math.min(frames - 1, Math.floor(frames * 0.98))];
  }
  return { fps: file.fps, columns, frames, duration: frames / file.fps, bins, levelled, lo, hi };
}

// One bin per column, so computeBands' mean over a column's bins is the stored mean itself.
const identity = new Map<number, BandEdges>();
function identityEdges(columns: number): BandEdges {
  let edges = identity.get(columns);
  if (!edges) {
    const start = Int32Array.from({ length: columns }, (_, i) => i);
    const end = Int32Array.from({ length: columns }, (_, i) => i + 1);
    edges = { columns, binCount: columns, sampleRate: 0, start, end };
    identity.set(columns, edges);
  }
  return edges;
}

const scratch = { bytes: new Uint8Array(0) };

// Each column's band energy (0..1) at `t` seconds into the loop, linearly
// between frames, into `out` (length = columns). Returns the level, as the
// site computes it.
export function sampleEnvelope(env: Envelope, t: number, shaping: Shaping, out: Float32Array): number {
  const { columns, frames, bins } = env;
  const pos = ((((t * env.fps) % frames) + frames) % frames);
  const i0 = Math.floor(pos);
  const i1 = (i0 + 1) % frames;
  const k = pos - i0;
  const a = i0 * columns;
  const b = i1 * columns;
  if (shaping === "site") {
    if (scratch.bytes.length !== columns) scratch.bytes = new Uint8Array(columns);
    for (let c = 0; c < columns; c++) scratch.bytes[c] = Math.round(bins[a + c] + (bins[b + c] - bins[a + c]) * k);
    return computeBands(scratch.bytes, identityEdges(columns), out, 1);
  }
  const levelled = env.levelled;
  let sum = 0;
  for (let c = 0; c < columns; c++) {
    const range = env.hi[c] - env.lo[c];
    const byte = levelled[a + c] + (levelled[b + c] - levelled[a + c]) * k;
    out[c] = range < DEAD_RANGE ? 0 : AUTO_PEAK * Math.pow(clamp01((byte - env.lo[c]) / range), AUTO_EXPONENT);
    sum += out[c];
  }
  return clamp01((sum / columns) * LEVEL_GAIN);
}

// The file is loaded once, on first use, as its own chunk; until it lands the
// track is silent.
let loaded: Envelope | null = null;
let pending: Promise<Envelope> | null = null;

export function loadEnvelope(): Promise<Envelope> {
  pending ??= import("./envelope/track-01.json").then((m) => {
    loaded = decodeEnvelope((m.default ?? m) as EnvelopeFile);
    return loaded;
  });
  return pending;
}

export function getEnvelope(): Envelope | null {
  if (!loaded && !pending && typeof window !== "undefined") {
    loadEnvelope().catch((error) => {
      console.warn("Wave lab: the track envelope did not load; the real-track music stays silent.", error);
    });
  }
  return loaded;
}
