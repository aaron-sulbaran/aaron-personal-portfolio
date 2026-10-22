import { afterEach, describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { tunedConstants } from "@/lib/coil/entrance";
import { DEFAULT_KNOBS, KNOB_SPEC, clampKnobs, entranceTuningOf, getKnobs, resetKnobs, setKnobs, type NumericKnob } from "@/lib/home/dealKnobs";

describe("the deal's knobs", () => {
  it("default to the constants' deal block", () => {
    expect(DEFAULT_KNOBS.riffleOn).toBe(COIL.deal.riffle.on);
    expect(DEFAULT_KNOBS.riffleMs).toBe(COIL.deal.riffle.ms);
    expect(DEFAULT_KNOBS.peakCardsPerSecond).toBe(COIL.deal.timeline.peakCardsPerSecond);
    expect(DEFAULT_KNOBS.scrollStartMs).toBe(COIL.deal.timeline.scrollStartMs);
    expect(DEFAULT_KNOBS.flattenMs).toBe(COIL.deal.timeline.flattenMs);
    expect(DEFAULT_KNOBS.pullStartMs).toBe(COIL.deal.timeline.pullStartMs);
    expect(DEFAULT_KNOBS.openStartMs).toBe(COIL.deal.timeline.openStartMs);
    expect(DEFAULT_KNOBS.wheelLeanDeg).toBe(COIL.deal.wheel.leanDeg);
    expect(DEFAULT_KNOBS.wheelScale).toBe(COIL.deal.wheel.scale);
    expect(DEFAULT_KNOBS.settleScale).toBe(COIL.deal.settle.startScale);
    expect(DEFAULT_KNOBS.openMs).toBe(COIL.deal.open.ms);
    expect(DEFAULT_KNOBS.openReach).toBe(COIL.deal.open.reach);
    expect(DEFAULT_KNOBS.columnsDelayMs).toBe(COIL.deal.columns.delayMs);
    expect(DEFAULT_KNOBS.fanDeg).toBe(COIL.deal.deck.fanDeg);
  });

  it("keeps every default inside its own range", () => {
    for (const key of Object.keys(KNOB_SPEC) as NumericKnob[]) {
      const { min, max } = KNOB_SPEC[key];
      expect(DEFAULT_KNOBS[key], key).toBeGreaterThanOrEqual(min);
      expect(DEFAULT_KNOBS[key], key).toBeLessThanOrEqual(max);
    }
    expect(DEFAULT_KNOBS.riffleMs).toBeLessThan(1000);
  });

  it("clamps a value to its range and ignores what is not a knob", () => {
    const clamped = clampKnobs({ riffleMs: 99_999, scrollMs: -5, fanDeg: 7.5, notAKnob: 3 });
    expect(clamped.riffleMs).toBe(KNOB_SPEC.riffleMs.max);
    expect(clamped.scrollMs).toBe(KNOB_SPEC.scrollMs.min);
    expect(clamped.fanDeg).toBe(7.5);
    expect("notAKnob" in clamped).toBe(false);
  });

  it("falls back to the base for a non-finite number, a string or a wrong type", () => {
    const clamped = clampKnobs({ riffleMs: Number.NaN, scrollMs: "900", glowSize: Number.POSITIVE_INFINITY, riffleOn: "yes" });
    expect(clamped.riffleMs).toBe(DEFAULT_KNOBS.riffleMs);
    expect(clamped.scrollMs).toBe(DEFAULT_KNOBS.scrollMs);
    expect(clamped.glowSize).toBe(DEFAULT_KNOBS.glowSize);
    expect(clamped.riffleOn).toBe(DEFAULT_KNOBS.riffleOn);
    expect(clampKnobs({ riffleOn: false }).riffleOn).toBe(false);
  });

  it("hands the entrance its timeline, its wheel and its field", () => {
    const tuning = entranceTuningOf({ ...DEFAULT_KNOBS, peakCardsPerSecond: 9, scrollMs: 1500, wheelLeanDeg: -20, wheelScale: 1.2, openMs: 1200, openReach: 0.8 });
    expect(tuning.timeline).toMatchObject({ peakCardsPerSecond: 9, scrollMs: 1500, pullStartMs: COIL.deal.timeline.pullStartMs });
    expect(tuning.wheel).toMatchObject({ leanDeg: -20, scale: 1.2, offsetX: 0, offsetY: 0, idleCardsPerSecond: 0.5 });
    expect(tuning.open).toEqual({ ms: 1200, reach: 0.8 });
    // The defaults are COIL itself, so an untouched lab changes nothing.
    expect(tunedConstants(entranceTuningOf(DEFAULT_KNOBS))).toBe(COIL);
    const c = tunedConstants(tuning);
    expect(c.deal.timeline.peakCardsPerSecond).toBe(9);
    expect(c.deal.wheel.leanDeg).toBe(-20);
    expect(c.deal.open.ms).toBe(1200);
  });
});

describe("the knobs' store", () => {
  afterEach(() => resetKnobs());

  it("applies a patch through the clamp and resets to the defaults", () => {
    setKnobs({ riffleMs: 5000, riffleOn: false });
    expect(getKnobs().riffleMs).toBe(KNOB_SPEC.riffleMs.max);
    expect(getKnobs().riffleOn).toBe(false);
    resetKnobs();
    expect(getKnobs()).toBe(DEFAULT_KNOBS);
  });

  it("never writes in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      setKnobs({ riffleMs: 400 });
      expect(getKnobs()).toBe(DEFAULT_KNOBS);
    } finally {
      env.NODE_ENV = before;
    }
  });
});
