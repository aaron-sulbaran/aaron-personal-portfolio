import { describe, expect, it } from "vitest";
import { HOVER_START, hoverReducer, type HoverEvent, type HoverState } from "@/lib/waveform/pill";

const run = (events: HoverEvent["type"][], from: HoverState = HOVER_START) =>
  events.reduce((state, type) => hoverReducer(state, { type } as HoverEvent), from);

describe("hoverReducer", () => {
  it("starts collapsed with no tooltip", () => {
    expect(HOVER_START).toEqual({ mode: "collapsed", tip: false, recent: false, suppress: false });
  });

  it("grows to the preview on hover and back on leave", () => {
    expect(run(["enter"]).mode).toBe("preview");
    expect(run(["enter", "tip"]).tip).toBe(true);
    expect(run(["enter", "tip", "leave"])).toEqual(HOVER_START);
  });

  it("ignores a late tooltip timer once the preview is gone", () => {
    expect(run(["enter", "leave", "tip"]).tip).toBe(false);
  });

  it("opens the card on click and holds it through a pill leave", () => {
    const open = run(["enter", "open"]);
    expect(open.mode).toBe("expanded");
    expect(open.tip).toBe(false);
    expect(run(["leave"], open).mode).toBe("expanded");
  });

  it("minimizes when the cursor leaves the card, with a grace window to snap back", () => {
    const left = run(["open", "cardLeave"]);
    expect(left).toEqual({ mode: "collapsed", tip: false, recent: true, suppress: true });
    // Straight after leaving, the re-entry is suppressed so the card does not bounce.
    expect(run(["enter"], left).mode).toBe("collapsed");
    // Once the suppress window ends, a hover inside the grace window reopens the card.
    expect(run(["suppressEnd", "enter"], left).mode).toBe("expanded");
    // After the grace window, hover is the plain preview again.
    expect(run(["suppressEnd", "graceEnd", "enter"], left).mode).toBe("preview");
  });

  it("collapses from the card's own button without a grace window", () => {
    expect(run(["open", "collapse"])).toEqual(HOVER_START);
  });

  it("resets everything when the music is turned off", () => {
    expect(run(["open", "cardLeave", "reset"])).toEqual(HOVER_START);
  });
});
