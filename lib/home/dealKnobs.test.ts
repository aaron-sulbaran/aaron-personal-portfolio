import { afterEach, describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { tunedConstants } from "@/lib/coil/entrance";
import { DEAL_CHOICE_SPEC, DEFAULT_KNOBS, KNOB_SPEC, PROMPT_MODES, PROMPT_TITLE_PLACES, PROMPT_VERSIONS, clampKnobs, modeForVersion, entranceTuningOf, getKnobs, resetKnobs, setKnobs, type NumericKnob } from "@/lib/home/dealKnobs";

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
    const clamped = clampKnobs({ openMs: 99_999, scrollMs: -5, flattenMs: 900, notAKnob: 3, riffleMs: 800, glowSize: 1, settleMs: 5, clickRingMs: 700, clickRingStrength: 0.8 });
    expect(clamped.openMs).toBe(KNOB_SPEC.openMs.max);
    expect(clamped.scrollMs).toBe(KNOB_SPEC.scrollMs.min);
    expect(clamped.flattenMs).toBe(900);
    // Not knobs: unknown keys and the retired deck, riffle, glow, settle and click ring ones (a saved lab record may still hold them).
    for (const gone of ["notAKnob", "riffleMs", "glowSize", "settleMs", "clickRingMs", "clickRingStrength"]) expect(gone in clamped, gone).toBe(false);
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
    expect(tuning.wheel).toMatchObject({ leanDeg: -20, scale: 1.2, offsetX: 0, offsetY: 0, pinKneePx: COIL.deal.wheel.pinKneePx });
    expect(tuning.ribbon).toEqual({ cardHeightPx: COIL.deal.ribbon.cardHeightPx, cardHeightPhonePx: COIL.deal.ribbon.cardHeightPhonePx, gapPx: COIL.deal.ribbon.gapPx, gapPhonePx: COIL.deal.ribbon.gapPhonePx, speedPxPerS: COIL.deal.ribbon.speedPxPerS, fadeWidthPx: COIL.deal.ribbon.fadeWidthPx, offsetYPx: COIL.deal.ribbon.offsetYPx, hoverSpeedFactor: COIL.deal.ribbon.hoverSpeedFactor, hoverTighten: COIL.deal.ribbon.hoverTighten, hoverEaseMs: COIL.deal.ribbon.hoverEaseMs, gatherPitch: COIL.deal.ribbon.gatherPitch });
    expect(tuning.timeline).toMatchObject({ condenseMs: COIL.deal.timeline.condenseMs, curlMs: COIL.deal.timeline.curlMs, condensePower: COIL.deal.timeline.condensePower, windRampMs: COIL.deal.timeline.windRampMs });
    expect(tuning.open).toEqual({ ms: 1200, reach: 0.8 });
    // The click's press is DOM, not the scene's: the button presses to 0.97. Its pile is the ribbon's gather pitch.
    expect(COIL.deal.click).toEqual({ pressScale: 0.97 });
    expect(DEFAULT_KNOBS.ribbonGatherPitch).toBe(COIL.deal.ribbon.gatherPitch);
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

describe("the prompt's knobs", () => {
  it("default to the constants: plate, Early, a 1,000 ms hold that never goes under 900 ms, a 480 ms shrink", () => {
    expect(DEFAULT_KNOBS).toMatchObject({ promptVersion: "plate", promptMode: "early", promptEarlyStartMs: 0, promptHoldStartMs: 0, promptAfterStartMs: 0, promptHoldMs: 1000, promptShrinkMs: 480, promptSizeVwDesktop: 4, promptSizeVwPhone: 7 });
    expect(COIL.deal.prompt.minHoldMs).toBe(900);
    expect(KNOB_SPEC.promptHoldMs.min).toBe(COIL.deal.prompt.minHoldMs);
  });
  it("keeps a version or a timing mode only from its list, and the hold at its floor", () => {
    expect(clampKnobs({ promptVersion: "outline", promptMode: "hold" })).toMatchObject({ promptVersion: "outline", promptMode: "hold" });
    expect(clampKnobs({ promptVersion: "spotlight" }).promptVersion).toBe("spotlight");
    expect(clampKnobs({ promptVersion: "neon", promptMode: 2 })).toMatchObject({ promptVersion: "plate", promptMode: "early" });
    expect(clampKnobs({ promptHoldMs: 100 }).promptHoldMs).toBe(900);
  });
  it("gives G's line first its own time alone: 600 ms by default, from 300 to 1,500", () => {
    expect(DEFAULT_KNOBS.promptAloneMs).toBe(600);
    expect(DEFAULT_KNOBS.promptAloneMs).toBe(COIL.deal.prompt.title.aloneMs);
    expect(clampKnobs({ promptAloneMs: 50 }).promptAloneMs).toBe(300);
    expect(clampKnobs({ promptAloneMs: 9000 }).promptAloneMs).toBe(1500);
  });
  it("offers the lab's seven versions and three modes", () => {
    expect(PROMPT_VERSIONS).toEqual(["plate", "calm", "outline", "spotlight", "quiet", "lit", "title"]);
    expect(DEAL_CHOICE_SPEC.promptVersion.names.title).toBe("G, lit title");
    expect(modeForVersion("title", "early")).toBe("hold");
    expect(DEAL_CHOICE_SPEC.promptVersion.names.spotlight).toBe("D, spotlight");
    expect(DEAL_CHOICE_SPEC.promptVersion.names.quiet).toBe("E, quieter");
    expect(DEAL_CHOICE_SPEC.promptVersion.names.lit).toBe("F, lit cards");
    expect(PROMPT_MODES).toEqual(["early", "hold", "after"]);
    expect(Object.keys(DEAL_CHOICE_SPEC)).toEqual(["promptVersion", "promptMode", "promptTitlePlace"]);
  });
  it("puts G in the column by default, and keeps a place only from its list", () => {
    expect(PROMPT_TITLE_PLACES).toEqual(["row", "bare", "column"]);
    expect(DEFAULT_KNOBS.promptTitlePlace).toBe("column");
    expect(DEAL_CHOICE_SPEC.promptTitlePlace.names).toEqual({ row: "Top, on a plate", bare: "Top, words only", column: "In the column" });
    expect(clampKnobs({ promptTitlePlace: "column" }).promptTitlePlace).toBe("column");
    expect(clampKnobs({ promptTitlePlace: "row" }).promptTitlePlace).toBe("row");
    expect(clampKnobs({ promptTitlePlace: "corner" }).promptTitlePlace).toBe("column");
  });
});

describe("the timing a version can use", () => {
  it("gives F's Early as Hold too, and leaves E's as chosen", () => {
    expect(modeForVersion("lit", "early")).toBe("hold");
    expect(modeForVersion("lit", "after")).toBe("after");
    expect(modeForVersion("quiet", "early")).toBe("early");
  });
  it("gives F and G a full dim by default, held between none and full", () => {
    expect(DEFAULT_KNOBS.promptDimStrength).toBe(1);
    expect(clampKnobs({ promptDimStrength: 3 }).promptDimStrength).toBe(1);
    expect(clampKnobs({ promptDimStrength: -1 }).promptDimStrength).toBe(0);
  });
  it("starts E and F at 1.5 page titles by default, held to its range", () => {
    expect(DEFAULT_KNOBS.promptTitleRatio).toBe(1.5);
    expect(clampKnobs({ promptTitleRatio: 9 }).promptTitleRatio).toBe(3);
    expect(clampKnobs({ promptTitleRatio: 0.1 }).promptTitleRatio).toBe(0.8);
  });
  it("gives D's Early as Hold and leaves everything else as chosen", () => {
    expect(modeForVersion("spotlight", "early")).toBe("hold");
    expect(modeForVersion("spotlight", "hold")).toBe("hold");
    expect(modeForVersion("spotlight", "after")).toBe("after");
    for (const version of ["plate", "calm", "outline"] as const) expect(modeForVersion(version, "early")).toBe("early");
  });
});
