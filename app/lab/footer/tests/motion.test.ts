import { describe, expect, it } from "vitest";
import { approach, falloff, leanAngle, pressTarget, riseProgress, riseTotalMs, springAtRest, springStep, swellWeight, type Spring } from "../motion";

describe("the swell", () => {
  it("is 1 at the pointer, 0 at the radius and beyond, and falls monotonically", () => {
    expect(falloff(0, 100)).toBe(1);
    expect(falloff(100, 100)).toBe(0);
    expect(falloff(250, 100)).toBe(0);
    let last = 1;
    for (let d = 0; d <= 100; d += 5) {
      const f = falloff(d, 100);
      expect(f).toBeLessThanOrEqual(last);
      last = f;
    }
    expect(falloff(10, 0)).toBe(0);
  });

  it("keeps the weight between the base and the base plus the amount", () => {
    for (let d = 0; d < 300; d += 7) {
      const w = swellWeight(0.15, 0.08, d, 200);
      expect(w).toBeGreaterThanOrEqual(0.15);
      expect(w).toBeLessThanOrEqual(0.23 + 1e-12);
    }
    expect(swellWeight(0.15, 0.08, 0, 200)).toBeCloseTo(0.23, 12);
  });
});

describe("the press", () => {
  it("flattens by the depth times the influence, clamped", () => {
    expect(pressTarget(0.4, 1)).toBeCloseTo(0.6, 12);
    expect(pressTarget(0.4, 0.5)).toBeCloseTo(0.8, 12);
    expect(pressTarget(0.4, 0)).toBe(1);
    expect(pressTarget(2, 1)).toBe(0);
  });

  const settle = (zeta: number) => {
    let s: Spring = { x: 0.6, v: 0 };
    let max = 0.6;
    for (let i = 0; i < 240; i++) {
      s = springStep(s, 1, 400, zeta, 1 / 60);
      max = Math.max(max, s.x);
    }
    return { s, max };
  };

  it("springs back to rest, overshooting only when underdamped", () => {
    const under = settle(0.3);
    expect(springAtRest(under.s, 1)).toBe(true);
    expect(under.max).toBeGreaterThan(1.01);
    const critical = settle(1);
    expect(springAtRest(critical.s, 1)).toBe(true);
    expect(critical.max).toBeLessThanOrEqual(1 + 1e-6);
  });

  it("survives a long frame", () => {
    const s = springStep({ x: 0, v: 0 }, 1, 800, 0.4, 0.5);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x - 1)).toBeLessThan(1);
  });

  it("approaches a target independent of frame rate", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 1, 1 / 60, 0.2);
    let b = 0;
    for (let i = 0; i < 120; i++) b = approach(b, 1, 1 / 120, 0.2);
    expect(a).toBeCloseTo(b, 10);
    expect(approach(0.3, 1, 0.016, 0)).toBe(1);
  });
});

describe("the rise", () => {
  it("holds each letter below the baseline until its turn, then lands it", () => {
    expect(riseProgress(0, 0, 900, 60)).toBe(0);
    expect(riseProgress(100, 2, 900, 60)).toBe(0);
    expect(riseProgress(900, 0, 900, 60)).toBe(1);
    expect(riseProgress(2000, 10, 900, 60)).toBe(1);
    expect(riseProgress(450, 0, 900, 60)).toBeGreaterThan(riseProgress(450, 3, 900, 60));
  });

  it("lands every letter by the total time, for each ease", () => {
    const total = riseTotalMs(11, 900, 60);
    expect(total).toBe(1500);
    for (const ease of ["expo", "cubic", "back"] as const) {
      for (let i = 0; i < 11; i++) expect(riseProgress(total, i, 900, 60, ease)).toBe(1);
    }
  });

  it("is instant with no duration", () => {
    expect(riseProgress(1, 0, 0, 0)).toBe(1);
  });
});

describe("the Profa lean", () => {
  it("leans toward the pointer's side, strongest close in", () => {
    expect(leanAngle(8, 50, 1, 100)).toBeCloseTo(4, 12);
    expect(leanAngle(8, -200, 1, 100)).toBeCloseTo(-8, 12);
    expect(leanAngle(8, 50, 0, 100)).toBe(0);
  });
});
