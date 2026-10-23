import { describe, expect, it } from "vitest";
import { COMPOSITE_FRAG } from "@/lib/coil/field.glsl";
import { NAME_ONLY_FRAG } from "@/lib/coil/nameCanvas.glsl";

// The name canvas draws the scene composite's letters and nothing else.
describe("the name canvas's fragment", () => {
  it("interpolates every tuned value (no template left behind)", () => {
    expect(NAME_ONLY_FRAG).not.toContain("${");
    expect(NAME_ONLY_FRAG).not.toContain("undefined");
    expect(NAME_ONLY_FRAG).not.toContain("NaN");
  });

  it("shares the composite's name block, so the letters are the same letters", () => {
    for (const piece of ["vec3 nameLetters(vec3 field, vec2 g, float greeting)", "uGlyphRel", "uGreetCap", "wakeAt", "uSurfIn"]) {
      expect(NAME_ONLY_FRAG).toContain(piece);
      expect(COMPOSITE_FRAG).toContain(piece);
    }
    const mix = (source: string) => source.match(/letters = mix\(letters, nameLetters\(field, g, greeting\), uSurfIn\);/)?.[0];
    expect(mix(NAME_ONLY_FRAG)).toBe(mix(COMPOSITE_FRAG));
  });

  it("draws nothing outside the letters: clear, premultiplied by their coverage, no field or paper", () => {
    expect(NAME_ONLY_FRAG).toContain("gl_FragColor = vec4(0.0)");
    expect(NAME_ONLY_FRAG).toContain("vec4(letters * m, m)");
    for (const gone of ["uPaper", "uSeam", "uOpen", "uTopFade", "uHush"]) expect(NAME_ONLY_FRAG).not.toContain(gone);
  });
});
