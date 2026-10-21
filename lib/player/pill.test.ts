import { describe, expect, it } from "vitest";
import { PILL_CLOSE_MS, PILL_OPEN_MS, PILL_REST, pillOpen, pillPinned, pillStep, pillTimer, type PillEvent, type PillState } from "./pill";

const run = (events: PillEvent[], from: PillState = PILL_REST) => events.reduce(pillStep, from);

describe("the one pill", () => {
  it("rests collapsed, showing the cover, title and artist only", () => {
    expect(pillOpen(PILL_REST)).toBe(false);
    expect(pillPinned(PILL_REST)).toBe(false);
  });

  it("does not open for a cursor that passes over it", () => {
    const passing = run(["enter", "leave"]);
    expect(passing).toEqual(PILL_REST);
    expect(pillOpen(run(["enter"]))).toBe(false);
  });

  it("opens once the pointer has stayed for the intent delay", () => {
    const state = run(["enter", "openElapsed"]);
    expect(state.phase).toBe("hover");
    expect(pillOpen(state)).toBe(true);
    expect(pillPinned(state)).toBe(false);
  });

  it("stays open through the grace after the pointer leaves, then closes", () => {
    const leaving = run(["enter", "openElapsed", "leave"]);
    expect(pillOpen(leaving)).toBe(true);
    expect(pillOpen(run(["closeElapsed"], leaving))).toBe(false);
    expect(pillOpen(run(["enter", "closeElapsed"], leaving))).toBe(true);
  });

  it("pins on a click, wherever the click lands in the sequence", () => {
    for (const before of [[], ["enter"], ["enter", "openElapsed"], ["enter", "openElapsed", "leave"]] as PillEvent[][]) {
      expect(pillPinned(run(["click"], run(before)))).toBe(true);
    }
  });

  it("stays pinned when the pointer comes and goes, so Tracks stay usable", () => {
    const pinned = run(["click", "leave", "enter", "leave"]);
    expect(pillPinned(pinned)).toBe(true);
    expect(pillOpen(pinned)).toBe(true);
    expect(pillOpen(run(["closeElapsed", "openElapsed"], pinned))).toBe(true);
  });

  it("stays pinned through more clicks, so using the controls never lets it go", () => {
    expect(pillPinned(run(["click", "click", "click"]))).toBe(true);
  });

  it("collapses on a click outside or Escape, pinned or not", () => {
    expect(run(["click", "outside"])).toEqual(PILL_REST);
    expect(run(["click", "escape"])).toEqual(PILL_REST);
    expect(run(["enter", "openElapsed", "escape"])).toEqual(PILL_REST);
    expect(run(["focusIn", "escape"])).toEqual(PILL_REST);
  });

  it("opens on keyboard focus and closes when focus leaves", () => {
    const focused = run(["focusIn"]);
    expect(pillOpen(focused)).toBe(true);
    expect(pillPinned(focused)).toBe(false);
    expect(pillOpen(run(["focusOut"], focused))).toBe(false);
  });

  it("stays open on focus even after the pointer's grace ends", () => {
    expect(pillOpen(run(["focusIn", "enter", "openElapsed", "leave", "closeElapsed"]))).toBe(true);
  });

  it("names the timer each phase waits on", () => {
    expect(pillTimer("opening")).toEqual({ event: "openElapsed", ms: PILL_OPEN_MS });
    expect(pillTimer("closing")).toEqual({ event: "closeElapsed", ms: PILL_CLOSE_MS });
    for (const phase of ["collapsed", "hover", "pinned"] as const) expect(pillTimer(phase)).toBeNull();
    expect(PILL_OPEN_MS).toBeLessThan(PILL_CLOSE_MS);
  });
});
