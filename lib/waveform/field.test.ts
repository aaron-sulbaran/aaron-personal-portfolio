import { describe, expect, it } from "vitest";
import {
  FLOOR,
  columnDisplacement,
  columnTarget,
  createField,
  easeToward,
  levelTargets,
  regimeOf,
  stepField,
  stepLevels,
  type FieldInput,
  type Levels,
} from "@/lib/waveform/field";

const IDLE: Levels = { idle: 1, paused: 0, reactive: 0 };
const REACTIVE: Levels = { idle: 0, paused: 0, reactive: 1 };

function input(overrides: Partial<FieldInput> = {}): FieldInput {
  const columns = overrides.bands?.length ?? 24;
  return {
    time: 3.2,
    dt: 1 / 60,
    regime: "idle",
    bands: new Float32Array(columns),
    audioLevel: 0,
    carve: null,
    phase: 0,
    ...overrides,
  };
}

describe("the seconds clock", () => {
  it("moves a column only slightly between two frames 16ms apart", () => {
    for (const levels of [IDLE, REACTIVE, { idle: 0, paused: 1, reactive: 0 }]) {
      for (let i = 0; i < 40; i++) {
        const a = columnTarget(i, 12.5, levels, 0.4);
        const b = columnTarget(i, 12.516, levels, 0.4);
        expect(Math.abs(a - b)).toBeLessThan(0.01);
        const da = columnDisplacement(i, 12.5, levels, 0.8);
        const db = columnDisplacement(i, 12.516, levels, 0.8);
        expect(Math.abs(da - db)).toBeLessThan(0.05);
      }
    }
  });

  it("would jump far if fed milliseconds, which is what the bound guards", () => {
    let worst = 0;
    for (let i = 0; i < 40; i++) {
      worst = Math.max(worst, Math.abs(columnDisplacement(i, 12500, IDLE, 0) - columnDisplacement(i, 12516, IDLE, 0)));
    }
    expect(worst).toBeGreaterThan(0.05);
  });
});

describe("determinism", () => {
  it("gives identical fields for identical inputs", () => {
    const a = createField(24);
    const b = createField(24);
    for (let f = 0; f < 90; f++) {
      const frame = input({ time: 1 + f / 60 });
      stepField(a, frame);
      stepField(b, frame);
    }
    expect(Array.from(a.mag)).toEqual(Array.from(b.mag));
    expect(Array.from(a.disp)).toEqual(Array.from(b.disp));
    expect(a.levels).toEqual(b.levels);
  });
});

describe("the four regimes", () => {
  it("maps each soundtrack state to its own regime", () => {
    expect(regimeOf("before")).toBe("idle");
    expect(regimeOf("on")).toBe("reactive");
    expect(regimeOf("paused")).toBe("paused");
    expect(regimeOf("off")).toBe("still");
  });

  it("settles each regime's levels onto its target", () => {
    for (const regime of ["idle", "paused", "reactive", "still"] as const) {
      let levels: Levels = { idle: 1, paused: 0, reactive: 0 };
      for (let f = 0; f < 60 * 12; f++) levels = stepLevels(levels, regime, 1 / 60);
      const target = levelTargets(regime);
      expect(levels.idle).toBeCloseTo(target.idle, 3);
      expect(levels.paused).toBeCloseTo(target.paused, 3);
      expect(levels.reactive).toBeCloseTo(target.reactive, 3);
    }
  });

  it("lets the still regime (maybe later) come to rest as a flat line", () => {
    const field = createField(24);
    let settled = false;
    for (let f = 0; f < 60 * 20 && !settled; f++) {
      settled = stepField(field, input({ regime: "still", time: 1 + f / 60 })).settled;
    }
    expect(settled).toBe(true);
    for (let i = 0; i < 24; i++) {
      expect(field.mag[i]).toBeCloseTo(FLOOR, 3);
      expect(Math.abs(field.disp[i])).toBeLessThan(1e-3);
    }
  });

  it("settles in the still regime under a cursor that has stopped moving", () => {
    const field = createField(24);
    const carve = new Float32Array(24);
    carve[10] = 1;
    carve[11] = 0.5;
    let settled = false;
    for (let f = 0; f < 60 * 20 && !settled; f++) {
      settled = stepField(field, input({ regime: "still", time: 1 + f / 60, carve })).settled;
    }
    expect(settled).toBe(true);
    expect(field.carve[10]).toBeCloseTo(1, 2);
  });

  it("never settles while the idle wave drifts", () => {
    const field = createField(24);
    let settledOnce = false;
    for (let f = 0; f < 600; f++) {
      if (stepField(field, input({ regime: "idle", time: 1 + f / 60 })).settled) settledOnce = true;
    }
    expect(settledOnce).toBe(false);
  });

  it("keeps the quiet paused wave smaller than the idle drift", () => {
    let idleMax = 0;
    let pausedMax = 0;
    for (let i = 0; i < 60; i++) {
      for (let t = 0; t < 10; t += 0.25) {
        idleMax = Math.max(idleMax, columnTarget(i, t, IDLE, 0), Math.abs(columnDisplacement(i, t, IDLE, 0)));
        const quiet = { idle: 0, paused: 1, reactive: 0 };
        pausedMax = Math.max(pausedMax, columnTarget(i, t, quiet, 0), Math.abs(columnDisplacement(i, t, quiet, 0)));
      }
    }
    expect(pausedMax).toBeLessThan(idleMax / 2);
  });

  it("drives the reactive regime from the analyser bands", () => {
    const loud = new Float32Array(24).fill(0.8);
    const quiet = new Float32Array(24).fill(0.05);
    expect(columnTarget(3, 2, REACTIVE, loud[3])).toBeGreaterThan(columnTarget(3, 2, REACTIVE, quiet[3]));
  });
});

