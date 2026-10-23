import { afterEach, describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  CHOICE_SPEC,
  DEFAULT_INTRO_KNOBS,
  INTRO_KNOB_SPEC,
  SHRINK_EASES,
  clampIntroKnobs,
  getIntroKnobs,
  parseStoredIntroKnobs,
  resetIntroKnobs,
  setIntroKnobs,
  type NumericIntroKnob,
} from "@/lib/home/introKnobs";

describe("page 1's knobs", () => {
  it("default to the constants' intro block", () => {
    const I = COIL.intro;
    expect(DEFAULT_INTRO_KNOBS.topLayout).toBe(I.topLayout);
    expect(DEFAULT_INTRO_KNOBS.topLayout).toBe("beside");
    expect(DEFAULT_INTRO_KNOBS.loaderOn).toBe(true);
    expect(DEFAULT_INTRO_KNOBS.loaderMs).toBe(I.loader.fillMs);
    expect(DEFAULT_INTRO_KNOBS.shrinkMs).toBe(I.shrink.ms);
    expect(DEFAULT_INTRO_KNOBS.orangeAmount).toBe(I.orangeAmount);
    expect(DEFAULT_INTRO_KNOBS.phoneBlock2).toBe("about");
    expect(DEFAULT_INTRO_KNOBS.fieldUnderText).toBe("faded");
    expect(DEFAULT_INTRO_KNOBS.bandDesktopPx).toBe(I.band.desktopPx);
  });

  it("keeps every default inside its own range or list", () => {
    for (const key of Object.keys(INTRO_KNOB_SPEC) as NumericIntroKnob[]) {
      const { min, max } = INTRO_KNOB_SPEC[key];
      expect(DEFAULT_INTRO_KNOBS[key], key).toBeGreaterThanOrEqual(min);
      expect(DEFAULT_INTRO_KNOBS[key], key).toBeLessThanOrEqual(max);
    }
    for (const key of Object.keys(CHOICE_SPEC) as (keyof typeof CHOICE_SPEC)[]) {
      expect((CHOICE_SPEC[key].options as readonly (string | number)[]).includes(DEFAULT_INTRO_KNOBS[key]), key).toBe(true);
    }
  });

  it("keeps the loader inside the time Aaron asked for on a fast connection (under about 1.6 s)", () => {
    const total = COIL.intro.loader.fillMs + COIL.intro.loader.holdMs + COIL.intro.shrink.ms;
    expect(total).toBeLessThanOrEqual(1600);
  });

  it("clamps a number to its range and ignores what is not a knob", () => {
    const clamped = clampIntroKnobs({ loaderMs: 99_999, shrinkMs: -5, orangeAmount: 0.25, notAKnob: 3 });
    expect(clamped.loaderMs).toBe(INTRO_KNOB_SPEC.loaderMs.max);
    expect(clamped.shrinkMs).toBe(INTRO_KNOB_SPEC.shrinkMs.min);
    expect(clamped.orangeAmount).toBe(0.25);
    expect("notAKnob" in clamped).toBe(false);
  });

  it("falls back to the base for a non-finite number, a string or a wrong type", () => {
    const clamped = clampIntroKnobs({ loaderMs: Number.NaN, shrinkMs: "900", nameVwDesktop: Number.POSITIVE_INFINITY, loaderOn: "no" });
    expect(clamped.loaderMs).toBe(DEFAULT_INTRO_KNOBS.loaderMs);
    expect(clamped.shrinkMs).toBe(DEFAULT_INTRO_KNOBS.shrinkMs);
    expect(clamped.nameVwDesktop).toBe(DEFAULT_INTRO_KNOBS.nameVwDesktop);
    expect(clamped.loaderOn).toBe(true);
    expect(clampIntroKnobs({ loaderOn: false }).loaderOn).toBe(false);
  });

  it("takes only the listed choices", () => {
    expect(clampIntroKnobs({ topLayout: "above" }).topLayout).toBe("above");
    expect(clampIntroKnobs({ topLayout: "bottom" }).topLayout).toBe("beside");
    expect(clampIntroKnobs({ phoneBlock2: "first" }).phoneBlock2).toBe("first");
    expect(clampIntroKnobs({ phoneBlock2: "wide" }).phoneBlock2).toBe("about");
    expect(clampIntroKnobs({ fieldUnderText: "full" }).fieldUnderText).toBe("full");
    expect(clampIntroKnobs({ fieldUnderText: "half" }).fieldUnderText).toBe("faded");
    expect(clampIntroKnobs({ shrinkEase: "expo.inOut" }).shrinkEase).toBe("expo.inOut");
    expect(clampIntroKnobs({ shrinkEase: "linear" }).shrinkEase).toBe(SHRINK_EASES[0]);
  });

  it("reads a saved record, and shrugs at a broken one", () => {
    expect(parseStoredIntroKnobs('{"topLayout":"above"}')).toEqual({ topLayout: "above" });
    expect(parseStoredIntroKnobs("{not json")).toBeNull();
    expect(parseStoredIntroKnobs(null)).toBeNull();
    expect(parseStoredIntroKnobs("3")).toBeNull();
  });
});

describe("the store", () => {
  afterEach(() => resetIntroKnobs());

  it("applies a patch through the clamp and resets to the defaults", () => {
    setIntroKnobs({ topLayout: "above", shrinkMs: 99_999 });
    expect(getIntroKnobs().topLayout).toBe("above");
    expect(getIntroKnobs().shrinkMs).toBe(INTRO_KNOB_SPEC.shrinkMs.max);
    resetIntroKnobs();
    expect(getIntroKnobs()).toEqual(DEFAULT_INTRO_KNOBS);
  });
});
