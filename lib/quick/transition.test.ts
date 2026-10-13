import { describe, expect, it } from "vitest";
import { EXPRESS_PATH, HOME_PATH, IDLE, isExpressSwap, sweepOf, transitionReducer, type TransitionEvent, type TransitionState } from "./transition";

const run = (events: TransitionEvent[], from: TransitionState = IDLE) => events.reduce(transitionReducer, from);

describe("the transition", () => {
  it("runs leaving, covered, arriving, idle on a click", () => {
    const go: TransitionEvent = { type: "go", from: HOME_PATH, to: EXPRESS_PATH, reduced: false };
    const leaving = run([go]);
    expect(leaving).toEqual({ phase: "leaving", from: HOME_PATH, to: EXPRESS_PATH, via: "push", reduced: false });
    const covered = transitionReducer(leaving, { type: "covered" });
    expect(covered.phase).toBe("covered");
    const arriving = transitionReducer(covered, { type: "arrived", path: EXPRESS_PATH });
    expect(arriving.phase).toBe("arriving");
    expect(transitionReducer(arriving, { type: "revealed" })).toEqual(IDLE);
  });

  it("waits for the right page before lifting the mask", () => {
    const covered = run([{ type: "go", from: HOME_PATH, to: EXPRESS_PATH, reduced: false }, { type: "covered" }]);
    expect(transitionReducer(covered, { type: "arrived", path: HOME_PATH })).toBe(covered);
  });

  it("ignores a second click mid-run and a click to the page it is on", () => {
    const leaving = run([{ type: "go", from: HOME_PATH, to: EXPRESS_PATH, reduced: false }]);
    expect(transitionReducer(leaving, { type: "go", from: EXPRESS_PATH, to: HOME_PATH, reduced: false })).toBe(leaving);
    expect(run([{ type: "go", from: HOME_PATH, to: HOME_PATH, reduced: false }])).toEqual(IDLE);
  });

  it("jumps to covered on back or forward, even mid-run", () => {
    const pop: TransitionEvent = { type: "pop", from: EXPRESS_PATH, to: HOME_PATH, reduced: true };
    expect(run([pop])).toEqual({ phase: "covered", from: EXPRESS_PATH, to: HOME_PATH, via: "pop", reduced: true });
    const midway = run([{ type: "go", from: HOME_PATH, to: EXPRESS_PATH, reduced: false }, { type: "covered" }, { type: "arrived", path: EXPRESS_PATH }]);
    expect(transitionReducer(midway, pop).phase).toBe("covered");
    expect(run([pop, { type: "arrived", path: HOME_PATH }, { type: "revealed" }])).toEqual(IDLE);
  });

  it("drops out of order events and resets on abort", () => {
    expect(transitionReducer(IDLE, { type: "covered" })).toBe(IDLE);
    expect(transitionReducer(IDLE, { type: "revealed" })).toBe(IDLE);
    expect(transitionReducer(IDLE, { type: "arrived", path: EXPRESS_PATH })).toBe(IDLE);
    expect(run([{ type: "go", from: HOME_PATH, to: EXPRESS_PATH, reduced: false }, { type: "abort" }])).toEqual(IDLE);
  });

  it("swaps only the home and the Express lane, and sweeps each way", () => {
    expect(isExpressSwap(HOME_PATH, EXPRESS_PATH)).toBe(true);
    expect(isExpressSwap(EXPRESS_PATH, HOME_PATH)).toBe(true);
    expect(isExpressSwap(HOME_PATH, "/private")).toBe(false);
    expect(isExpressSwap(EXPRESS_PATH, EXPRESS_PATH)).toBe(false);
    expect(sweepOf(EXPRESS_PATH)).toBe("forward");
    expect(sweepOf(HOME_PATH)).toBe("back");
  });
});
