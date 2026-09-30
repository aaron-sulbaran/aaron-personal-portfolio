import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRIFT,
  DRIFT_PRESETS,
  DRIFT_PRESET_KEYS,
  FIELD_DRIFT,
  FIELD_REST_TIME,
  FIELD_WARP_TUNED,
  fieldClocks,
  fieldTime,
  parseDriftPreset,
  shaderDrift,
  type DriftPreset,
  type PingPong,
} from "@/lib/coil/drift";

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

describe("drift presets", () => {
  it("defaults to visible and parses only the known keys", () => {
    expect(DEFAULT_DRIFT).toBe("visible");
    expect(parseDriftPreset("calm")).toBe("calm");
    expect(parseDriftPreset("lively")).toBe("lively");
    expect(parseDriftPreset("visible")).toBe("visible");
    for (const junk of [null, "", "LIVELY", "wild", "calm "]) expect(parseDriftPreset(junk)).toBe(DEFAULT_DRIFT);
  });

  it("keeps the orange clock on the tuned window in every preset, so the warm share holds", () => {
    for (const preset of DRIFT_PRESET_KEYS) {
      for (let t = 0; t < 300; t += 0.37) expect(fieldClocks(t, false, preset).orange).toBe(fieldTime(t));
    }
  });

  it("calm is today's field: the weather rides the orange clock", () => {
    for (let t = 0; t < 120; t += 0.5) {
      const clocks = fieldClocks(t, false, "calm");
      expect(clocks.weather).toBe(clocks.orange);
      expect(DRIFT_PRESETS.calm.warp).toBe(FIELD_WARP_TUNED);
    }
  });

  it("moves the weather more with each step up, inside its own window, never faster than its speed", () => {
    const span = (preset: DriftPreset) => {
      let min = Infinity;
      let max = -Infinity;
      let fastest = 0;
      for (let t = 0; t < 400; t += 0.05) {
        const w = fieldClocks(t, false, preset).weather;
        min = Math.min(min, w);
        max = Math.max(max, w);
        fastest = Math.max(fastest, Math.abs(fieldClocks(t + 0.05, false, preset).weather - w) / 0.05);
      }
      const { pingPong, speed } = DRIFT_PRESETS[preset];
      expect(max).toBeLessThanOrEqual(pingPong.peak * speed + 1e-9);
      expect(min).toBeGreaterThanOrEqual(pingPong.low * speed - 1e-9);
      expect(fastest).toBeLessThanOrEqual(speed + 1e-6);
      return { range: max - min, fastest };
    };
    const calm = span("calm");
    const visible = span("visible");
    const lively = span("lively");
    expect(visible.range).toBeGreaterThan(calm.range);
    expect(lively.range).toBeGreaterThan(visible.range);
    expect(visible.fastest).toBeGreaterThan(calm.fastest * 1.5);
    expect(lively.fastest).toBeGreaterThan(visible.fastest);
    expect(DRIFT_PRESETS.visible.warp).toBeGreaterThan(DRIFT_PRESETS.calm.warp);
    expect(DRIFT_PRESETS.lively.warp).toBeGreaterThan(DRIFT_PRESETS.visible.warp);
  });

  it("holds both clocks on the tuned still under reduced motion", () => {
    for (const preset of DRIFT_PRESET_KEYS) {
      expect(fieldClocks(42, true, preset)).toEqual({ orange: FIELD_REST_TIME, weather: FIELD_REST_TIME });
    }
  });
});
