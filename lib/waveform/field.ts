import type { SoundtrackState } from "@/lib/soundtrack";

// The waveform field as pure math: per-column magnitude (how thick the column's
// dot stack is) and displacement (how far its centerline sits off the band's
// midline), both in units of the band's max amplitude. The band's view
// (components/soundtrack/waveView.ts) only turns these into dots, through
// lib/waveform/dots.ts.
//
// Column weights are applied at paint time (lib/waveform/dots.ts), not here,
// so two views with different weights can share one field. `phase` comes from
// the scroll conveyor (lib/waveform/conveyor.ts) and slides the shape along
// the columns; the analyser bands stay bound to the integer column.
//
// Every clock here runs in SECONDS. The canvas converts the rAF timestamp once
// (`t / 1000`); feeding raw milliseconds aliases the sines about 1000 times too
// fast, which is the jitter the AGENTS.md invariant exists to prevent.
//
// Easing is time-based. Each rate below is the per-frame lerp the wave was
// tuned with at the playground's ~45fps; easeToward turns it into the same
// felt speed at any refresh rate, so a 120Hz display no longer runs the
// transitions faster than a 60Hz one.

export type Regime = "idle" | "paused" | "reactive" | "still";

export interface Levels {
  idle: number;
  paused: number;
  reactive: number;
}

// The magnitude every column rests at: the thin dotted centerline.
export const FLOOR = 0.016;

const REFERENCE_FPS = 45;
const SETTLE_EPSILON = 1e-3;

// before is the calm idle drift, on reacts to the analyser, paused is the
// quiet waiting wave, and off ("Maybe later") comes to rest as a still line.
export function regimeOf(state: SoundtrackState): Regime {
  if (state === "on") return "reactive";
  if (state === "paused") return "paused";
  if (state === "off") return "still";
  return "idle";
}

export function levelTargets(regime: Regime): Levels {
  return {
    idle: regime === "idle" ? 1 : 0,
    paused: regime === "paused" ? 1 : 0,
    reactive: regime === "reactive" ? 1 : 0,
  };
}

// Exponential approach toward `target`: `rate` is the fraction covered per
// reference frame, dt is seconds. Composes exactly, so two half steps equal
// one whole step.
export function easeToward(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.pow(1 - rate, dt * REFERENCE_FPS);
}

// The asymmetric rates are what make the transitions felt: opting in springs
// the reactive wave up from the quiet line, pausing collapses fast into the
// waiting wave and holds, and only the idle drift blooms back slowly.
export function stepLevels(levels: Levels, regime: Regime, dt: number): Levels {
  const target = levelTargets(regime);
  return {
    idle: easeToward(levels.idle, target.idle, target.idle ? 0.03 : 0.07, dt),
    paused: easeToward(levels.paused, target.paused, target.paused ? 0.14 : 0.06, dt),
    reactive: easeToward(levels.reactive, target.reactive, target.reactive ? 0.05 : 0.11, dt),
  };
}

// Where column i's magnitude is heading at `time` seconds, before weights and
// the cursor carve. i is a float: the caller subtracts the conveyor's phase,
// so a negative phase (scrolling down) shows the shape further left.
export function columnTarget(i: number, time: number, levels: Levels, band: number): number {
  const ambient = 0.11 + 0.07 * Math.sin(time * 0.5 + i * 0.35) + 0.05 * Math.sin(time * 0.21 + i * 0.12);
  const thin = 0.035 + 0.015 * Math.sin(time * 1.3 + i * 0.6);
  return FLOOR + ambient * levels.idle + thin * levels.paused + band * levels.reactive;
}

// Column i's signed displacement at `time` seconds: the waving shape. The idle
// and paused drifts are shaped here; the reactive swing rides the audio level.
export function columnDisplacement(i: number, time: number, levels: Levels, audioLevel: number): number {
  const ambient = Math.sin(i * 0.25 + time * 0.6) * 0.16;
  const thin = Math.sin(i * 0.4 + time * 1.0) * 0.02;
  const music = (Math.sin(i * 0.3 + time * 3) * 0.42 + Math.sin(i * 0.13 + time * 1.5) * 0.2) * audioLevel;
  return ambient * levels.idle + thin * levels.paused + music * levels.reactive;
}

export interface Field {
  levels: Levels;
  mag: Float32Array;
  disp: Float32Array;
  carve: Float32Array;
}

export interface FieldInput {
  time: number; // seconds
  dt: number; // seconds since the previous step
  regime: Regime;
  bands: Float32Array; // analyser energy per column, 0..1
  audioLevel: number; // 0..1
  phase: number; // columns, from the conveyor
  carve: Float32Array | null; // cursor carve target per column, 0..1
}

export function createField(columns: number, regime: Regime = "idle"): Field {
  return {
    levels: levelTargets(regime),
    mag: new Float32Array(columns),
    disp: new Float32Array(columns),
    carve: new Float32Array(columns),
  };
}

// Advance the field one step. `settled` is true once nothing would visibly
// change on the next step, which only happens in the still regime (a resting
// cursor's carve included); the canvas then stops its loop until the music,
// the cursor or the band wakes it.
export function stepField(field: Field, input: FieldInput): { settled: boolean } {
  const { time, dt, regime, bands, audioLevel, phase, carve } = input;
  const levels = stepLevels(field.levels, regime, dt);
  field.levels = levels;
  const goal = levelTargets(regime);
  let settled =
    Math.abs(levels.idle - goal.idle) < SETTLE_EPSILON &&
    Math.abs(levels.paused - goal.paused) < SETTLE_EPSILON &&
    Math.abs(levels.reactive - goal.reactive) < SETTLE_EPSILON;

  for (let i = 0; i < field.mag.length; i++) {
    const j = i - phase;
    let target = columnTarget(j, time, levels, bands[i] ?? 0);
    const carveTarget = carve ? carve[i] : 0;
    field.carve[i] = easeToward(field.carve[i], carveTarget, 0.1, dt);
    target *= 1 - field.carve[i] * 0.9;
    const before = field.mag[i];
    field.mag[i] = easeToward(before, target, target > before ? 0.35 : 0.12, dt);
    field.disp[i] = columnDisplacement(j, time, levels, audioLevel);
    if (settled && (Math.abs(field.mag[i] - target) > SETTLE_EPSILON || Math.abs(field.carve[i] - carveTarget) > SETTLE_EPSILON || Math.abs(field.disp[i]) > SETTLE_EPSILON)) {
      settled = false;
    }
  }
  return { settled };
}
