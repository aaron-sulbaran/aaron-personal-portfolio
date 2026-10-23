import { afterEach, describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { tunedConstants } from "@/lib/coil/entrance";
import { DEFAULT_KNOBS, KNOB_SPEC, clampKnobs, entranceTuningOf, getKnobs, resetKnobs, setKnobs, type NumericKnob } from "@/lib/home/dealKnobs";

describe("the deal's knobs", () => {
  it("default to the constants' deal block", () => {
    expect(DEFAULT_KNOBS.peakCardsPerSecond).toBe(COIL.deal.timeline.peakCardsPerSecond);
    expect(DEFAULT_KNOBS.scrollStartMs).toBe(COIL.deal.timeline.scrollStartMs);
    expect(DEFAULT_KNOBS.flattenMs).toBe(COIL.deal.timeline.flattenMs);
    expect(DEFAULT_KNOBS.pullStartMs).toBe(COIL.deal.timeline.pullStartMs);
    expect(DEFAULT_KNOBS.openStartMs).toBe(COIL.deal.timeline.openStartMs);
    expect(DEFAULT_KNOBS.wheelLeanDeg).toBe(COIL.deal.wheel.leanDeg);
    expect(DEFAULT_KNOBS.wheelScale).toBe(COIL.deal.wheel.scale);
    expect(DEFAULT_KNOBS.openMs).toBe(COIL.deal.open.ms);
    expect(DEFAULT_KNOBS.openReach).toBe(COIL.deal.open.reach);
    expect(DEFAULT_KNOBS.columnsDelayMs).toBe(COIL.deal.columns.delayMs);
  });

  it("keeps every default inside its own range", () => {
    for (const key of Object.keys(KNOB_SPEC) as NumericKnob[]) {
      const { min, max } = KNOB_SPEC[key];
      expect(DEFAULT_KNOBS[key], key).toBeGreaterThanOrEqual(min);
      expect(DEFAULT_KNOBS[key], key).toBeLessThanOrEqual(max);
    }
  });

  it("clamps a value to its range and ignores what is not a knob", () => {
    const clamped = clampKnobs({ openMs: 99_999, scrollMs: -5, flattenMs: 900, notAKnob: 3, riffleMs: 800, glowSize: 1, settleMs: 5 });
    expect(clamped.openMs).toBe(KNOB_SPEC.openMs.max);
    expect(clamped.scrollMs).toBe(KNOB_SPEC.scrollMs.min);
    expect(clamped.flattenMs).toBe(900);
    // Not knobs: unknown keys and the retired deck, riffle, glow and settle ones.
    for (const gone of ["notAKnob", "riffleMs", "glowSize", "settleMs"]) expect(gone in clamped, gone).toBe(false);
  });

  it("falls back to the base for a non-finite number, a string or a wrong type", () => {
    const clamped = clampKnobs({ openMs: Number.NaN, scrollMs: "900", flattenMs: Number.POSITIVE_INFINITY, slowMs: null });
    expect(clamped.openMs).toBe(DEFAULT_KNOBS.openMs);
    expect(clamped.scrollMs).toBe(DEFAULT_KNOBS.scrollMs);
    expect(clamped.flattenMs).toBe(DEFAULT_KNOBS.flattenMs);
    expect(clamped.slowMs).toBe(DEFAULT_KNOBS.slowMs);
  });

  it("hands the entrance its timeline, its ribbon, its wheel and its field", () => {
    const tuning = entranceTuningOf({ ...DEFAULT_KNOBS, peakCardsPerSecond: 9, scrollMs: 1500, wheelLeanDeg: -20, wheelScale: 1.2, openMs: 1200, openReach: 0.8 });
    expect(tuning.timeline).toMatchObject({ peakCardsPerSecond: 9, scrollMs: 1500, pullStartMs: COIL.deal.timeline.pullStartMs });
    expect(tuning.wheel).toMatchObject({ leanDeg: -20, scale: 1.2, offsetX: 0, offsetY: 0 });
    expect(tuning.ribbon).toEqual({ cardHeightPx: COIL.deal.ribbon.cardHeightPx, cardHeightPhonePx: COIL.deal.ribbon.cardHeightPhonePx, gapPx: COIL.deal.ribbon.gapPx, speedPxPerS: COIL.deal.ribbon.speedPxPerS, fadeWidthPx: COIL.deal.ribbon.fadeWidthPx, offsetYPx: COIL.deal.ribbon.offsetYPx });
    expect(tuning.timeline).toMatchObject({ condenseMs: COIL.deal.timeline.condenseMs, curlMs: COIL.deal.timeline.curlMs, nameOutStartMs: COIL.deal.timeline.nameOutStartMs, nameOutMs: COIL.deal.timeline.nameOutMs, windRampMs: COIL.deal.timeline.windRampMs });
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
    setKnobs({ openMs: 99_999, scrollMs: 1500 });
    expect(getKnobs().openMs).toBe(KNOB_SPEC.openMs.max);
    expect(getKnobs().scrollMs).toBe(1500);
    resetKnobs();
    expect(getKnobs()).toBe(DEFAULT_KNOBS);
  });

  it("never writes in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      setKnobs({ scrollMs: 1500 });
      expect(getKnobs()).toBe(DEFAULT_KNOBS);
    } finally {
      env.NODE_ENV = before;
    }
  });
});
