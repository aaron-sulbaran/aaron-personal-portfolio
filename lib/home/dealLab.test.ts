import { describe, expect, it } from "vitest";
import { DEFAULT_KNOBS, KNOB_SPEC } from "@/lib/home/dealKnobs";
import { DEAL_LAB_GROUPS, DEAL_LAB_KNOBS, dealLabValues } from "@/lib/home/dealLab";

describe("the deal's lab knobs", () => {
  it("has a slider for every moving part of the table in the spec, each in a group the panel shows", () => {
    for (const key of ["peakCardsPerSecond", "coarsePeakCardsPerSecond", "upMs", "textOutMs", "scrollStartMs", "scrollMs", "flattenStartMs", "flattenMs", "slowStartMs", "slowMs", "pullStartMs", "pullMs", "openStartMs", "openMs", "openReach", "columnsDelayMs", "columnsStaggerMs", "ribbonCardHeightPx", "ribbonCardHeightPhonePx", "ribbonGapPx", "ribbonSpeedPxPerS", "ribbonFadeWidthPx", "ribbonOffsetYPx", "condenseMs", "curlMs", "nameOutStartMs", "nameOutMs", "windRampMs", "wheelLeanDeg", "wheelScale", "wheelOffsetX", "wheelOffsetY"] as const) {
      expect(DEAL_LAB_KNOBS, key).toContain(key);
    }
    for (const key of DEAL_LAB_KNOBS) expect(DEAL_LAB_GROUPS as readonly string[], key).toContain(KNOB_SPEC[key].group);
  });

  it("saves and shares exactly its knobs, at their current values", () => {
    const values = dealLabValues(DEFAULT_KNOBS);
    expect(Object.keys(values).sort()).toEqual([...DEAL_LAB_KNOBS].sort());
    expect(values.peakCardsPerSecond).toBe(DEFAULT_KNOBS.peakCardsPerSecond);
  });
});
