import { describe, expect, it } from "vitest";
import { FIELD_DRIFT, FIELD_REST_TIME, fieldTime, shaderDrift, type PingPong } from "@/lib/coil/drift";

// Ported with the function from min/Max's shader-drift.test.ts.
const dusk: PingPong = { low: 10, peak: 15, ease: 2 };
const speed = (t: number) => (shaderDrift(t + 1e-4, dusk) - shaderDrift(t - 1e-4, dusk)) / 2e-4;

describe("shaderDrift", () => {
  it("is plain elapsed time without a ping-pong", () => {
    for (const t of [0, 3.5, 17, 600]) expect(shaderDrift(t)).toBe(t);
  });

  it("plays the opening exactly as tuned, at speed 1, up to the first turn", () => {
    for (let t = 0; t < 14; t += 0.25) expect(shaderDrift(t, dusk)).toBe(t);
  });

  it("never leaves [low, peak] after the opening, and reaches both", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 16; t < 16 + 3 * 14; t += 0.01) {
      const position = shaderDrift(t, dusk);
      min = Math.min(min, position);
      max = Math.max(max, position);
    }
    expect(max).toBeCloseTo(dusk.peak, 3);
    expect(min).toBeCloseTo(dusk.low, 3);
    expect(Math.max(...Array.from({ length: 1400 }, (_, i) => shaderDrift(i * 0.01, dusk)))).toBeLessThanOrEqual(dusk.peak);
  });

  it("stays continuous in position and speed, eases only the turns, and repeats every cycle", () => {
    for (let t = 0.001; t < 80; t += 0.05) {
      expect(Math.abs(shaderDrift(t + 0.01, dusk) - shaderDrift(t, dusk))).toBeLessThan(0.011);
      expect(Math.abs(speed(t))).toBeLessThanOrEqual(1 + 1e-6);
    }
    expect(speed(20)).toBeCloseTo(-1, 6);
    const cycle = 4 * dusk.ease + 2 * (dusk.peak - dusk.low - dusk.ease);
    for (const t of [15, 19.3, 23.1, 27.7]) expect(shaderDrift(t + cycle, dusk)).toBeCloseTo(shaderDrift(t, dusk), 9);
  });
});

describe("fieldTime", () => {
  it("holds the tuned still frame under reduced motion", () => {
    for (const t of [0, 5, 500]) expect(fieldTime(t, true)).toBe(FIELD_REST_TIME);
  });

  it("stays inside the tuned window forever and moves slowly", () => {
    for (let t = 0; t < 600; t += 0.1) {
      const f = fieldTime(t);
      expect(f).toBeLessThanOrEqual(FIELD_DRIFT.peak * 0.55 + 1e-9);
      expect(f).toBeGreaterThanOrEqual(FIELD_DRIFT.low * 0.55 - 1e-9);
      expect(Math.abs(fieldTime(t + 0.1) - f)).toBeLessThanOrEqual(0.055 + 1e-9);
    }
  });
});
