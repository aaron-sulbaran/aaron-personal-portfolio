import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { hermiteEase, planHandScroll, scrollVelocity, type HandPlan } from "@/lib/home/handScroll";

const c = COIL.deal.cutscene;
const NOMINAL = 1640;

// The page's y at a share of the leg's time.
const yAt = (plan: HandPlan, y0: number, landing: number, s: number) => y0 + (landing - y0) * plan.ease(s);
// Its speed there, px/s, by a central difference.
const speedAt = (plan: HandPlan, y0: number, landing: number, s: number) => {
  const h = 1e-4;
  const lo = Math.max(0, s - h);
  const hi = Math.min(1, s + h);
  return ((yAt(plan, y0, landing, hi) - yAt(plan, y0, landing, lo)) / ((hi - lo) * plan.durationMs)) * 1000;
};
const walk = (plan: HandPlan, y0: number, landing: number) => Array.from({ length: 401 }, (_, i) => yAt(plan, y0, landing, i / 400));

describe("the page's speed at the trigger", () => {
  const samples = (...rows: [number, number][]) => rows.map(([t, y]) => ({ t, y }));

  it("is the distance over the time across the last 100 ms of samples", () => {
    const v = scrollVelocity(samples([0, 0], [16, 16], [33, 33], [50, 50]), 52);
    expect(v).toBeCloseTo(1000, 0);
  });

  it("leaves out samples older than the window", () => {
    // A slow start, then 2000 px/s over the last three frames.
    const v = scrollVelocity(samples([0, 0], [16, 1], [200, 100], [216, 132], [233, 166], [250, 200]), 252);
    expect(v).toBeGreaterThan(1900);
    expect(v).toBeLessThan(2100);
  });

  it("is 0 for a page at rest, a lone sample, no samples, and a page going up", () => {
    expect(scrollVelocity(samples([0, 0], [16, 16]), 16 + c.staleMs + 1)).toBe(0);
    expect(scrollVelocity(samples([10, 100]), 11)).toBe(0);
    expect(scrollVelocity([], 0)).toBe(0);
    expect(scrollVelocity(samples([0, 100], [16, 80], [33, 60]), 34)).toBe(0);
  });
});

describe("the hand path's scroll plan", () => {
  it("is nothing when the page is already on the landing", () => {
    expect(planHandScroll({ y0: 1000, v0: 800, landing: 1000.5, nominalMs: NOMINAL })).toBeNull();
  });

  it("from rest is a smoothstep over the nominal time: no start, no stop", () => {
    const plan = planHandScroll({ y0: 1000, v0: 0, landing: 1400, nominalMs: NOMINAL })!;
    expect(plan.durationMs).toBe(NOMINAL);
    expect(plan.startVelocity).toBe(0);
    expect(plan.ease(0.5)).toBeCloseTo(0.5, 6);
    expect(speedAt(plan, 1000, 1400, 0)).toBeCloseTo(0, 0);
    expect(speedAt(plan, 1000, 1400, 1)).toBeCloseTo(0, 0);
  });

  it("starts at exactly the page's own speed when that fits the nominal time, and ends at rest", () => {
    for (const v of [100, 400, 700]) {
      const plan = planHandScroll({ y0: 1000, v0: v, landing: 1400, nominalMs: NOMINAL })!;
      expect(plan.durationMs).toBe(NOMINAL);
      expect(plan.startVelocity).toBeCloseTo(v, 6);
      expect(speedAt(plan, 1000, 1400, 0)).toBeCloseTo(v, 0);
      expect(speedAt(plan, 1000, 1400, 1)).toBeCloseTo(0, 0);
      expect(yAt(plan, 1000, 1400, 1)).toBe(1400);
    }
  });

  it("a faster page gets a shorter leg that still starts at its speed, and never passes the landing", () => {
    for (const v of [900, 2000, 6000, 11_500]) {
      const plan = planHandScroll({ y0: 1000, v0: v, landing: 1400, nominalMs: NOMINAL })!;
      expect(plan.durationMs).toBeLessThan(NOMINAL);
      expect(plan.durationMs).toBeGreaterThanOrEqual(c.minLegMs);
      expect(plan.startVelocity).toBeCloseTo(v, 6);
      expect(Math.abs(speedAt(plan, 1000, 1400, 0) - v) / v, "the speed it starts at, against the page's").toBeLessThan(0.002);
      expect(Math.max(...walk(plan, 1000, 1400))).toBeLessThanOrEqual(1400 + 1e-9);
    }
  });

  it("only ever moves toward the landing", () => {
    for (const v of [0, 300, 1500, 9000]) {
      const ys = walk(planHandScroll({ y0: 1000, v0: v, landing: 1400, nominalMs: NOMINAL })!, 1000, 1400);
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
    }
  });

  it("a fling that has all but reached the landing holds its start speed to what fits, and does not pass it", () => {
    const plan = planHandScroll({ y0: 1390, v0: 11_500, landing: 1400, nominalMs: NOMINAL })!;
    expect(plan.durationMs).toBe(c.minLegMs);
    expect(plan.startVelocity).toBeLessThan(11_500);
    expect(plan.startVelocity).toBeCloseTo((3 * 10) / (c.minLegMs / 1000), 6);
    expect(Math.max(...walk(plan, 1390, 1400))).toBeLessThanOrEqual(1400 + 1e-9);
  });

  it("a page already past the landing eases back to it, going on no more than the overshoot budget", () => {
    for (const [y0, v] of [[1500, 0], [1500, 3000], [1430, 11_500], [2600, 6000]]) {
      const plan = planHandScroll({ y0, v0: v, landing: 1400, nominalMs: NOMINAL })!;
      const ys = walk(plan, y0, 1400);
      // Further down the page than it already was, at most the budget (a rounding's worth over).
      expect(Math.max(...ys) - y0).toBeLessThanOrEqual(c.overshootPx + 0.5);
      expect(ys[ys.length - 1]).toBe(1400);
      expect(speedAt(plan, y0, 1400, 1)).toBeCloseTo(0, 0);
      expect(plan.durationMs).toBeLessThanOrEqual(NOMINAL);
      expect(plan.durationMs).toBeGreaterThanOrEqual(300);
    }
  });

  it("the Hermite ease is monotone for a start speed from 0 to 3 and overshoots above it", () => {
    for (const a of [0, 0.5, 1.5, 3]) {
      const ease = hermiteEase(a);
      for (let i = 1; i <= 100; i++) expect(ease(i / 100)).toBeGreaterThanOrEqual(ease((i - 1) / 100) - 1e-12);
      expect(ease(1)).toBe(1);
    }
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => hermiteEase(6)(i / 100)))).toBeGreaterThan(1.2);
  });
});
