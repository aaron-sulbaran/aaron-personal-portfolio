import { describe, expect, it } from "vitest";
import { PLUCK } from "./constants";
import { createPlucks, notePointer, pluckAt, stepPlucks } from "./pluck";

describe("the pluck", () => {
  it("a change of side at the same columns plucks; one side alone does not", () => {
    const p = createPlucks();
    notePointer(p, 10, 1, 136.5, 0);
    notePointer(p, 11, 1, 149.5, 0);
    expect(p.count).toBe(0);
    notePointer(p, 11, -1, 149.5, 900);
    expect(p.count).toBe(1);
    expect(p.amp[0]).toBeCloseTo(0.35 * PLUCK.strength * Math.min(1, 0.35 + 900 / 1500));
  });
  it("a crossing far along the line is a new approach, not a pluck", () => {
    const p = createPlucks();
    notePointer(p, 10, 1, 136.5, 0);
    notePointer(p, 30, -1, 396.5, 0);
    expect(p.count).toBe(0);
  });
  it("the ripple travels both ways at its speed and is gone within its life", () => {
    const p = createPlucks();
    notePointer(p, 0, 1, 1000, 0);
    notePointer(p, 0, -1, 1000, 1500);
    stepPlucks(p, 0.5);
    const front = 1000 + PLUCK.speed * 0.5 - PLUCK.wave / 4;
    expect(Math.abs(pluckAt(p, front))).toBeGreaterThan(0.01);
    expect(Math.abs(pluckAt(p, 2000 - front))).toBeGreaterThan(0.01);
    expect(pluckAt(p, 1000)).toBe(0);
    for (let t = 0; t < 2; t += 1 / 60) stepPlucks(p, 1 / 60);
    expect(p.count).toBe(0);
  });
  it("keeps at most four ripples", () => {
    const p = createPlucks();
    for (let k = 0; k < 6; k++) notePointer(p, 0, k % 2 ? -1 : 1, 0, 800);
    expect(p.count).toBe(PLUCK.max);
  });
});
