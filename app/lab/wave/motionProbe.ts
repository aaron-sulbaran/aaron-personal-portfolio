import { getEnvelope } from "./envelope";
import { BINS, createSpectrum, stepSpectrum } from "./spectrum";
import type { WaveSettings } from "./settings";

// How fast the music moves the Path's dots, measured offline: the spectrum
// (the current source) is stepped at 60fps for `seconds` with the music fully on, and each
// bin is turned into the px it pushes the outermost fuzz row out from the
// spine (music layer x band x amplitude; a straight column at rest, so the
// head's swell would multiply it by up to 1.7). From the lab's console:
// window.__waveLab.motionProbe().

const FPS = 60;
const SETTLE_S = 8;
const FUZZ_RADIUS = 1.8;
const DOT_GAP = 6.5;

export interface MotionReport {
  maxPxPerS: number; // the fastest any outer row moves, px/s
  p99PxPerS: number; // 99th percentile over every bin and frame
  medianPxPerS: number;
  fastestRiseS: number; // the quickest 10 to 90 percent rise of at least one row (a visible transient)
  medianRiseS: number;
  rowChangesPerS: number; // per column: how often its row count steps (a row popping in or out, without soft rows)
  shimmerPxPerS: number; // the fastest a fuzz dot's radius breathes, px/s ("soft" shimmer)
  rangePx: number; // the outer row's travel, smallest to largest, over the run
}

const percentile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0);

export function probeMotion(settings: WaveSettings, seconds = 60): MotionReport {
  const dt = 1 / FPS;
  const spectrum = createSpectrum();
  const scale = settings.path.musicLayer * settings.amplitude;
  const gap = DOT_GAP * settings.dotScale;
  const frames = Math.round(seconds * FPS);
  const settle = SETTLE_S * FPS;
  for (let f = 0; f < settle; f++) stepSpectrum(spectrum, dt, settings.intensity, settings.beat, settings.motion);

  const history = new Float32Array(frames * BINS);
  for (let f = 0; f < frames; f++) {
    stepSpectrum(spectrum, dt, settings.intensity, settings.beat, settings.motion);
    for (let b = 0; b < BINS; b++) history[f * BINS + b] = spectrum.bins[b] * scale;
  }

  const rates: number[] = [];
  const rises: number[] = [];
  let rowSteps = 0;
  let low = Infinity;
  let high = -Infinity;
  for (let b = 0; b < BINS; b++) {
    const at = (f: number) => history[f * BINS + b];
    let trough = 0;
    for (let f = 1; f < frames; f++) {
      const v = at(f);
      low = Math.min(low, v);
      high = Math.max(high, v);
      rates.push(Math.abs(v - at(f - 1)) / dt);
      if (Math.floor(v / gap) !== Math.floor(at(f - 1) / gap)) rowSteps++;
      const rising = v > at(f - 1);
      const peakNow = rising && (f === frames - 1 || at(f + 1) <= v);
      if (!rising) trough = f;
      if (peakNow) {
        const from = at(trough);
        const height = v - from;
        if (height >= gap) {
          let t10 = trough;
          while (at(t10) < from + 0.1 * height) t10++;
          let t90 = t10;
          while (at(t90) < from + 0.9 * height) t90++;
          rises.push((t90 - t10) * dt);
        }
      }
    }
  }
  rates.sort((a, b) => a - b);
  rises.sort((a, b) => a - b);
  const m = settings.motion;
  return {
    maxPxPerS: rates[rates.length - 1] ?? 0,
    p99PxPerS: percentile(rates, 0.99),
    medianPxPerS: percentile(rates, 0.5),
    fastestRiseS: rises[0] ?? Infinity,
    medianRiseS: percentile(rises, 0.5),
    rowChangesPerS: rowSteps / BINS / seconds,
    shimmerPxPerS: FUZZ_RADIUS * settings.dotScale * m.shimmerDepth * 0.5 * m.shimmerRate * m.speed,
    rangePx: high - low,
  };
}

// The beat response (round 6): how far the music moves each column, and how
// fast a hit arrives. A series is frames x BINS of the music's share of a
// column's reach, px (music layer x band x amplitude: what the music adds to,
// or with the music owning the column, what it is); `times` in seconds.
// Rows a side are read after the rows cap, over a mid resting column (the
// resting shape's middle, ducked by the music share), so a hit lost to the
// cap shows up as a smaller row swing.
export interface BeatReport {
  seconds: number;
  frames: number;
  swingPx: { median: number; max: number }; // per column: peak minus trough over the window, the median and largest over live columns
  rowsSwing: { median: number; max: number }; // the same in rows a side, after the cap
  riseS: { median: number; fastest: number; count: number }; // 10 to 90 percent of every rise of a row or more (NaN with none)
  meanPx: number; // the music's mean reach over every column and frame
  columnsPx: number[]; // each column's mean reach, low to high
}

