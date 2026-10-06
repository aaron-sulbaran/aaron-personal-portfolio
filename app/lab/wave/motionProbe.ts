import { BINS, createSpectrum, stepSpectrum } from "./spectrum";
import type { WaveSettings } from "./settings";

// How fast the music moves the Path's dots, measured offline: the simulated
// spectrum is stepped at 60fps for `seconds` with the music fully on, and each
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
