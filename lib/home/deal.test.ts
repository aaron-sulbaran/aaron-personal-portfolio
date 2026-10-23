import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  DEAL_IDLE,
  DEAL_REDUCED,
  clickPlan,
  dealAttribute,
  dealReducer,
  dealTrigger,
  coilIsTheirs,
  isAfter,
  type DealAction,
  type DealState,
  type TriggerFrame,
} from "@/lib/home/deal";

const run = (actions: DealAction[], from: DealState = DEAL_IDLE) => actions.reduce(dealReducer, from);

// The reader's place: `progress` of the way through the sticky stage's range,
// with the cards section's box in a 900px viewport: top at `topFrac` of it,
// 830px tall.
const frame = (progress: number, topFrac = 0, scrollingDown = true): TriggerFrame => ({
  stickyProgress: progress,
  sectionTop: topFrac * 900,
  sectionBottom: topFrac * 900 + 830,
  viewportHeight: 900,
  scrollingDown,
});

describe("the deal's state machine", () => {
  it("starts idle and unspent", () => {
    expect(DEAL_IDLE).toMatchObject({ phase: "idle", spent: false, hold: false, entrances: 0 });
  });

  it("goes idle, dealing, dealt, and counts the deal once", () => {
    const dealing = run([{ type: "enter", source: "scroll" }]);
    expect(dealing).toMatchObject({ phase: "dealing", entrances: 1, hold: false, spent: true, source: "scroll" });
    expect(dealReducer(dealing, { type: "finish" }).phase).toBe("dealt");
  });

  it("deals straight from idle when the section is already in view", () => {
    const dealing = run([{ type: "enter", source: "view" }]);
    expect(dealing).toMatchObject({ phase: "dealing", entrances: 1, source: "view" });
  });

  it("plays once per load: nothing restarts a deal under way or done", () => {
    const dealt = run([{ type: "enter", source: "click" }, { type: "finish" }]);
    expect(run([{ type: "enter", source: "view" }], dealt)).toEqual(dealt);
    const dealing = run([{ type: "enter", source: "click" }]);
    expect(dealReducer(dealing, { type: "enter", source: "view" })).toBe(dealing);
  });

  it("ignores finish unless a deal is under way", () => {
    expect(dealReducer(DEAL_IDLE, { type: "finish" })).toBe(DEAL_IDLE);
  });

  it("skips everything at once, and spends a dealt state when skipped again", () => {
    const skipped = run([{ type: "hold", on: true }, { type: "skip" }]);
    expect(skipped).toMatchObject({ phase: "dealt", spent: true, hold: false });
    expect(dealReducer(DEAL_REDUCED, { type: "skip" })).toMatchObject({ phase: "dealt", spent: true });
    expect(dealReducer(skipped, { type: "skip" })).toBe(skipped);
  });

  it("starts dealt but unspent under reduced motion, and reaching the cards spends it", () => {
    expect(DEAL_REDUCED).toMatchObject({ phase: "dealt", spent: false });
    expect(isAfter(DEAL_REDUCED)).toBe(false);
    const reached = dealReducer(DEAL_REDUCED, { type: "enter", source: "view" });
    expect(reached).toMatchObject({ phase: "dealt", spent: true, entrances: 0 });
    expect(isAfter(reached)).toBe(true);
  });

  it("turns a deal in any phase into the dealt state when reduced motion comes on, keeping spent as it was", () => {
    expect(dealReducer(DEAL_IDLE, { type: "reduced" })).toMatchObject({ phase: "dealt", spent: false });
    const mid = run([{ type: "enter", source: "view" }]);
    expect(dealReducer(mid, { type: "reduced" })).toMatchObject({ phase: "dealt", spent: true });
    expect(dealReducer(DEAL_REDUCED, { type: "reduced" })).toBe(DEAL_REDUCED);
  });

  it("holds the entrance while the click path scrolls, and a reset starts over keeping the count", () => {
    expect(run([{ type: "hold", on: true }]).hold).toBe(true);
    const held = run([{ type: "hold", on: true }]);
    expect(dealReducer(held, { type: "hold", on: true })).toBe(held);
    const dealt = run([{ type: "enter", source: "click" }, { type: "finish" }]);
    expect(dealReducer(dealt, { type: "reset" })).toEqual({ ...DEAL_IDLE, entrances: 1 });
  });

  it("mirrors the phase to the four values the page's CSS knows", () => {
    expect(dealAttribute(DEAL_IDLE)).toBe("closed");
    expect(dealAttribute(run([{ type: "enter", source: "view" }]))).toBe("dealing");
    expect(dealAttribute(run([{ type: "enter", source: "view" }, { type: "unfurl" }]))).toBe("unfurled");
    expect(dealAttribute(DEAL_REDUCED)).toBe("dealt");
  });

  it("unfurls only while dealing, once, and the Coil is the reader's from the unfurl, not from the columns", () => {
    expect(dealReducer(DEAL_IDLE, { type: "unfurl" })).toBe(DEAL_IDLE);
    const dealing = run([{ type: "enter", source: "click" }]);
    expect(coilIsTheirs(dealing)).toBe(false);
    const unfurled = dealReducer(dealing, { type: "unfurl" });
    expect(unfurled).toMatchObject({ phase: "dealing", unfurled: true });
    expect(dealReducer(unfurled, { type: "unfurl" })).toBe(unfurled);
    expect(coilIsTheirs(unfurled)).toBe(true);
    expect(coilIsTheirs(dealReducer(unfurled, { type: "finish" }))).toBe(true);
    expect(coilIsTheirs(DEAL_IDLE)).toBe(false);
    expect(coilIsTheirs(DEAL_REDUCED)).toBe(true);
    // A new deal (the lab's replay) starts closed again.
    expect(coilIsTheirs(dealReducer(dealReducer(unfurled, { type: "reset" }), { type: "enter", source: "click" }))).toBe(false);
  });

  it("shows the teaser's after state only once the deal is over, so the label never flips under text that is still leaving", () => {
    expect(isAfter(DEAL_IDLE)).toBe(false);
    expect(isAfter(run([{ type: "enter", source: "view" }]))).toBe(false);
    expect(isAfter(run([{ type: "enter", source: "view" }, { type: "finish" }]))).toBe(true);
    expect(isAfter(run([{ type: "skip" }]))).toBe(true);
  });
});

