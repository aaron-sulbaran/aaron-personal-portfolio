import { describe, expect, it } from "vitest";
import { COMPOSITE_FRAG, NAME, NAME_DISTURB, NAME_SURFACE, SURFACE_FRAG, nameComposite, nameDisturb } from "@/lib/coil/field.glsl";

// The name's surface and composite, as the design review ruled them
// (2026-09-30): the Tide lab's color law on a fragment-only surface, its wake
// as a bounded domain offset, the rejected fills gone.

describe("the name's shaders", () => {
  it("interpolate every tuned value (no template left behind)", () => {
    for (const source of [SURFACE_FRAG, COMPOSITE_FRAG]) {
      expect(source).not.toContain("${");
      expect(source).not.toContain("undefined");
      expect(source).not.toContain("NaN");
    }
  });

  it("carry none of the seven rejected fills, the repel or the warm crest", () => {
    for (const gone of ["uMode", "uFillMix", "uFlowDir", "uNameT", "uRepel", "repelAt", "uWarm"]) {
      expect(COMPOSITE_FRAG).not.toContain(gone);
      expect(SURFACE_FRAG).not.toContain(gone);
    }
  });

  it("drag the surface by a domain offset capped at 0.6 plane units, not per vertex", () => {
    expect(NAME_DISTURB.drag).toBe(2);
    expect(NAME_DISTURB.churn).toBe(0.25);
    expect(NAME_DISTURB.maxDrag).toBe(0.6);
    expect(SURFACE_FRAG).toContain("uMaxDrag");
    expect(SURFACE_FRAG).not.toContain("gl_Position");
  });

  it("never draw the letters pure black or pure white, even at full ink (the unwound list's lead)", () => {
    expect(NAME.lightness[0]).toBeGreaterThan(0.15);
    expect(NAME.lightness[1]).toBeLessThan(0.97);
    expect(COMPOSITE_FRAG).toContain(`clamp(L, ${NAME.lightness[0].toFixed(4)}, ${NAME.lightness[1].toFixed(4)})`);
  });

  it("render the surface at half the name's device resolution", () => {
    expect(NAME_SURFACE.rtScale).toBe(0.5);
  });

  it("set the greeting at 0.18 of the name's cap height", () => {
    expect(NAME.greetingCap).toBe(0.18);
  });
});

describe("nameComposite", () => {
  it("light: floor 0.08, the greeting's 1.8 times that, the lab's reveal and detail", () => {
    const light = nameComposite(false);
    expect(light.floor).toBe(0.08);
    expect(light.floorSign).toBe(1);
    expect(light.reveal).toBe(1.8);
    expect(light.detail).toBe(1);
    expect(light.greetFloor).toBe(1.8);
    expect(light.greetCap).toBe(0);
  });

  it("dark: the greeting's floor comes down and its mean is held at or just under the name's", () => {
    const dark = nameComposite(true);
    expect(dark.greetFloor).toBeLessThan(nameComposite(false).greetFloor);
    // Against the field under it the greeting reads a little stronger than
    // against the field around it (the review's ring), so the cap sits just
    // over 1 to land the greeting at or just under the name.
    expect(dark.greetCap).toBeGreaterThanOrEqual(1);
    expect(dark.greetCap).toBeLessThanOrEqual(1.1);
    expect(COMPOSITE_FRAG).toContain("uGreetCap");
  });

  it("dark: the touched cloth rises toward the pale crest (it is pressed back in light)", () => {
    expect(nameDisturb(false).press).toBeGreaterThan(0);
    expect(nameDisturb(true).press).toBeLessThan(0);
    expect(nameDisturb(true).lift).toBeGreaterThan(nameDisturb(false).lift);
  });

  it("dark: letters lighter than the field, detail 1.3 and reveal 2.2", () => {
    const dark = nameComposite(true);
    expect(dark.floorSign).toBe(-1);
    expect(dark.detail).toBe(1.3);
    expect(dark.reveal).toBe(2.2);
  });

  it("hold every letter to at least 0.72 of the strongest letter's glyph-scale contrast, in both themes", () => {
    expect(nameComposite(false).glyphRel).toBe(0.72);
    expect(nameComposite(true).glyphRel).toBe(0.72);
    expect(COMPOSITE_FRAG).toContain("uGlyphRel");
    expect(NAME.maxGlyphs).toBeGreaterThanOrEqual(5);
  });

  it("dark: a glyph-scale floor lifts the letters to about +0.14 over the night field", () => {
    expect(nameComposite(true).glyphAbs).toBeGreaterThan(0.1);
    expect(nameComposite(false).glyphAbs).toBe(0);
  });

  it("grain lighter on dark, where the same amplitude reads louder", () => {
    expect(nameComposite(true).grain).toBeLessThan(nameComposite(false).grain);
  });
});
