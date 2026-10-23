import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { ARRIVAL_STEP, ARRIVAL_STEPS, DEFAULT_ARRIVAL, arrivalPlan, arrivalStyle, arrivalVars } from "@/lib/home/introArrival";
import { DEFAULT_INTRO_KNOBS, INTRO_KNOB_SPEC, clampIntroKnobs } from "@/lib/home/introKnobs";
import { introDomPlan } from "@/lib/home/introDom";

describe("page 1's words arriving", () => {
  it("runs the steps in the order Aaron asked for", () => {
    const { name, blocks, band, button } = ARRIVAL_STEP;
    expect(name).toBeLessThan(blocks[0]);
    expect(blocks[0]).toBeLessThan(blocks[1]);
    expect(blocks[1]).toBeLessThan(band);
    expect(band).toBeLessThan(blocks[2]);
    expect(blocks[2]).toBe(blocks[3]);
    expect(blocks[3]).toBeLessThan(button);
    expect(Math.max(name, ...blocks, band, button)).toBe(ARRIVAL_STEPS - 1);
  });

  it("staggers 120 to 180 ms, takes 500 to 700 ms an item, and is all there within 2 s", () => {
    const plan = arrivalPlan(DEFAULT_ARRIVAL);
    expect(plan.staggerMs).toBeGreaterThanOrEqual(120);
    expect(plan.staggerMs).toBeLessThanOrEqual(180);
    expect(plan.itemMs).toBeGreaterThanOrEqual(500);
    expect(plan.itemMs).toBeLessThanOrEqual(700);
    expect(plan.doneMs).toBeLessThanOrEqual(2000);
    expect(plan.doneMs).toBe(COIL.intro.arrival.totalMs);
  });

  it("derives an item's time from the total and the staggers before the last step, held to 250 ms and 2 s", () => {
    expect(arrivalPlan({ ...DEFAULT_ARRIVAL, arrivalTotalMs: 2000, arrivalStaggerMs: 100 }).itemMs).toBe(1500);
    expect(arrivalPlan({ ...DEFAULT_ARRIVAL, arrivalTotalMs: 600, arrivalStaggerMs: 400 }).itemMs).toBe(250);
    expect(arrivalPlan({ ...DEFAULT_ARRIVAL, arrivalTotalMs: 3500, arrivalStaggerMs: 0 }).itemMs).toBe(2000);
  });

  it("writes the page's custom properties and each item's step", () => {
    expect(arrivalVars(DEFAULT_ARRIVAL)).toEqual({ "--arrive-item": "650ms", "--arrive-stagger": "150ms", "--arrive-rise": "14px" });
    expect(arrivalStyle(3)).toEqual({ "--arrive-step": 3 });
    expect(introDomPlan(DEFAULT_INTRO_KNOBS).page.vars["--arrive-item"]).toBe("650ms");
  });

  it("has knobs for the total, the stagger and the distance, and a switch, in the lab's ranges", () => {
    expect(DEFAULT_INTRO_KNOBS.arrivalOn).toBe(true);
    for (const key of ["arrivalTotalMs", "arrivalStaggerMs", "arrivalRisePx"] as const) {
      const { min, max } = INTRO_KNOB_SPEC[key];
      expect(DEFAULT_INTRO_KNOBS[key]).toBeGreaterThanOrEqual(min);
      expect(DEFAULT_INTRO_KNOBS[key]).toBeLessThanOrEqual(max);
    }
    expect(clampIntroKnobs({ arrivalOn: false }).arrivalOn).toBe(false);
    expect(clampIntroKnobs({ arrivalOn: "no" }).arrivalOn).toBe(true);
    expect(clampIntroKnobs({ arrivalTotalMs: 99_999 }).arrivalTotalMs).toBe(INTRO_KNOB_SPEC.arrivalTotalMs.max);
  });
});
