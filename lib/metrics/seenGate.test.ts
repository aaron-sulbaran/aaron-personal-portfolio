import { describe, expect, it } from "vitest";
import { createSpeedometer, gateOpen, runway, visibleShare } from "./seenGate";

const at = { top: 300, height: 400, viewport: 900, share: 0.6, dir: 1 as const, durationMs: 1300 };

describe("the seen gate", () => {
  it("measures the chart's share in view", () => {
    expect([visibleShare(0, 100, 900), visibleShare(850, 100, 900), visibleShare(-50, 100, 900)]).toEqual([1, 0.5, 0.5]);
  });
  it("finds the runway before the chart drops under 60 percent", () => expect(runway(300, 400, 900, 0.6, 1)).toBe(464));
  it("opens when settled, or slow enough to watch 1300ms; stays shut for a fling or a chart mostly out of view", () => {
    expect(gateOpen({ ...at, speed: 0, settled: true })).toBe(true);
    expect(gateOpen({ ...at, speed: 350, settled: false })).toBe(true);
    expect(gateOpen({ ...at, speed: 400, settled: false })).toBe(false);
    expect(gateOpen({ ...at, speed: 3000, settled: false })).toBe(false);
    expect(gateOpen({ ...at, top: 700, speed: 0, settled: true })).toBe(false);
  });
  it("counts settled from the last fast sample", () => {
    const m = createSpeedometer(100);
    m.push(0, 0, 300);
    m.push(16, 48, 300);
    expect(m.read(100, 120).settled).toBe(false);
    expect(m.read(140, 120)).toMatchObject({ settled: true, speed: 0, dir: 1 });
  });
});
