import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { stickyProgress } from "@/lib/home/stickyRange";
import { crossesTrigger, guardArmed, keyStepPx, triggerScrollY, type TriggerGeometry } from "@/lib/home/triggerGuardRules";

const { enterAtProgress } = COIL.deal.trigger;

// The same page scrolled by `by` px: everything in the viewport moves up by it.
const scrolled = (g: TriggerGeometry, by: number): TriggerGeometry => ({ ...g, scrollY: g.scrollY + by, railTop: g.railTop - by, sectionTop: g.sectionTop - by });
const progressAt = (g: TriggerGeometry) => stickyProgress({ railTop: g.railTop, range: g.range, sectionTop: g.sectionTop, viewportHeight: g.viewportHeight });

// Measured on the production build: 1280x800 with block 4 at the screen's top, and 390x844.
const DESKTOP: TriggerGeometry = { scrollY: 983.6, railTop: 1157 - 983.6, range: 504, sectionTop: 1661 - 983.6, viewportHeight: 800 };
const PHONE_FLOW: TriggerGeometry = { scrollY: 900, railTop: 1700 - 900, range: 0, sectionTop: 1750 - 900, viewportHeight: 844 };

describe("the deal's trigger as a scroll position", () => {
  it("is where the sticky range's progress reaches the trigger, from wherever the page is", () => {
    for (const g of [DESKTOP, scrolled(DESKTOP, -300), scrolled(DESKTOP, 120)]) {
      const at = triggerScrollY(g);
      expect(at).toBeCloseTo(1157 + enterAtProgress * 504, 6);
      expect(progressAt(scrolled(g, at - g.scrollY))).toBeCloseTo(enterAtProgress, 9);
      expect(progressAt(scrolled(g, at - g.scrollY - 1))).toBeLessThan(enterAtProgress);
    }
  });

  it("is where the section has come far enough up the screen when there is no sticky range", () => {
    const at = triggerScrollY(PHONE_FLOW);
    expect(progressAt(scrolled(PHONE_FLOW, at - PHONE_FLOW.scrollY))).toBeCloseTo(enterAtProgress, 9);
    expect(progressAt(scrolled(PHONE_FLOW, at - PHONE_FLOW.scrollY - 1))).toBeLessThan(enterAtProgress);
  });
});

describe("when the page decides on the reader's input itself", () => {
  const triggerY = 1248;
  const at = (scrollY: number, waiting = true) => guardArmed({ scrollY, triggerY, viewportHeight: 800, waiting });

  it("listens within a viewport above the trigger while the deal waits for the reader", () => {
    expect(at(triggerY - 1)).toBe(true);
    expect(at(triggerY - 264)).toBe(true); // block 4 at the screen's top, the e2e fling's start
    expect(at(triggerY - 800 * COIL.deal.cutscene.guardAheadVh)).toBe(true);
  });

  it("does not listen far above the trigger, at it or below, or once the deal is not waiting", () => {
    expect(at(triggerY - 800 * COIL.deal.cutscene.guardAheadVh - 1)).toBe(false);
    expect(at(0)).toBe(false);
    expect(at(triggerY)).toBe(false);
    expect(at(triggerY + 400)).toBe(false);
    expect(at(triggerY - 100, false)).toBe(false);
  });
});

describe("whether an input would carry the page past the trigger", () => {
  it("is a step down that reaches it (half a pixel of slack for fractional positions)", () => {
    expect(crossesTrigger(1100, 148, 1248)).toBe(true);
    expect(crossesTrigger(1100, 147.6, 1248)).toBe(true);
    expect(crossesTrigger(1100, 147, 1248)).toBe(false);
    expect(crossesTrigger(1100, 900, 1248)).toBe(true);
  });

  it("is never a step up, or none", () => {
    expect(crossesTrigger(1240, -100, 1248)).toBe(false);
    expect(crossesTrigger(1247.9, 0, 1248)).toBe(false);
  });

  it("reads the scroll keys as Chromium scrolls them", () => {
    expect(keyStepPx("ArrowDown", false, 800)).toBe(40);
    expect(keyStepPx("ArrowUp", false, 800)).toBe(-40);
    expect(keyStepPx("PageDown", false, 800)).toBe(700);
    expect(keyStepPx(" ", false, 800)).toBe(700);
    expect(keyStepPx(" ", true, 800)).toBe(-700);
    expect(keyStepPx("End", false, 800)).toBe(Number.POSITIVE_INFINITY);
    expect(keyStepPx("Home", false, 800)).toBe(Number.NEGATIVE_INFINITY);
    expect(keyStepPx("Tab", false, 800)).toBe(0);
    expect(crossesTrigger(600, keyStepPx("End", false, 800), 1248)).toBe(true);
    expect(crossesTrigger(1240, keyStepPx("Home", false, 800), 1248)).toBe(false);
  });
});
