import { describe, expect, it } from "vitest";
import { BEES, EXHIBIT_BOX, EXHIBIT_LOOP, EXHIBIT_STEPS, exhibitFrame, exhibitStepAt, outlineAt } from "./exhibit";
import { FLOW_STEPS, LOOP_SECONDS, flowStepAt, stillAt } from "./flow";

describe("the exhibit aside", () => {
  it("keeps the person and every bee inside the drawing, all through the loop", () => {
    for (let t = 0; t <= EXHIBIT_LOOP; t += 0.25) {
      for (const p of [...outlineAt(t), ...exhibitFrame(t).bees]) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(EXHIBIT_BOX.width);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(EXHIBIT_BOX.height);
      }
    }
  });

  it("has one bee for every seat on the person", () => {
    expect(BEES).toHaveLength(outlineAt(0).length);
  });

  it("loops without a jump: the last frame is the first", () => {
    const first = exhibitFrame(0).bees, last = exhibitFrame(EXHIBIT_LOOP).bees;
    first.forEach((p, i) => { expect(Math.abs(p.x - last[i].x)).toBeLessThan(0.01); expect(Math.abs(p.y - last[i].y)).toBeLessThan(0.01); });
  });

  it("settles every bee on the person before the wave, and moves the arm's bees during it", () => {
    const settled = exhibitFrame(EXHIBIT_STEPS[3].start).bees, seats = outlineAt(EXHIBIT_STEPS[3].start);
    settled.forEach((p, i) => expect(Math.hypot(p.x - seats[i].x, p.y - seats[i].y)).toBeLessThan(0.5));
    const mid = exhibitFrame(EXHIBIT_STEPS[3].start + 0.5).bees;
    expect(mid.some((p, i) => Math.hypot(p.x - settled[i].x, p.y - settled[i].y) > 3)).toBe(true);
  });

  it("names the step any moment belongs to", () => {
    expect(EXHIBIT_STEPS.map((s) => exhibitStepAt(s.start + 0.01))).toEqual([0, 1, 2, 3]);
  });
});

describe("the flow's steps", () => {
  it("cover the loop in order, each still frame inside its own step", () => {
    FLOW_STEPS.forEach((s, i) => {
      expect(s.end).toBeGreaterThan(s.start);
      expect(s.end).toBeLessThanOrEqual(LOOP_SECONDS);
      if (i) expect(s.start).toBeGreaterThanOrEqual(FLOW_STEPS[i - 1].end);
      expect(flowStepAt(stillAt(i))).toBe(i);
    });
  });
});
