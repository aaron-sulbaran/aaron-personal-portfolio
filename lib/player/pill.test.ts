import { describe, expect, it } from "vitest";
import { PILL_CLOSE_MS, PILL_IDLE_MS, PILL_OPEN_MS } from "./constants";
import { idleLeft, PILL_REST, pillOpen, pillPinned, pillStep, pillTimer, type PillEvent, type PillState } from "./pill";

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

  it("stays pinned when the pointer comes and goes, until the idle fold", () => {
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
});

describe("the idle fold", () => {
  it("folds a hover-opened pill after the idle wait, and a pinned one too", () => {
    expect(run(["enter", "openElapsed", "idleElapsed"])).toEqual(PILL_REST);
    expect(run(["click", "idleElapsed"])).toEqual(PILL_REST);
    expect(pillOpen(run(["click", "leave", "idleElapsed"]))).toBe(false);
  });

  it("waits for it in an open pill, hovered or pinned, and in no other phase", () => {
    expect(pillTimer(run(["enter", "openElapsed"]))).toEqual({ event: "idleElapsed", ms: PILL_IDLE_MS });
    expect(pillTimer(run(["click"]))).toEqual({ event: "idleElapsed", ms: PILL_IDLE_MS });
    expect(pillTimer(PILL_REST)).toBeNull();
    expect(pillTimer(run(["enter"]))?.event).toBe("openElapsed");
    expect(pillTimer(run(["enter", "openElapsed", "leave"]))?.event).toBe("closeElapsed");
  });

  it("never times out a keyboard visitor: focus inside holds the pill open", () => {
    const pinnedAndFocused = run(["click", "focusIn"]);
    expect(pillTimer(pinnedAndFocused)).toBeNull();
    expect(run(["idleElapsed"], pinnedAndFocused)).toEqual(pinnedAndFocused);
    expect(pillOpen(run(["idleElapsed"], run(["focusIn", "enter", "openElapsed"])))).toBe(true);
  });

  it("starts waiting again once the focus leaves", () => {
    const state = run(["click", "focusIn", "focusOut"]);
    expect(pillTimer(state)?.event).toBe("idleElapsed");
    expect(run(["idleElapsed"], state)).toEqual(PILL_REST);
  });

  it("never folds while a seek is being dragged, however long it takes", () => {
    const dragging = run(["click", "dragStart"]);
    expect(pillTimer(dragging)).toBeNull();
    expect(run(["idleElapsed"], dragging)).toEqual(dragging);
    expect(pillPinned(run(["idleElapsed"], dragging))).toBe(true);
  });

  it("keeps a hover-opened pill open when a drag carries the pointer out of it", () => {
    const state = run(["enter", "openElapsed", "dragStart", "leave"]);
    expect(state.phase).toBe("hover");
    expect(pillOpen(state)).toBe(true);
  });

  it("waits again from the end of a drag", () => {
    const state = run(["click", "dragStart", "dragEnd"]);
    expect(pillTimer(state)?.event).toBe("idleElapsed");
    expect(run(["idleElapsed"], state)).toEqual(PILL_REST);
  });

  it("does nothing to a collapsed or closing pill", () => {
    expect(run(["idleElapsed"])).toEqual(PILL_REST);
    const closing = run(["enter", "openElapsed", "leave"]);
    expect(run(["idleElapsed"], closing)).toEqual(closing);
  });

  it("lets Escape and an outside press close it whatever the focus or the drag", () => {
    expect(run(["click", "focusIn", "dragStart", "escape"])).toEqual(PILL_REST);
    expect(run(["click", "dragStart", "outside"])).toEqual(PILL_REST);
  });

  it("counts the idle wait from the last touch", () => {
    expect(PILL_IDLE_MS).toBe(4000);
    expect(idleLeft(10_000, 10_000)).toBe(PILL_IDLE_MS);
    expect(idleLeft(12_500, 10_000)).toBe(PILL_IDLE_MS - 2500);
    expect(idleLeft(14_000, 10_000)).toBe(0);
    expect(idleLeft(20_000, 10_000)).toBe(0);
    expect(idleLeft(12_000, 10_000, 1000)).toBe(0);
  });

  it("keeps the other waits short next to it", () => {
    expect(pillTimer(run(["enter"]))).toEqual({ event: "openElapsed", ms: PILL_OPEN_MS });
    expect(pillTimer(run(["enter", "openElapsed", "leave"]))).toEqual({ event: "closeElapsed", ms: PILL_CLOSE_MS });
    expect(PILL_OPEN_MS).toBeLessThan(PILL_CLOSE_MS);
    expect(PILL_CLOSE_MS).toBeLessThan(PILL_IDLE_MS);
  });
});
