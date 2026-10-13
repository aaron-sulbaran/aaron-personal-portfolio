import { describe, expect, it } from "vitest";
import { snapshotSeries } from "../snapshot";
import {
  accentRamp,
  barHeight,
  bevelShades,
  buildGrid,
  camera,
  cameraInto,
  dayMs,
  FACE_X,
  FACE_Y,
  heightShare,
  levelOf,
  rampOf,
  riseAt,
  switchAt,
  WAVE,
  type Cam,
} from "./maths";

describe("the series switch", () => {
  it("starts every bar at 0 and ends every bar at 1, whatever the stagger", () => {
    for (const stagger of [0, 0.2, WAVE, 0.7, 0.9]) {
      for (const [week, day] of [[0, 0], [13, 3], [26, 6]]) {
        expect(switchAt(0, week, 27, day, stagger)).toBe(0);
        expect(switchAt(1, week, 27, day, stagger)).toBeCloseTo(1, 9);
      }
    }
  });
  it("sweeps oldest week first, like the rise, and matches the rise at the rise's stagger", () => {
    const t = 0.4;
    expect(switchAt(t, 0, 27, 0, WAVE)).toBeGreaterThan(switchAt(t, 13, 27, 0, WAVE));
    expect(switchAt(t, 13, 27, 0, WAVE)).toBeGreaterThan(switchAt(t, 26, 27, 0, WAVE));
    for (const [week, day] of [[0, 0], [10, 2], [26, 6]]) expect(switchAt(t, week, 27, day, WAVE)).toBeCloseTo(riseAt(t, week, 27, day), 9);
  });
  it("moves every bar together with no stagger", () => {
    expect(switchAt(0.3, 0, 27, 0, 0)).toBeCloseTo(switchAt(0.3, 26, 27, 6, 0), 9);
  });
});

describe("level steps (quarters of a busy day)", () => {
  it("maps counts to 0 to 4", () => {
    expect([0, 1, 24, 25, 50, 75, 100, 500].map((c) => levelOf(c, 100, "linear"))).toEqual([0, 1, 1, 2, 3, 4, 4, 4]);
  });
});

describe("heights", () => {
  it("uses the power curve, the busiest day at full height, empty days as slabs", () => {
    expect(heightShare(50, 100, "power")).toBeCloseTo(0.5 ** 0.85, 6);
    expect(barHeight(0, 308)).toBe(0.2);
    expect(barHeight(308, 308)).toBeCloseTo(7.6, 6);
    expect(barHeight(999, 308)).toBeCloseTo(7.6, 6);
  });
  it("caps at the busiest day of the snapshot", () => {
    const s = snapshotSeries();
    const grid = buildGrid(s.days, dayMs(s.range.to), 0, { from: dayMs(s.range.from) }, { levelCurve: "linear", heightCap: 1 });
    expect([grid.weeks, grid.max]).toEqual([27, 308]);
    expect(grid.cells.find((c) => c.date === "2026-09-29")?.level).toBe(4);
    expect(grid.cells.every((c) => c.kind === "day" && (c.count > 0) === (c.level > 0))).toBe(true);
  });
});

describe("palette and depth", () => {
  it("ramps the accent toward the page in four steps from 30 percent, tokens only", () => {
    const ramp = accentRamp(30);
    expect(ramp).toEqual([
      "color-mix(in srgb, var(--color-accent) 30%, var(--color-background))",
      "color-mix(in srgb, var(--color-accent) 53%, var(--color-background))",
      "color-mix(in srgb, var(--color-accent) 77%, var(--color-background))",
      "var(--color-accent)",
    ]);
    for (const step of ramp) expect(step).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
  it("ramps any colour the same way toward the page", () => {
    expect(rampOf("var(--tokens-brand-codex)", 30)).toEqual([
      "color-mix(in srgb, var(--tokens-brand-codex) 30%, var(--color-background))",
      "color-mix(in srgb, var(--tokens-brand-codex) 53%, var(--color-background))",
      "color-mix(in srgb, var(--tokens-brand-codex) 77%, var(--color-background))",
      "var(--tokens-brand-codex)",
    ]);
  });
  it("shades the bevel's bottom and right edges as the skyline's faces", () => {
    expect([FACE_Y, FACE_X]).toEqual([0.84, 0.68]);
    expect(bevelShades([100, 200, 50])).toEqual({ top: [100, 200, 50], bottom: [84, 168, 42], right: [68, 136, 34] });
  });
});

describe("cameraInto", () => {
  it("writes camera(...) into the given object and returns that same object", () => {
    const out: Cam = { cs: 0, sn: 0, se: 0, ce: 0 };
    for (const [e, dYaw, dElev] of [
      [0, 0, 0],
      [0.37, 0.2, -0.1],
      [1, 0, 0],
      [1, 1.5, 1.5],
      [1, -1.5, -1.5],
    ]) {
      const got = cameraInto(out, e, dYaw, dElev);
      expect(got).toBe(out);
      expect(got).toEqual(camera(e, dYaw, dElev));
    }
  });
});
