import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { nameCompositeInk, parseDebugFlags } from "@/lib/coil/debugFlags";
import { nameComposite } from "@/lib/coil/field.glsl";
import { NAME_INK_MODES, nameInkGain } from "@/lib/coil/nameInk";
import { DEFAULT_INTRO_KNOBS, clampIntroKnobs } from "@/lib/home/introKnobs";

describe("the name's ink", () => {
  it("offers production's pale name and the stronger one, and defaults to the stronger", () => {
    expect(NAME_INK_MODES).toEqual(["production", "stronger"]);
    expect(DEFAULT_INTRO_KNOBS.nameInk).toBe("stronger");
    expect(clampIntroKnobs({ nameInk: "production" }).nameInk).toBe("production");
    expect(clampIntroKnobs({ nameInk: "loud" }).nameInk).toBe("stronger");
  });

  it("keeps production's name exactly as it was", () => {
    expect(nameInkGain("production")).toBe(COIL.lockup.inkGain);
    expect(nameComposite(false)).toEqual(nameComposite(false, false));
    expect(nameComposite(false).floor).toBe(0.08);
    expect(nameComposite(true).floor).toBe(0.04);
  });

  it("raises the gain and the floors for the stronger name, and holds the greeting to the name's", () => {
    expect(nameInkGain("stronger")).toBeGreaterThan(COIL.lockup.inkGain);
    for (const dark of [false, true]) {
      const strong = nameComposite(dark, true);
      const base = nameComposite(dark, false);
      expect(strong.floor).toBeGreaterThan(base.floor);
      expect(strong.floorSign).toBe(base.floorSign);
      expect(strong.floor * strong.greetFloor).toBeLessThanOrEqual(strong.floor * 1.0001);
    }
  });

  it("carries the gain into the composite's ink, clamped to 1, and leaves the still's strong ink alone", () => {
    const flags = parseDebugFlags("");
    expect(nameCompositeInk(flags, 0.12)).toBeCloseTo(0.12 * COIL.lockup.inkGain, 10);
    expect(nameCompositeInk(flags, 0.12, nameInkGain("stronger"))).toBeCloseTo(0.12 * COIL.lockup.stronger.inkGain, 10);
    expect(nameCompositeInk(flags, 0.5, 5)).toBe(1);
    expect(nameCompositeInk(parseDebugFlags("?coildebug=still"), 0.12, 5)).toBe(COIL.lockup.stillInk);
  });
});
