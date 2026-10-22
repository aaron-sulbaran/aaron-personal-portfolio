import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { PROFA, lockupEm, lockupVars } from "@/lib/home/lockup";

describe("the lockup's proportions", () => {
  it("take the greeting's size, gap and lean from the hero's own picks", () => {
    const m = lockupEm();
    expect(m.greet).toBe(COIL.lockup.greetingCap);
    expect(m.shift).toBe(COIL.lockup.greetingShift);
  });

  it("leaves the greeting's lowest ink the picked gap above the name's cap top", () => {
    const m = lockupEm();
    const lowestInkToLineBottom = m.greet * (1 - PROFA.base - PROFA.gDesc);
    const gap = lowestInkToLineBottom + m.pull + m.nameTopSpace;
    expect(gap).toBeCloseTo(m.greet * PROFA.capR * COIL.lockup.greetingGap, 6);
  });

  it("pulls the name up under the greeting rather than pushing it down", () => {
    expect(lockupEm().pull).toBeLessThan(0);
  });

  it("is a little shorter than a name and as wide as the name's advance", () => {
    const m = lockupEm();
    expect(m.width).toBeCloseTo(2.81636, 5);
    expect(m.height).toBeGreaterThan(0.6);
    expect(m.height).toBeLessThan(1.1);
  });

  it("is written as custom properties with no em dash", () => {
    const vars = lockupVars();
    expect(Object.keys(vars).sort()).toEqual(["--lk-bottom-trim", "--lk-cap", "--lk-cap-top", "--lk-greet", "--lk-pull", "--lk-shift"]);
    for (const value of Object.values(vars)) expect(Number.isFinite(Number(value))).toBe(true);
  });
});
