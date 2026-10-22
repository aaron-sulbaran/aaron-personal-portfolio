import { afterEach, describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { DEFAULT_KNOBS, KNOB_SPEC, clampKnobs, entranceTuningOf, getKnobs, resetKnobs, setKnobs, type NumericKnob } from "@/lib/home/dealKnobs";

describe("the deal's knobs", () => {
  it("default to the constants' deal block", () => {
    expect(DEFAULT_KNOBS.riffleOn).toBe(COIL.deal.riffle.on);
    expect(DEFAULT_KNOBS.riffleMs).toBe(COIL.deal.riffle.ms);
    expect(DEFAULT_KNOBS.dealMs).toBe(COIL.entrance.durationMs);
    expect(DEFAULT_KNOBS.dealStagger).toBe(COIL.entrance.shutterStagger);
    expect(DEFAULT_KNOBS.startOffset).toBe(COIL.entrance.startOffset);
    expect(DEFAULT_KNOBS.settleScale).toBe(COIL.deal.settle.startScale);
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
    const clamped = clampKnobs({ riffleMs: 99_999, dealMs: -5, fanDeg: 7.5, notAKnob: 3 });
    expect(clamped.riffleMs).toBe(KNOB_SPEC.riffleMs.max);
    expect(clamped.dealMs).toBe(KNOB_SPEC.dealMs.min);
    expect(clamped.fanDeg).toBe(7.5);
    expect("notAKnob" in clamped).toBe(false);
  });

  it("falls back to the base for a non-finite number, a string or a wrong type", () => {
    const clamped = clampKnobs({ riffleMs: Number.NaN, dealMs: "900", glowSize: Number.POSITIVE_INFINITY, riffleOn: "yes" });
    expect(clamped.riffleMs).toBe(DEFAULT_KNOBS.riffleMs);
    expect(clamped.dealMs).toBe(DEFAULT_KNOBS.dealMs);
    expect(clamped.glowSize).toBe(DEFAULT_KNOBS.glowSize);
    expect(clamped.riffleOn).toBe(DEFAULT_KNOBS.riffleOn);
    expect(clampKnobs({ riffleOn: false }).riffleOn).toBe(false);
  });

  it("hands the entrance its three values", () => {
    expect(entranceTuningOf({ ...DEFAULT_KNOBS, dealMs: 1200, dealStagger: 0.02, startOffset: 0.5 })).toEqual({
      durationMs: 1200,
      shutterStagger: 0.02,
      startOffset: 0.5,
    });
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
