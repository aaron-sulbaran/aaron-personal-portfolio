import { beforeEach, describe, expect, it } from "vitest";
import {
  INTRO_ITEMS,
  beginIntroLoad,
  createLoadTally,
  displayPercent,
  easeFill,
  endIntroLoad,
  fillComplete,
  fillTarget,
  reportIntroLoad,
  resetIntroLoadFacts,
  showNumber,
} from "@/lib/home/introLoad";

const make = (giveUpMs = 4000) => createLoadTally({ items: INTRO_ITEMS, startMs: 0, giveUpMs });

describe("the loader's tally", () => {
  it("starts at nothing and reads full only when every item has resolved", () => {
    const tally = make();
    expect(tally.progress()).toBe(0);
    tally.report("fonts");
    expect(tally.progress()).toBeCloseTo(0.35, 6);
    expect(tally.done()).toBe(false);
    tally.report("field", 0.5);
    expect(tally.progress()).toBeLessThan(1);
    tally.report("field");
    expect(tally.done()).toBe(true);
    expect(tally.progress()).toBe(1);
  });

  it("never reads 1 before it is done, even with every item almost in", () => {
    const tally = make();
    tally.report("fonts", 0.9999);
    tally.report("field", 0.9999);
    expect(tally.progress()).toBeLessThan(1);
  });

  it("only rises", () => {
    const tally = make();
    tally.report("field", 0.8);
    const high = tally.progress();
    tally.report("field", 0.2);
    expect(tally.progress()).toBe(high);
  });

  it("gives up at the cap, so a stalled asset never holds the page", () => {
    const tally = make(4000);
    tally.report("fonts");
    tally.check(3999);
    expect(tally.done()).toBe(false);
    tally.check(4000);
    expect(tally.done()).toBe(true);
    expect(tally.gaveUp()).toBe(true);
    expect(tally.progress()).toBe(1);
  });

  it("does not call a load that finished by itself a give-up", () => {
    const tally = make();
    tally.settle();
    tally.check(9999);
    expect(tally.gaveUp()).toBe(false);
  });

  it("ignores an item it does not track", () => {
    const tally = createLoadTally({ items: ["fonts"], startMs: 0, giveUpMs: 100 });
    tally.report("field");
    expect(tally.progress()).toBe(0);
    tally.report("fonts");
    expect(tally.done()).toBe(true);
  });
});

describe("the fill it drives", () => {
  it("is never ahead of what has really loaded", () => {
    expect(fillTarget(0.2, false, 10_000, 650)).toBeCloseTo(0.2, 6);
    expect(fillTarget(0.7, false, 10_000, 650)).toBeCloseTo(0.7, 6);
  });

  it("is never faster than its shortest run", () => {
    expect(fillTarget(1, true, 0, 650)).toBe(0);
    expect(fillTarget(1, true, 325, 650)).toBeGreaterThan(0.5);
    expect(fillTarget(1, true, 325, 650)).toBeLessThan(1);
    expect(fillTarget(1, true, 650, 650)).toBe(1);
  });

  it("is full only when the clock and the load both say so", () => {
    expect(fillComplete(true, 649, 650)).toBe(false);
    expect(fillComplete(false, 5000, 650)).toBe(false);
    expect(fillComplete(true, 650, 650)).toBe(true);
  });

  it("chases its target and lands exactly on a full one", () => {
    const step = easeFill(0, 0.5, 1 / 60);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(0.5);
    expect(easeFill(0.9, 1, 1 / 60)).toBe(1);
    expect(easeFill(0.4, 0.4, 1 / 60)).toBe(0.4);
  });

  it("shows the number only for a load still running at 600ms", () => {
    expect(showNumber(599, false, 600)).toBe(false);
    expect(showNumber(700, false, 600)).toBe(true);
    expect(showNumber(700, true, 600)).toBe(false);
  });

  it("shows 100 only when done", () => {
    expect(displayPercent(0.999, false)).toBe(99);
    expect(displayPercent(0.5, true)).toBe(100);
    expect(displayPercent(0.42, false)).toBe(42);
  });
});

describe("the page's tally", () => {
  beforeEach(() => resetIntroLoadFacts());

  it("hears what was reported before the loader began", () => {
    reportIntroLoad("field");
    const tally = beginIntroLoad(0, 4000);
    expect(tally.progress()).toBeCloseTo(0.65 / 1, 6);
    endIntroLoad(tally);
  });

  it("hears what is reported while it runs", () => {
    const tally = beginIntroLoad(0, 4000);
    reportIntroLoad("fonts");
    reportIntroLoad("field");
    expect(tally.done()).toBe(true);
    endIntroLoad(tally);
    reportIntroLoad("fonts");
  });
});
