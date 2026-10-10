import { ACCENT_LINE, ACCENT_PEAK, CENTER_RADIUS, DOT_GAP, FUZZ_RADIUS } from "@/lib/waveform/dots";
import { FLOOR } from "@/lib/waveform/field";
import { BREATH, HEAD_SWELL, MAX_THICK, MUSIC, SHAPE_GAIN, SHIMMER, SOFT_FEATHER, SPECTRUM_PERIOD, TRAIN_FADE, WAVELENGTH } from "./constants";
import type { PathColumns } from "./columns";
import { bandAt, type MusicState } from "./music";
import { pluckAt, type PluckState } from "./pluck";

// The site's dotted wave laid along the line (the lab's paintTile, shipped
// options only): the resting shape by arc length, the head's swell, the
// train's dithered tail, the line's breath, soft rows and shimmer, thin and
// muted inside words, the music owning each column by its share. Pure.
// runLen is where the band's run ends; later views use it to split the band
// from the path, and the breath ignores it.
export interface DotFrame { head: number; tail: number; train: number | null; runLen: number; gate: number; breath: number; shimmer: number; music: MusicState; plucks: PluckState; still: boolean }
export interface DotSink { muted: number[]; accent: number[]; viewTop: number; viewBottom: number; width: number; onScreen: number }

export const createSink = (): DotSink => ({ muted: [], accent: [], viewTop: -Infinity, viewBottom: Infinity, width: Infinity, onScreen: 0 });
export function clearSink(sink: DotSink) {
  sink.muted.length = 0;
  sink.accent.length = 0;
}

const TAU = Math.PI * 2;
const shape = (a: number) => Math.sin(a) * 0.62 + Math.sin(2 * a + 1.1) * 0.26 + Math.sin(3 * a + 2.3) * 0.12;
const smooth = (v: number) => {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};
const hash = (i: number, k: number) => {
  const h = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

function emit(sink: DotSink, out: number[], x: number, y: number, r: number, top: number) {
  if (x >= 0 && x <= sink.width && y + top >= sink.viewTop && y + top <= sink.viewBottom) sink.onScreen++;
  out.push(x, y, r);
}

export function buildPathDots(
  cols: PathColumns, list: ArrayLike<number>, first: number, count: number, f: DotFrame,
  amp: number, top: number, fromS: number, toS: number, weights: Float32Array | null, sink: DotSink,
): void {
  const music = f.still ? 0 : f.music.share * MUSIC.share;
  const train = f.train !== null && !f.still;
  const tailFade = (f.train ?? 0) * TRAIN_FADE;
  for (let k = first; k < first + count; k++) {
    const j = list[k];
    const s = cols.s[j];
    if (s < fromS || s >= toS || s > f.head || s < f.tail) continue;
    let w = cols.taper[j] * (weights ? weights[j] : 1);
    let r = 1;
    if (!f.still) w *= 1 + HEAD_SWELL.gain * f.gate * Math.exp(-(((f.head - s) / HEAD_SWELL.px) ** 2));
    let present = 1;
    if (train) {
      present = smooth((s - f.tail) / tailFade);
      w *= present;
      r *= 0.6 + 0.4 * present;
      if (present < 1 && hash(j, 0) > present) continue;
    }
    const a = (TAU * s) / WAVELENGTH;
    let disp = SHAPE_GAIN * shape(a) + (f.still ? 0 : pluckAt(f.plucks, s));
    if (!f.still) disp *= 1 + BREATH.depth * f.breath * Math.sin(a * 0.5);
    let mag = FLOOR + (0.05 + 0.17 * (0.5 + 0.5 * Math.sin(a / 0.55 + 0.6)) ** 2) * (1 - music);
    if (music > 1e-3) mag += music * bandAt(f.music.bins, (s % SPECTRUM_PERIOD) / SPECTRUM_PERIOD);
    const magnitude = FLOOR + (mag - FLOOR) * w;
    const nx = cols.nx[j];
    const ny = cols.ny[j];
    const cx = cols.x[j] - nx * disp * w * amp;
    const cy = cols.y[j] - top - ny * disp * w * amp;
    const inWords = cols.inWords[j] === 1;
    const peak = !inWords && magnitude > ACCENT_PEAK;
    const rows = Math.min(MAX_THICK, (magnitude * amp) / DOT_GAP);
    const thick = Math.ceil(rows - 1e-3);
    let centre = 1;
    if (inWords && rows < 1) {
      centre = smooth(rows);
      if (centre < 0.05) continue;
    }
    emit(sink, !inWords && magnitude > ACCENT_LINE ? sink.accent : sink.muted, cx, cy, CENTER_RADIUS * r * centre, top);
    for (let q = 1; q <= thick; q++) {
      const fade = 1 - q / (rows + 1.5);
      const blink = 0.5 + 0.5 * Math.sin(j * 1.3 + q * 2.1);
      const breathe = music > 1e-3 ? 1 - SHIMMER.depth + SHIMMER.depth * (0.5 + 0.5 * Math.sin(f.shimmer + j * 1.3 + q * 2.1)) : 1;
      const kept = smooth((0.5 + fade * 0.45 - blink) / SOFT_FEATHER + 0.5) * Math.min(1, rows - (q - 1));
      if (kept < 0.05 || (present < 1 && hash(j, q) > present)) continue;
      const out = q >= thick && peak ? sink.accent : sink.muted;
      const o = q * DOT_GAP;
      const fuzz = FUZZ_RADIUS * r * breathe * kept;
      emit(sink, out, cx + nx * o, cy + ny * o, fuzz, top);
      emit(sink, out, cx - nx * o, cy - ny * o, fuzz, top);
    }
  }
}
