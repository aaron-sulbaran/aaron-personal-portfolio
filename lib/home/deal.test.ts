import { describe, expect, it } from "vitest";
import {
  DEAL_IDLE,
  DEAL_REDUCED,
  clickPlan,
  dealAttribute,
  dealReducer,
  dealTrigger,
  isSpent,
  type DealAction,
  type DealState,
  type TriggerFrame,
} from "@/lib/home/deal";

const run = (actions: DealAction[], from: DealState = DEAL_IDLE) => actions.reduce(dealReducer, from);

// The cards section's box in a 900px viewport: top at `topFrac` of it, 830px tall.
const frame = (topFrac: number, scrollingDown = true): TriggerFrame => ({
  sectionTop: topFrac * 900,
  sectionBottom: topFrac * 900 + 830,
  viewportHeight: 900,
  scrollingDown,
});

describe("the deal's state machine", () => {
  it("starts idle and unspent", () => {
    expect(DEAL_IDLE).toMatchObject({ phase: "idle", spent: false, hold: false, riffles: 0, entrances: 0 });
  });

  it("goes idle, riffling, dealing, dealt, and counts each step once", () => {
    const riffling = run([{ type: "riffle", source: "scroll" }]);
    expect(riffling).toMatchObject({ phase: "riffling", spent: true, source: "scroll", riffles: 1 });
    const dealing = dealReducer(riffling, { type: "enter", source: "view" });
    expect(dealing).toMatchObject({ phase: "dealing", entrances: 1, hold: false });
    // The path that started it stays its source.
    expect(dealing.source).toBe("scroll");
    expect(dealReducer(dealing, { type: "finish" }).phase).toBe("dealt");
  });

  it("deals straight from idle with no riffle when the section is already in view", () => {
    const dealing = run([{ type: "enter", source: "view" }]);
    expect(dealing).toMatchObject({ phase: "dealing", riffles: 0, entrances: 1, source: "view" });
  });

  it("plays once per load: nothing restarts a deal under way or done", () => {
    const dealt = run([{ type: "enter", source: "click" }, { type: "finish" }]);
    expect(run([{ type: "riffle", source: "click" }, { type: "enter", source: "view" }, { type: "riffle", source: "scroll" }], dealt)).toEqual(dealt);
    const dealing = run([{ type: "enter", source: "click" }]);
    expect(dealReducer(dealing, { type: "riffle", source: "scroll" })).toBe(dealing);
    expect(dealReducer(dealing, { type: "enter", source: "view" })).toBe(dealing);
    // A riffle only starts from idle.
    const riffling = run([{ type: "riffle", source: "click" }]);
    expect(dealReducer(riffling, { type: "riffle", source: "scroll" })).toBe(riffling);
  });

  it("ignores finish unless a deal is under way", () => {
    expect(dealReducer(DEAL_IDLE, { type: "finish" })).toBe(DEAL_IDLE);
    expect(run([{ type: "riffle", source: "click" }, { type: "finish" }]).phase).toBe("riffling");
  });

  it("skips everything at once, and spends a dealt state when skipped again", () => {
    const skipped = run([{ type: "riffle", source: "click" }, { type: "hold", on: true }, { type: "skip" }]);
    expect(skipped).toMatchObject({ phase: "dealt", spent: true, hold: false });
    expect(dealReducer(DEAL_REDUCED, { type: "skip" })).toMatchObject({ phase: "dealt", spent: true });
    expect(dealReducer(skipped, { type: "skip" })).toBe(skipped);
  });

  it("starts dealt but unspent under reduced motion, and reaching the cards spends it", () => {
    expect(DEAL_REDUCED).toMatchObject({ phase: "dealt", spent: false });
    expect(isSpent(DEAL_REDUCED)).toBe(false);
    const reached = dealReducer(DEAL_REDUCED, { type: "enter", source: "view" });
    expect(reached).toMatchObject({ phase: "dealt", spent: true, entrances: 0 });
    expect(isSpent(reached)).toBe(true);
  });

  it("turns a deal in any phase into the dealt state when reduced motion comes on, keeping spent as it was", () => {
    expect(dealReducer(DEAL_IDLE, { type: "reduced" })).toMatchObject({ phase: "dealt", spent: false });
    const mid = run([{ type: "enter", source: "view" }]);
    expect(dealReducer(mid, { type: "reduced" })).toMatchObject({ phase: "dealt", spent: true });
    expect(dealReducer(DEAL_REDUCED, { type: "reduced" })).toBe(DEAL_REDUCED);
  });

  it("holds the entrance while the click path scrolls, and a reset starts over keeping the counts", () => {
    expect(run([{ type: "hold", on: true }]).hold).toBe(true);
    const held = run([{ type: "hold", on: true }]);
    expect(dealReducer(held, { type: "hold", on: true })).toBe(held);
    const dealt = run([{ type: "riffle", source: "click" }, { type: "enter", source: "click" }, { type: "finish" }]);
    expect(dealReducer(dealt, { type: "reset" })).toEqual({ ...DEAL_IDLE, riffles: 1, entrances: 1 });
  });

  it("mirrors the phase to the three values the page's CSS knows", () => {
    expect(dealAttribute(DEAL_IDLE)).toBe("closed");
    expect(dealAttribute(run([{ type: "riffle", source: "click" }]))).toBe("closed");
    expect(dealAttribute(run([{ type: "enter", source: "view" }]))).toBe("dealing");
    expect(dealAttribute(DEAL_REDUCED)).toBe("dealt");
  });

  it("shows the fork's after state once the deal is under way, never while idle or riffling", () => {
    expect(isSpent(DEAL_IDLE)).toBe(false);
    expect(isSpent(run([{ type: "riffle", source: "click" }]))).toBe(false);
    expect(isSpent(run([{ type: "enter", source: "view" }]))).toBe(true);
    expect(isSpent(run([{ type: "enter", source: "view" }, { type: "finish" }]))).toBe(true);
  });
});

