import { FLOOR } from "@/lib/waveform/field";
import type { LoopKind } from "./settings";

// The loops as pure math over one wave surface. Each fills, per column:
// mag (fuzz thickness) and disp (centreline offset), both in the field's
// max-amplitude units as in lib/waveform/field.ts, plus presence (0 hides the
// column's dots, 1 shows them all; draw and dissolve dithers between) and tip
// (the pen's swell at the drawing front).
//
// Seamless means every time term repeats exactly once per `period`: a
// travelling term moves one wavelength per period, a standing term turns a
// whole number of times. Anything else (the swell's carrier, the music) is
// zero at the loop's seam, so the cut never shows.

const TAU = Math.PI * 2;

export interface LoopInput {
  kind: LoopKind;
  columns: number;
  spacing: number; // px between columns
  length: number; // px along the wave
  shift: number; // px, the scroll conveyor's offset (0 at no influence)
  time: number; // seconds, already offset per surface
  period: number; // seconds
  speed: number; // px per second
}

export interface LoopOut {
  mag: Float32Array;
  disp: Float32Array;
  presence: Float32Array;
  tip: Float32Array;
}

// One organic, 2pi-periodic profile: a fundamental with two softer harmonics.
const shape = (a: number) => Math.sin(a) * 0.62 + Math.sin(2 * a + 1.1) * 0.26 + Math.sin(3 * a + 2.3) * 0.12;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
// Half linear, half smoothstep: a crossing that starts and lands softly but
// never stalls in the middle.
const glide = (v: number) => 0.5 * clamp01(v) + 0.5 * smooth(v);

const wavelength = (speed: number, period: number, min: number) => Math.max(min, speed * period);

// Draw and dissolve phase split, shared with stillTime.
function drawPhases(length: number, speed: number, period: number) {
  const draw = Math.min(0.36, length / Math.max(speed, 1) / period);
  const rest = 0.1;
  return { draw, dissolve: draw, rest, hold: Math.max(0, 1 - 2 * draw - rest) };
}

export function sampleLoop(input: LoopInput, out: LoopOut): void {
  const { kind, columns, spacing, length, shift, time, period, speed } = input;
  const { mag, disp, presence, tip } = out;
  const cycle = ((time % period) + period) % period;
  const tau = cycle / period;
  const theta = TAU * tau;
  const L = Math.max(length, 1);

  // Per-loop constants, hoisted out of the column loop.
  const travelLambda = wavelength(speed, period, 160);
  const standingLambda = L / 1.6;
  const pulseWidth = Math.min(260, Math.max(80, L * 0.12));
  const pulseDuration = Math.min(period * 0.8, (L + 4 * pulseWidth) / Math.max(speed, 1));
  const pulseT = cycle / pulseDuration;
  const pulseCentre = pulseT < 1 ? -2 * pulseWidth + (L + 4 * pulseWidth) * glide(pulseT) : -1e9;
  const phases = drawPhases(L, speed, period);
  const soft = 0.12;

  for (let i = 0; i < columns; i++) {
    const x = i * spacing + spacing / 2 - shift;
    const u = x / L;
    let m = FLOOR;
    let d = 0;
    let p = 1;
    let pen = 0;

    if (kind === "standing") {
      // Two fixed profiles traded in quadrature: the line never goes flat,
      // it morphs from one shape to the other and back, once per period.
      const s1 = shape((TAU * x) / standingLambda);
      const s2 = shape((TAU * x) / (standingLambda * 0.63) + 1.7);
      d = 0.3 * (s1 * Math.cos(theta) + 0.55 * s2 * Math.sin(theta));
      m = FLOOR + 0.03 + 0.09 * (0.5 + 0.5 * Math.cos(2 * theta)) * (0.55 + 0.45 * Math.abs(s1));
    } else if (kind === "travel") {
      const a = TAU * (x / travelLambda - tau);
      // The thickness rides a second, shorter train at a different speed
      // (still one whole turn per period), so the crests and the fuzz slide
      // past each other instead of moving as one rigid slab.
      const b = TAU * (x / (travelLambda * 0.55) - tau);
      d = 0.28 * shape(a) * (0.86 + 0.14 * Math.cos(theta));
      m = FLOOR + 0.03 + 0.1 * (0.5 + 0.5 * Math.sin(b)) ** 2;
    } else if (kind === "pulse") {
      const calm = shape(TAU * (x / (L / 1.2) - tau));
      d = 0.08 * calm;
      m = FLOOR + 0.025;
      const g = Math.exp(-(((x - pulseCentre) / pulseWidth) ** 2));
      if (g > 1e-3) {
        const carrier = Math.sin((TAU * (x - pulseCentre)) / 140);
        d += 0.5 * g * carrier;
        m += 0.2 * g;
      }
    } else if (kind === "draw") {
      const a = TAU * (x / (L / 1.3) - tau);
      d = 0.26 * shape(a);
      m = FLOOR + 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(a * 1.7 + 0.6));
      const { draw, hold, dissolve } = phases;
      if (tau < draw) {
        const front = (tau / draw) * (1 + 2 * soft) - soft;
        p = smooth((front - u) / soft + 0.5);
        pen = Math.exp(-(((u - front) / 0.03) ** 2));
      } else if (tau < draw + hold) {
        p = 1;
      } else if (tau < draw + hold + dissolve) {
        const front = ((tau - draw - hold) / dissolve) * (1 + 2 * soft) - soft;
        p = 1 - smooth((front - u) / soft + 0.5);
      } else {
        p = 0;
      }
    } else {
      // Ripple: rings leave the middle and travel out both ways. The radius is
      // softened at the centre so the mirror has no cusp.
      const r = Math.sqrt((x - L / 2) ** 2 + 400);
      const lambda = wavelength(speed, period, 160);
      const a = TAU * (r / lambda - tau);
      const falloff = 1 - 0.55 * clamp01(r / (L / 2));
      d = 0.3 * shape(a) * falloff;
      m = FLOOR + 0.03 + 0.09 * (0.5 + 0.5 * Math.sin(a)) * falloff;
    }

    mag[i] = m;
    disp[i] = d;
    presence[i] = p;
    tip[i] = pen;
  }
}

// A representative moment for the reduced-motion still: the full shape, never
// mid-draw or mid-swell.
export function stillTime(kind: LoopKind, period: number, length: number, speed: number): number {
  if (kind === "draw") {
    const { draw, hold } = drawPhases(length, speed, period);
    return (draw + hold / 2) * period;
  }
  if (kind === "pulse") return period * 0.95;
  return period * 0.12;
}
