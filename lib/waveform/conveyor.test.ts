import { describe, expect, it } from "vitest";
import { CONVEYOR, createConveyor, feedScroll, stepConveyor } from "@/lib/waveform/conveyor";

describe("conveyor", () => {
  it("1px of scroll down moves the target 1/26 column left", () => {
    const c = createConveyor();
    feedScroll(c, 26);
    expect(c.target).toBeCloseTo(-1, 6);
  });

  it("the lead is clamped so a flick cannot bank more than 12 columns", () => {
    const c = createConveyor();
    feedScroll(c, 100000);
    expect(c.target - c.phase).toBeCloseTo(-CONVEYOR.leadColumns, 6);
  });

  it("phase closes the gap with one exponential stage and never exceeds the cap", () => {
    const c = createConveyor();
    feedScroll(c, 26 * 12);
    const dt = 1 / 60;
    const { moving } = stepConveyor(c, dt, false);
    expect(moving).toBe(true);
    const expected = -12 * (1 - Math.exp(-CONVEYOR.lambda * dt));
    expect(c.phase).toBeCloseTo(Math.max(expected, -CONVEYOR.capColumnsPerSecond * dt), 6);
    for (let k = 0; k < 600; k++) stepConveyor(c, dt, false);
    expect(c.phase).toBeCloseTo(-12, 3);
    expect(stepConveyor(c, dt, false).moving).toBe(false);
  });

  it("idle drift moves the target 0.4 columns per second when idle", () => {
    const c = createConveyor();
    stepConveyor(c, 0.5, true);
    expect(c.target).toBeCloseTo(-0.2, 6);
  });

  it("scrolling up travels the other way", () => {
    const c = createConveyor();
    feedScroll(c, -52);
    expect(c.target).toBeCloseTo(2, 6);
  });
});
