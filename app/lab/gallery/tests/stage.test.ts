import { describe, expect, it } from "vitest";
import { autoAdvanceMs, axisOf, clampPage, gestureOf, initialStage, pagerReducer, releaseOf, rubberBand, stageReducer, stripSnap, wrap, type StageState } from "../stage";

describe("wrap", () => {
  it("wraps both ways and survives an empty stage", () => {
    expect(wrap(3, 3)).toBe(0);
    expect(wrap(-1, 3)).toBe(2);
    expect(wrap(-4, 3)).toBe(2);
    expect(wrap(5, 0)).toBe(0);
  });
});

describe("stageReducer", () => {
  const start = initialStage(3, true);

  it("moves with wrap and stops the pass on any user move", () => {
    expect(stageReducer({ ...start, index: 2 }, { type: "next" })).toEqual({ index: 0, count: 3, auto: false });
    expect(stageReducer(start, { type: "prev" })).toEqual({ index: 2, count: 3, auto: false });
    expect(stageReducer(start, { type: "goto", index: 4 })).toEqual({ index: 1, count: 3, auto: false });
  });

  it("makes one pass and stops on the last photo", () => {
    let s: StageState = start;
    s = stageReducer(s, { type: "tick" });
    expect(s).toEqual({ index: 1, count: 3, auto: true });
    s = stageReducer(s, { type: "tick" });
    expect(s).toEqual({ index: 2, count: 3, auto: false });
    expect(stageReducer(s, { type: "tick" })).toBe(s);
  });

  it("stops the moment the reader touches it", () => {
    const touched = stageReducer(start, { type: "touch" });
    expect(touched.auto).toBe(false);
    expect(stageReducer(touched, { type: "tick" }).index).toBe(0);
    expect(stageReducer(touched, { type: "touch" })).toBe(touched);
  });

  it("never runs a pass for one photo, and resets", () => {
    expect(initialStage(1, true).auto).toBe(false);
    expect(stageReducer({ index: 2, count: 3, auto: false }, { type: "reset", count: 2, auto: true })).toEqual({ index: 0, count: 2, auto: true });
  });
});

describe("autoAdvanceMs", () => {
  it("is off at zero, for one photo and under reduced motion", () => {
    expect(autoAdvanceMs(4, 3, false)).toBe(4000);
    expect(autoAdvanceMs(2.5, 2, false)).toBe(2500);
    expect(autoAdvanceMs(0, 3, false)).toBeNull();
    expect(autoAdvanceMs(4, 1, false)).toBeNull();
    expect(autoAdvanceMs(4, 3, true)).toBeNull();
  });
});

describe("gestureOf", () => {
  it("reads taps, sideways swipes and leaves vertical scrolls alone", () => {
    expect(gestureOf(3, -4)).toBe("tap");
    expect(gestureOf(-60, 8)).toBe("next");
    expect(gestureOf(70, -12)).toBe("prev");
    expect(gestureOf(-30, 2)).toBeNull();
    expect(gestureOf(-50, 120)).toBeNull();
  });
});

describe("the round four pager", () => {
  it("stops at either end instead of wrapping, and stops the pass on any move", () => {
    const start = initialStage(3, true);
    expect(pagerReducer(start, { type: "prev" })).toEqual({ index: 0, count: 3, auto: false });
    expect(pagerReducer({ ...start, index: 2 }, { type: "next" })).toEqual({ index: 2, count: 3, auto: false });
    expect(pagerReducer(start, { type: "goto", index: 9 }).index).toBe(2);
    expect(pagerReducer(start, { type: "tick" })).toEqual({ index: 1, count: 3, auto: true });
    expect(clampPage(-1, 0)).toBe(0);
  });

  it("locks a drag to the axis it first moves along", () => {
    expect(axisOf(3, 4)).toBeNull();
    expect(axisOf(-12, 5)).toBe("x");
    expect(axisOf(4, 20)).toBe("y");
  });

  it("turns the page sideways, closes on a vertical flick, never closes sideways", () => {
    const o = { flickPx: 96 };
    expect(releaseOf("x", -60, 0, 0.1, o)).toBe("next");
    expect(releaseOf("x", 60, 0, 0.1, o)).toBe("prev");
    expect(releaseOf("x", -30, 0, 0.1, o)).toBe("stay");
    expect(releaseOf("x", -30, 0, -0.9, o)).toBe("next");
    expect(releaseOf("x", -400, 0, 2, o)).toBe("next");
    expect(releaseOf("y", 0, 120, 0.1, o)).toBe("dismiss");
    expect(releaseOf("y", 0, -120, 0.1, o)).toBe("dismiss");
    expect(releaseOf("y", 0, 60, 0.2, o)).toBe("stay");
    expect(releaseOf("y", 0, 40, 1.1, o)).toBe("dismiss");
    expect(releaseOf("y", 0, 16, 2, o)).toBe("stay");
    expect(releaseOf(null, 0, 0, 0, o)).toBe("stay");
  });

  it("follows the finger at a third past either end", () => {
    expect(rubberBand(90, 0, 3)).toBe(30);
    expect(rubberBand(-90, 2, 3)).toBe(-30);
    expect(rubberBand(-90, 0, 3)).toBe(-90);
  });
});

describe("stripSnap (round six, C)", () => {
  const offsets = [0, 126, 252, 378];
  it("settles on the frame nearest where a slow drag let go", () => {
    expect(stripSnap(offsets, 70, 0, 400)).toBe(126);
    expect(stripSnap(offsets, 50, 0, 400)).toBe(0);
  });
  it("goes one frame on in the direction of a quick flick", () => {
    expect(stripSnap(offsets, 20, -0.8, 400)).toBe(126);
    expect(stripSnap(offsets, 240, 0.8, 400)).toBe(126);
  });
  it("never goes past the end it can scroll to, and survives an empty strip", () => {
    expect(stripSnap(offsets, 370, -0.8, 300)).toBe(300);
    expect(stripSnap([], 40, 0, 0)).toBe(0);
  });
});
