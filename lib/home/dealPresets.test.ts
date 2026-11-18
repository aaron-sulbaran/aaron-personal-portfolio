import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { dealMs } from "@/lib/coil/dealSpeed";
import { tunedConstants } from "@/lib/coil/entrance";
import { promptPlan } from "@/lib/home/clickPrompt";
import { DEFAULT_KNOBS, entranceTuningOf, KNOB_SPEC, type NumericKnob } from "@/lib/home/dealKnobs";
import { presetOf, presetPatch, SPEED_PRESETS, type SpeedPreset } from "@/lib/home/dealPresets";

const knobsOf = (p: SpeedPreset) => ({ ...DEFAULT_KNOBS, ...presetPatch(p) });
const tuned = (p: SpeedPreset) => tunedConstants(entranceTuningOf(knobsOf(p)));

describe("the deal's speed presets", () => {
  it("today is the defaults, and the constants are untouched (open.ms stays 1,050)", () => {
    for (const [key, value] of Object.entries(presetPatch("today"))) expect(value, key).toBe(DEFAULT_KNOBS[key as NumericKnob]);
    expect(COIL.deal.open.ms).toBe(1050);
  });
  it("names only deal knobs inside their ranges, and never the condense, the curl, the peak speeds or the prompt", () => {
    for (const p of ["faster", "fastest"] as const) for (const [key, value] of Object.entries(COIL.deal.speedPresets[p])) {
      const spec = KNOB_SPEC[key as NumericKnob];
      expect(spec, key).toBeDefined(); expect(value).toBeGreaterThanOrEqual(spec.min); expect(value).toBeLessThanOrEqual(spec.max);
      expect(key).not.toMatch(/^(condense|curl|peak|coarsePeak|prompt)/);
    }
  });
  it("only shortens", () => {
    for (const p of ["faster", "fastest"] as const) for (const [key, value] of Object.entries(COIL.deal.speedPresets[p])) expect(value, key).toBeLessThanOrEqual(DEFAULT_KNOBS[key as NumericKnob]);
  });
  it("lands the Coil 2,640, 2,340 and 2,090 ms after the click", () => {
    expect(SPEED_PRESETS.map((p) => dealMs(tuned(p)))).toEqual([2640, 2340, 2090]);
  });
  it("keeps the table's joins", () => {
    for (const p of SPEED_PRESETS) {
      const t = tuned(p).deal.timeline; const open = tuned(p).deal.open.ms;
      expect(t.openStartMs + open, p).toBeLessThanOrEqual(t.pullStartMs + t.pullMs);
      expect(t.flattenStartMs + t.flattenMs - t.pullStartMs, p).toBeLessThanOrEqual(150);
      expect(t.flattenStartMs + t.flattenMs, p).toBeGreaterThanOrEqual(t.pullStartMs);
      expect(t.pullStartMs + t.pullMs - (t.slowStartMs + t.slowMs), p).toBeGreaterThanOrEqual(250);
      expect(t.slowStartMs - t.upMs, p).toBeGreaterThanOrEqual(150);
      expect(Math.abs(t.windRampMs - 0.62 * t.pullMs), p).toBeLessThanOrEqual(5);
    }
  });
  it("names each preset, and calls anything else custom", () => {
    for (const p of SPEED_PRESETS) expect(presetOf(knobsOf(p))).toBe(p);
    expect(presetOf({ ...knobsOf("faster"), slowMs: 610 })).toBe("custom");
    expect(presetOf({ ...DEFAULT_KNOBS, ribbonGapPx: 40 })).toBe("today");
  });
  it("Hold fits under the 3,800 ms cap only at the fastest preset; elsewhere the cap lets go first, by 520 and 220 ms", () => {
    const ends = SPEED_PRESETS.map((p) => promptPlan({ ...knobsOf(p), promptMode: "hold" }).endMs);
    expect(ends).toEqual([4320, 4020, 3770]);
  });
});
