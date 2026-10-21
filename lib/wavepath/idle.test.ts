import { describe, expect, it } from "vitest";
import { IDLE, SHAPE_GAIN } from "./constants";
import { idleAt, idleDisplacement, idleLift } from "./idle";

describe("the idle ripple", () => {
  it("stays inside -1 to 1", () => {
    for (let s = 0; s < 4000; s += 13) for (const clock of [0, 1.7, 9.4, 40]) expect(Math.abs(idleAt(s, clock))).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("travels: the same crest is further along the line a second later", () => {
    let crest = 0;
    for (let s = 0; s < IDLE.wavelength; s += 1) if (idleAt(s, 0) > idleAt(crest, 0)) crest = s;
    const later = crest + IDLE.speed;
    expect(idleAt(later, 1)).toBeGreaterThan(idleAt(later, 0));
    expect(idleAt(later, 1)).toBeGreaterThan(0.2);
  });

  it("is never a dead flat line: every stretch of a wavelength has a visible swing", () => {
    for (let start = 0; start < 3000; start += 97) {
      let low = Infinity;
      let high = -Infinity;
      for (let s = start; s < start + IDLE.wavelength; s += 3) {
        const v = idleDisplacement(s, 0, 1);
        low = Math.min(low, v);
        high = Math.max(high, v);
      }
      expect(high - low).toBeGreaterThan(IDLE.amp * 0.5);
    }
  });

  it("is gentle: its crest is well under the resting shape's and the answer's ripple", () => {
    expect(IDLE.amp).toBeLessThan(SHAPE_GAIN / 2);
    expect(IDLE.speed).toBeLessThan(100);
  });

  it("scales with its gain, and is nothing at gain 0", () => {
    expect(Math.abs(idleDisplacement(120, 3, 0))).toBe(0);
    expect(idleLift(120, 3, 0)).toBe(0);
    expect(idleDisplacement(120, 3, 2)).toBeCloseTo(2 * idleDisplacement(120, 3, 1));
  });

  it("only lifts a column, never thins it", () => {
    for (let s = 0; s < 2000; s += 11) expect(idleLift(s, 5, 1)).toBeGreaterThanOrEqual(0);
  });
});
