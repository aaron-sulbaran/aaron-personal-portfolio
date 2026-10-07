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
  type Cam,
} from "./maths";

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