describe("frame-rate independence", () => {
  it("eases the same distance in one 1/30s step as in two 1/60s steps", () => {
    const one = easeToward(0, 1, 0.12, 1 / 30);
    const two = easeToward(easeToward(0, 1, 0.12, 1 / 60), 1, 0.12, 1 / 60);
    expect(one).toBeCloseTo(two, 10);
  });

  it("reaches the same field state at 60Hz and 120Hz", () => {
    const at60 = createField(16);
    const at120 = createField(16);
    for (let f = 0; f < 120; f++) stepField(at60, input({ bands: new Float32Array(16), regime: "still", time: f / 60, dt: 1 / 60 }));
    for (let f = 0; f < 240; f++) stepField(at120, input({ bands: new Float32Array(16), regime: "still", time: f / 120, dt: 1 / 120 }));
    expect(at60.levels.idle).toBeCloseTo(at120.levels.idle, 6);
  });
});

describe("field with phase", () => {
  const phaseInput = (over: Partial<FieldInput> = {}): FieldInput => ({
    time: 1,
    dt: 1 / 60,
    regime: "idle" as const,
    bands: new Float32Array(8),
    audioLevel: 0,
    carve: null,
    phase: 0,
    ...over,
  });

  it("a phase of one column shifts the shape by one column", () => {
    expect(columnTarget(3 + 1, 2, levelTargets("idle"), 0)).toBeCloseTo(columnTarget(4, 2, levelTargets("idle"), 0), 12);
    expect(columnDisplacement(2.5, 2, levelTargets("idle"), 0)).not.toBeCloseTo(columnDisplacement(2, 2, levelTargets("idle"), 0), 3);
  });

  it("stepField no longer takes weights: magnitude eases toward the unweighted target", () => {
    const field = createField(8);
    for (let k = 0; k < 400; k++) stepField(field, phaseInput());
    const target = columnTarget(0, 1, levelTargets("idle"), 0);
    expect(field.mag[0]).toBeCloseTo(target, 3);
  });

  it("applying a constant weight at paint time equals the old weighted field", () => {
    // The old engine eased toward FLOOR + (target - FLOOR) * w. Easing is
    // affine, so scaling the unweighted magnitude after easing is identical.
    const w = 0.4;
    const unweighted = createField(4);
    let old = FLOOR;
    for (let k = 0; k < 50; k++) {
      stepField(unweighted, phaseInput({ time: k / 60 }));
      const target = columnTarget(0, k / 60, unweighted.levels, 0);
      const scaled = FLOOR + (target - FLOOR) * w;
      old = scaled + (old - scaled) * Math.pow(1 - (scaled > old ? 0.35 : 0.12), (1 / 60) * 45);
    }
    expect(FLOOR + (unweighted.mag[0] - FLOOR) * w).toBeCloseTo(old, 6);
  });
});
