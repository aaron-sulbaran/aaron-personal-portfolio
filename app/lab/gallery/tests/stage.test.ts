import { describe, expect, it } from "vitest";
import { autoAdvanceMs, gestureOf, initialStage, stageReducer, wrap, type StageState } from "../stage";

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