describe("what the reader's place asks for", () => {
  it("deals once the reader is 18 percent through the sticky range, never before, and never while the stage has not stuck", () => {
    expect(COIL.deal.trigger.enterAtProgress).toBe(0.18);
    expect(dealTrigger(frame(-0.4, 1.4), DEAL_IDLE)).toBeNull();
    expect(dealTrigger(frame(0, 1), DEAL_IDLE)).toBeNull();
    expect(dealTrigger(frame(0.17, 0.9), DEAL_IDLE)).toBeNull();
    expect(dealTrigger(frame(0.18, 0.9), DEAL_IDLE)).toBe("enter");
    expect(dealTrigger(frame(1, 0), DEAL_IDLE)).toBe("enter");
  });

  it("deals on a load or an anchor jump that finds the stage stuck, and on a scroll up from below it, but not once it has left", () => {
    expect(dealTrigger(frame(1, 0, false), DEAL_IDLE)).toBe("enter");
    // Scrolled past: the section's bottom edge is above 35 percent of the viewport.
    const past: TriggerFrame = { stickyProgress: 1, sectionTop: -800, sectionBottom: 30, viewportHeight: 900, scrollingDown: false };
    expect(dealTrigger(past, DEAL_IDLE)).toBeNull();
    const below: TriggerFrame = { stickyProgress: 1, sectionTop: -300, sectionBottom: 530, viewportHeight: 900, scrollingDown: false };
    expect(dealTrigger(below, DEAL_IDLE)).toBe("enter");
  });

  it("holds the entrance while a hold is on, then deals", () => {
    const held = run([{ type: "hold", on: true }]);
    expect(dealTrigger(frame(0.3, 0.3), held)).toBeNull();
    expect(dealTrigger(frame(1, 0), dealReducer(held, { type: "hold", on: false }))).toBe("enter");
  });

  it("asks for nothing while dealing, and nothing once dealt and spent", () => {
    const dealing = run([{ type: "enter", source: "view" }]);
    expect(dealTrigger(frame(1, 0), dealing)).toBeNull();
    expect(dealTrigger(frame(1, 0), dealReducer(dealing, { type: "finish" }))).toBeNull();
  });

  it("lets reduced motion's unspent dealt state be spent by reaching the cards", () => {
    expect(dealTrigger(frame(0.05, 0.9), DEAL_REDUCED)).toBeNull();
    expect(dealTrigger(frame(0.4, 0.4), DEAL_REDUCED)).toBe("enter");
  });
});

describe("what a click on the teaser does", () => {
  it("plays the deal with its scroll from idle", () => {
    expect(clickPlan(DEAL_IDLE, false)).toBe("scroll");
  });

  it("jumps under reduced motion, then only scrolls back", () => {
    expect(clickPlan(DEAL_IDLE, true)).toBe("jump");
    expect(clickPlan(DEAL_REDUCED, true)).toBe("jump");
    expect(clickPlan(run([{ type: "skip" }]), true)).toBe("back");
  });

  it("only leads back once dealt, with no replay, and does nothing while dealing", () => {
    const dealing = run([{ type: "enter", source: "view" }]);
    expect(clickPlan(dealing, false)).toBe("none");
    expect(clickPlan(dealReducer(dealing, { type: "finish" }), false)).toBe("back");
  });
});