export interface BeatScale {
  gapPx: number; // a row
  capPx: number; // the rows cap, px
  restPx: number; // a mid resting column's reach under the music, px
}

export function measureBeat(series: Float32Array, times: Float32Array, frames: number, scale: BeatScale): BeatReport {
  const swings: number[] = [];
  const rowSwings: number[] = [];
  const rises: number[] = [];
  const rows = (px: number) => Math.min(scale.capPx, scale.restPx + px) / scale.gapPx;
  const columnsPx: number[] = [];
  let total = 0;
  for (let b = 0; b < BINS; b++) {
    const at = (f: number) => series[f * BINS + b];
    let lo = Infinity;
    let hi = -Infinity;
    let trough = 0;
    let sum = 0;
    for (let f = 0; f < frames; f++) {
      const v = at(f);
      sum += v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      if (f === 0) continue;
      const rising = v > at(f - 1);
      if (!rising) trough = f;
      const peak = rising && (f === frames - 1 || at(f + 1) <= v);
      if (!peak) continue;
      const from = at(trough);
      const height = v - from;
      if (height < scale.gapPx) continue;
      let t10 = trough;
      while (at(t10) < from + 0.1 * height) t10++;
      let t90 = t10;
      while (at(t90) < from + 0.9 * height) t90++;
      rises.push(times[t90] - times[t10]);
    }
    columnsPx.push(frames ? sum / frames : 0);
    total += sum;
    if (hi < 0.5) continue; // a silent column
    swings.push(hi - lo);
    rowSwings.push(rows(hi) - rows(lo));
  }
  const sorted = (a: number[]) => a.sort((x, y) => x - y);
  sorted(swings);
  sorted(rowSwings);
  sorted(rises);
  return {
    seconds: frames > 1 ? times[frames - 1] - times[0] : 0,
    frames,
    swingPx: { median: percentile(swings, 0.5), max: swings[swings.length - 1] ?? 0 },
    rowsSwing: { median: percentile(rowSwings, 0.5), max: rowSwings[rowSwings.length - 1] ?? 0 },
    riseS: { median: rises.length ? percentile(rises, 0.5) : NaN, fastest: rises[0] ?? NaN, count: rises.length },
    meanPx: frames ? total / (frames * BINS) : 0,
    columnsPx,
  };
}

const REST_SHAPE = 0.135; // the resting shape's middle above the floor (pathEngine.ts: 0.05 + 0.17 x 0.5)
const FLOOR_MAG = 0.016;

export function beatScale(settings: WaveSettings): BeatScale {
  const amp = settings.amplitude;
  const gap = DOT_GAP * settings.dotScale;
  return { gapPx: gap, capPx: settings.maxThick * gap, restPx: (FLOOR_MAG + REST_SHAPE * (1 - settings.path.musicLayer)) * amp };
}

// Offline: the music fully up, stepped at 60fps from the start of the track
// (or the simulation), cut into 2 s windows; the median window's numbers.
// Null while the track's envelope is still loading.
export function probeBeat(settings: WaveSettings, seconds = 60, window = 2): (Omit<BeatReport, "columnsPx"> & { windows: number }) | null {
  const dt = 1 / FPS;
  const spectrum = createSpectrum();
  if (settings.motion.source !== "simulated" && !getEnvelope()) return null;
  const per = Math.round(window * FPS);
  const count = Math.max(1, Math.floor((seconds * FPS) / per));
  const scale = beatScale(settings);
  const px = settings.path.musicLayer * settings.amplitude;
  const series = new Float32Array(per * BINS);
  const times = new Float32Array(per);
  const reports: BeatReport[] = [];
  for (let w = 0; w < count; w++) {
    for (let f = 0; f < per; f++) {
      stepSpectrum(spectrum, dt, settings.intensity, settings.beat, settings.motion);
      times[f] = (w * per + f) * dt;
      for (let b = 0; b < BINS; b++) series[f * BINS + b] = spectrum.bins[b] * px;
    }
    reports.push(measureBeat(series, times, per, scale));
  }
  const mid = (pick: (r: BeatReport) => number) => percentile(reports.map(pick).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b), 0.5);
  return {
    seconds: count * window,
    frames: count * per,
    windows: count,
    swingPx: { median: mid((r) => r.swingPx.median), max: mid((r) => r.swingPx.max) },
    rowsSwing: { median: mid((r) => r.rowsSwing.median), max: mid((r) => r.rowsSwing.max) },
    riseS: { median: mid((r) => r.riseS.median), fastest: Math.min(...reports.map((r) => r.riseS.fastest).filter((v) => !Number.isNaN(v))), count: reports.reduce((n, r) => n + r.riseS.count, 0) },
    meanPx: mid((r) => r.meanPx),
  };
}