describe("what the cards section's place asks for", () => {
  it("riffles on the first way down once the section peeks, and not before", () => {
    expect(dealTrigger(frame(1.2), DEAL_IDLE, true)).toBeNull();
    expect(dealTrigger(frame(1), DEAL_IDLE, true)).toBe("riffle");
    expect(dealTrigger(frame(0.8), DEAL_IDLE, true)).toBe("riffle");
  });

  it("never riffles on a scroll up, with the knob off, or twice", () => {
    expect(dealTrigger(frame(0.8, false), DEAL_IDLE, true)).toBeNull();
    expect(dealTrigger(frame(0.8), DEAL_IDLE, false)).toBeNull();
    expect(dealTrigger(frame(0.8), run([{ type: "riffle", source: "scroll" }]), true)).toBeNull();
  });

  it("deals once the section's top is at or above 65 percent, riffled or not", () => {
    expect(dealTrigger(frame(0.66), DEAL_IDLE, true)).toBe("riffle");
    expect(dealTrigger(frame(0.65), DEAL_IDLE, true)).toBe("enter");
    expect(dealTrigger(frame(0), DEAL_IDLE, true)).toBe("enter");
    expect(dealTrigger(frame(0.3), run([{ type: "riffle", source: "scroll" }]), true)).toBe("enter");
  });

  it("deals on a load that already has the section in view, and on a scroll up from below it, but not once it has left", () => {
    expect(dealTrigger(frame(0, false), DEAL_IDLE, true)).toBe("enter");
    // Scrolled past: its bottom edge is above 35 percent of the viewport.
    const past: TriggerFrame = { sectionTop: -800, sectionBottom: 30, viewportHeight: 900, scrollingDown: false };
    expect(dealTrigger(past, DEAL_IDLE, true)).toBeNull();
    const below: TriggerFrame = { sectionTop: -300, sectionBottom: 530, viewportHeight: 900, scrollingDown: false };
    expect(dealTrigger(below, DEAL_IDLE, true)).toBe("enter");
  });

  it("holds the entrance while the click path scrolls, then deals on the arrival", () => {
    const held = run([{ type: "riffle", source: "click" }, { type: "hold", on: true }]);
    expect(dealTrigger(frame(0.3), held, true)).toBeNull();
    expect(dealTrigger(frame(0), dealReducer(held, { type: "hold", on: false }), true)).toBe("enter");
  });

  it("asks for nothing while dealing, and nothing once dealt and spent", () => {
    const dealing = run([{ type: "enter", source: "view" }]);
    expect(dealTrigger(frame(0), dealing, true)).toBeNull();
    expect(dealTrigger(frame(0), dealReducer(dealing, { type: "finish" }), true)).toBeNull();
  });

  it("lets reduced motion's unspent dealt state be spent by reaching the cards", () => {
    expect(dealTrigger(frame(0.9), DEAL_REDUCED, true)).toBeNull();
    expect(dealTrigger(frame(0.4), DEAL_REDUCED, true)).toBe("enter");
  });
});

describe("what a click on the fork does", () => {
  it("riffles first from idle, then scrolls", () => {
    expect(clickPlan(DEAL_IDLE, false, true)).toBe("riffle");
    expect(clickPlan(DEAL_IDLE, false, false)).toBe("scroll");
  });

  it("scrolls on, with no second riffle, when the reader's scroll already started one", () => {
    expect(clickPlan(run([{ type: "riffle", source: "scroll" }]), false, true)).toBe("scroll");
  });

  it("jumps under reduced motion, then only scrolls back", () => {
    expect(clickPlan(DEAL_IDLE, true, true)).toBe("jump");
    expect(clickPlan(DEAL_REDUCED, true, true)).toBe("jump");
    expect(clickPlan(run([{ type: "skip" }]), true, true)).toBe("back");
  });

  it("only leads back once dealt, with no replay, and does nothing while dealing", () => {
    const dealing = run([{ type: "enter", source: "view" }]);
    expect(clickPlan(dealing, false, true)).toBe("none");
    expect(clickPlan(dealReducer(dealing, { type: "finish" }), false, true)).toBe("back");
  });
});
