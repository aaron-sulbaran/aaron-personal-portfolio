import { describe, expect, it } from "vitest";
import { DEFAULT_KNOBS, KNOB_SPEC } from "@/lib/home/dealKnobs";
import * as lab from "@/lib/home/dealLab";
import { DEAL_LAB_GROUPS, DEAL_LAB_KNOBS, dealLabValues } from "@/lib/home/dealLab";

describe("the deal's lab knobs", () => {
  it("has a slider for every moving part of the table in the spec, each in a group the panel shows", () => {
    for (const key of ["peakCardsPerSecond", "coarsePeakCardsPerSecond", "upMs", "textOutMs", "scrollStartMs", "scrollMs", "flattenStartMs", "flattenMs", "slowStartMs", "slowMs", "pullStartMs", "pullMs", "openStartMs", "openMs", "openReach", "columnsDelayMs", "columnsStaggerMs", "ribbonCardHeightPx", "ribbonCardHeightPhonePx", "ribbonGapPx", "ribbonGapPhonePx", "ribbonSpeedPxPerS", "ribbonFadeWidthPx", "ribbonOffsetYPx", "condenseMs", "curlMs", "condensePower", "ribbonHoverSpeedFactor", "ribbonHoverTighten", "ribbonHoverEaseMs", "wheelPinKneePx", "windRampMs", "wheelLeanDeg", "wheelScale", "wheelOffsetX", "wheelOffsetY"] as const) {
      expect(DEAL_LAB_KNOBS, key).toContain(key);
    }
    for (const key of DEAL_LAB_KNOBS) expect(DEAL_LAB_GROUPS as readonly string[], key).toContain(KNOB_SPEC[key].group);
  });

  it("has the click prompt's four sliders and nothing else of it, in the Prompt group", () => {
    expect(DEAL_LAB_KNOBS.filter((key) => key.startsWith("prompt"))).toEqual(["promptAloneMs", "promptShrinkMs", "promptTitleRatio", "promptDimStrength"]);
    expect(Object.keys(KNOB_SPEC).filter((key) => key.startsWith("prompt")).sort()).toEqual(DEAL_LAB_KNOBS.filter((key) => key.startsWith("prompt")).sort());
    expect(DEAL_LAB_GROUPS.at(-1)).toBe("Prompt");
    expect((["promptAloneMs", "promptShrinkMs", "promptTitleRatio", "promptDimStrength"] as const).map((key) => [KNOB_SPEC[key].group, KNOB_SPEC[key].label])).toEqual([
      ["Prompt", "The line alone"],
      ["Prompt", "Shrink into the spot"],
      ["Prompt", "Start size"],
      ["Prompt", "Dim strength"],
    ]);
  });

  it("has no switches left: the lab's versions, timings, places and speed presets are gone", () => {
    expect(Object.keys(lab).filter((name) => /CHOICE|PRESET|Copy/i.test(name))).toEqual([]);
  });

  it("saves and shares exactly its knobs, at their current values", () => {
    const values = dealLabValues(DEFAULT_KNOBS);
    expect(Object.keys(values).sort()).toEqual([...DEAL_LAB_KNOBS].sort());
    expect(values.peakCardsPerSecond).toBe(DEFAULT_KNOBS.peakCardsPerSecond);
    expect(values.promptAloneMs).toBe(600);
  });
});
