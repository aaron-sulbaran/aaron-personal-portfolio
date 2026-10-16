import { describe, expect, it } from "vitest";
import { MARQUEE, marqueePlan, overflowPx, overflows, scrollDistancePx, scrollDurationMs } from "./marquee";

describe("marquee math", () => {
  it("measures overflow and never goes negative", () => {
    expect(overflowPx(300, 200)).toBe(100);
    expect(overflowPx(150, 200)).toBe(0);
  });

  it("treats a title within the tolerance as fitting", () => {
    expect(overflows(200, 200)).toBe(false);
    expect(overflows(200 + MARQUEE.fitTolerancePx, 200)).toBe(false);
    expect(overflows(202, 200)).toBe(true);
  });

  it("scrolls the overflow plus the fade so the end clears the mask", () => {
    expect(scrollDistancePx(300, 200)).toBe(100 + MARQUEE.fadePx);
    expect(scrollDistancePx(150, 200)).toBe(0);
  });

  it("derives duration from the speed", () => {
    expect(scrollDurationMs(0)).toBe(0);
    expect(scrollDurationMs(MARQUEE.speedPxPerSecond)).toBe(1000);
    expect(scrollDurationMs(MARQUEE.speedPxPerSecond * 4)).toBe(4000);
  });

  it("keeps the speed in the 30 to 40 px/s band", () => {
    expect(MARQUEE.speedPxPerSecond).toBeGreaterThanOrEqual(30);
    expect(MARQUEE.speedPxPerSecond).toBeLessThanOrEqual(40);
  });

  it("has no plan for a title that fits", () => {
    expect(marqueePlan(180, 200)).toBeNull();
  });

  it("builds one cycle: hold, scroll, hold, return", () => {
    const plan = marqueePlan(300, 200);
    expect(plan).not.toBeNull();
    const { distancePx, scrollMs, cycleMs, offsets, translatesPx } = plan!;
    expect(cycleMs).toBe(MARQUEE.startHoldMs + scrollMs + MARQUEE.endHoldMs + scrollMs);
    expect(offsets[0]).toBe(0);
    expect(offsets[4]).toBe(1);
    expect(offsets[1] * cycleMs).toBeCloseTo(MARQUEE.startHoldMs);
    expect((offsets[3] - offsets[2]) * cycleMs).toBeCloseTo(MARQUEE.endHoldMs);
    expect(translatesPx).toEqual([0, 0, -distancePx, -distancePx, 0]);
    expect([...offsets]).toEqual([...offsets].sort((a, b) => a - b));
  });
});
