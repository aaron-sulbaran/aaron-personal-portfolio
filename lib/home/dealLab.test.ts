import { describe, expect, it } from "vitest";
import { DEFAULT_KNOBS, KNOB_SPEC } from "@/lib/home/dealKnobs";
import { DEAL_LAB_CHOICES, DEAL_LAB_GROUPS, DEAL_LAB_KNOBS, dealLabCopy, dealLabValues } from "@/lib/home/dealLab";
import { presetPatch } from "@/lib/home/dealPresets";

describe("the deal's lab knobs", () => {
  it("has a slider for every moving part of the table in the spec, each in a group the panel shows", () => {
    for (const key of ["peakCardsPerSecond", "coarsePeakCardsPerSecond", "upMs", "textOutMs", "scrollStartMs", "scrollMs", "flattenStartMs", "flattenMs", "slowStartMs", "slowMs", "pullStartMs", "pullMs", "openStartMs", "openMs", "openReach", "columnsDelayMs", "columnsStaggerMs", "ribbonCardHeightPx", "ribbonCardHeightPhonePx", "ribbonGapPx", "ribbonGapPhonePx", "ribbonSpeedPxPerS", "ribbonFadeWidthPx", "ribbonOffsetYPx", "condenseMs", "curlMs", "condensePower", "ribbonHoverSpeedFactor", "ribbonHoverTighten", "ribbonHoverEaseMs", "wheelPinKneePx", "windRampMs", "wheelLeanDeg", "wheelScale", "wheelOffsetX", "wheelOffsetY"] as const) {
      expect(DEAL_LAB_KNOBS, key).toContain(key);
    }
    for (const key of DEAL_LAB_KNOBS) expect(DEAL_LAB_GROUPS as readonly string[], key).toContain(KNOB_SPEC[key].group);
  });

  it("has a slider for each of the prompt's knobs, in the Prompt group", () => {
    for (const key of ["promptEarlyStartMs", "promptHoldStartMs", "promptAfterStartMs", "promptHoldMs", "promptAloneMs", "promptShrinkMs", "promptSizeVwDesktop", "promptSizeVwPhone", "promptTitleRatio", "promptDimStrength"] as const) {
      expect(DEAL_LAB_KNOBS, key).toContain(key);
      expect(KNOB_SPEC[key].group).toBe("Prompt");
    }
  });

  it("saves and shares its knobs and its two choices", () => {
    expect(Object.keys(dealLabValues(DEFAULT_KNOBS)).sort()).toEqual([...DEAL_LAB_KNOBS, ...DEAL_LAB_CHOICES].sort());
  });

  it("copies the version, the timing mode, the prompt's knobs and the speed preset's name", () => {
    const knobs = { ...DEFAULT_KNOBS, ...presetPatch("faster"), promptVersion: "outline" as const, promptMode: "hold" as const };
    expect(dealLabCopy(knobs)).toMatchObject({ lab: "deal", round: 2, speedPreset: "faster", promptVersion: "outline", promptMode: "hold", promptHoldMs: 1000, upMs: 700, openMs: 950 });
    expect(dealLabCopy({ ...knobs, slowMs: 610 }).speedPreset).toBe("custom");
  });
});
