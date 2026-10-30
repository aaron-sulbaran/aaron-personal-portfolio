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
    // The surface grown in is the composite's letters, unchanged.
    expect(NAME_ONLY_FRAG).toContain("vec3 letters = nameLetters(field, g, greeting);");
    expect(COMPOSITE_FRAG).toContain("nameLetters(field, g, greeting), uSurfIn);");
  });

  it("draws nothing outside the letters: clear, premultiplied by their coverage, no field or paper", () => {
    expect(NAME_ONLY_FRAG).toContain("gl_FragColor = vec4(0.0)");
    expect(NAME_ONLY_FRAG).toContain("vec4(letters * m, m)");
    for (const gone of ["uPaper", "uSeam", "uOpen", "uTopFade", "uHush"]) expect(NAME_ONLY_FRAG).not.toContain(gone);
  });

  it("starts as the page's own text: one flat ink over the page at the solid's opacity, the greeting whole, no field and no grain", () => {
    // The loader lands "Aaron" in the gradient's middle at the ink's opacity and "hi, i'm" in its top colour (lib/home/loaderLanding.ts).
    expect(NAME_ONLY_FRAG).toContain("float k = mix(clamp(uSolidK, 0.0, 1.0), 1.0, greeting);");
    expect(NAME_ONLY_FRAG).toContain("vec3 solid = mix(mix(uGradTop, uGradBottom, 0.5), uGradTop, greeting);");
    expect(NAME_ONLY_FRAG).toContain("vec4 was = vec4(solid, 1.0) * k * m;");
    expect(NAME_ONLY_FRAG).toContain("if (uSurfIn <= 0.0) { gl_FragColor = was; return; }");
    expect(NAME_ONLY_FRAG).toContain("gl_FragColor = mix(was, vec4(letters * m, m), uSurfIn);");
    for (const gone of ["uGrain;", "uGrain,", "h12("]) expect(NAME_ONLY_FRAG).not.toContain(gone);
  });
});
