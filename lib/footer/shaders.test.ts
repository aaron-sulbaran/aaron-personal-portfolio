import { describe, expect, it } from "vitest";
import { COMPOSITE_FRAG, FIELD_FRAG, NAME_SURFACE, SURFACE_FRAG } from "@/lib/coil/field.glsl";
import { FOOTER } from "./constants";
import { MAX_RIPPLES } from "./egg";
import {
  UNIFORMS,
  adaptCompositeFrag,
  adaptFieldFrag,
  adaptSurfaceFrag,
  compositeSource,
  fieldSource,
  surfaceClock,
  surfaceExtent,
  surfaceSource,
  surfaceTargetSize,
} from "./shaders";

// The pin on the hero's shaders: the footer shares them by import, so a
// change to their shape must fail here, never drift. Ported from the footer
// lab's field.test.ts and round4.test.ts, plus the uniform check.

const declared = (source: string, name: string) => new RegExp(`uniform\\s+\\w+\\s+[^;]*\\b${name.replace("[0]", "")}\\b`).test(source);

describe("the field, ported", () => {
  it("moves the hero's field to GLSL ES 3.00 with the intensity, the frame and the ripple", () => {
    const src = fieldSource();
    expect(src.startsWith("#version 300 es\n")).toBe(true);
    expect(src).not.toMatch(/\bvarying\b|gl_FragColor/);
    expect(src).toContain("in vec2 vUv0;");
    expect(src).toContain("void fieldMain()");
    expect(src.match(/void main\(\)/g)).toHaveLength(1);
    expect(src).toContain("vUv = rippled(vUv0) * uFrame.xy + uFrame.zw;");
    expect(src).toContain("uPaper + (col - uPaper) * uIntensity");
    expect(src).toContain("uniform float uT, uTw, uWarp, uAspect, uAmt, uSec;");
    expect(src).toContain(`uniform vec4 uRip[${MAX_RIPPLES}];`);
    // The hero's weather, every line of it: its noise, and its main's body up to its output.
    expect(src).toContain(FIELD_FRAG.slice(FIELD_FRAG.indexOf("float fbm3"), FIELD_FRAG.indexOf("void main()")));
    expect(src).toContain(FIELD_FRAG.slice(FIELD_FRAG.indexOf("vec2 p = vec2(vUv.x"), FIELD_FRAG.indexOf("gl_FragColor")));
  });

  it("moves the hero name's surface to GLSL ES 3.00, unchanged otherwise", () => {
    const src = surfaceSource();
    expect(src.startsWith("#version 300 es\n")).toBe(true);
    expect(src).toContain("#define texture2D texture");
    expect(src).toContain("in vec2 vUv;");
    expect(src).not.toMatch(/\bvarying\b|gl_FragColor/);
    expect(src).toContain(SURFACE_FRAG.slice(SURFACE_FRAG.indexOf("vec2 toPlane"), SURFACE_FRAG.indexOf("gl_FragColor")));
  });

  it("keeps the hero's composite up to its main, the name's letters included, with the footer's main", () => {
    const src = compositeSource();
    expect(src).toContain(COMPOSITE_FRAG.slice(0, COMPOSITE_FRAG.indexOf("void main()")));
    expect(src.match(/void main\(\)/g)).toHaveLength(1);
    expect(src).toContain("nameLetters(deep, (px - uRect.xy) / uRect.zw, 0.0)");
    expect(src).toContain("(h12(gl_FragCoord.xy) - 0.5) / 255.0");
    expect(src).not.toContain("gl_FragColor");
  });

  it("refuses a hero shader whose shape changed", () => {
    expect(() => adaptFieldFrag("void main() {}")).toThrow();
    expect(() => adaptSurfaceFrag("void main() {}")).toThrow();
    expect(() => adaptCompositeFrag("void main() {}")).toThrow();
  });

  it("declares every uniform each pass sets", () => {
    const sources = { field: fieldSource(), surface: surfaceSource(), composite: compositeSource() };
    for (const pass of ["field", "surface", "composite"] as const) {
      for (const name of UNIFORMS[pass]) expect(declared(sources[pass], name), `${pass}: ${name}`).toBe(true);
    }
  });
});

describe("the hero name's surface, at the hero's scale", () => {
  it("keeps the surface folds the hero's size in px", () => {
    const [, ey] = surfaceExtent(1000, 200, 1440, 900);
    expect((2 * ey) / 200).toBeCloseTo(NAME_SURFACE.viewHeight / (FOOTER.heroLockup.wide * 1440), 12);
    const [, narrow] = surfaceExtent(380, 60, 390, 844);
    expect((2 * narrow) / 60).toBeCloseTo(NAME_SURFACE.viewHeight / (FOOTER.heroLockup.narrow * 390), 12);
  });

  it("sizes its target as the hero does, and runs its clock and light", () => {
    expect(surfaceTargetSize(1000, 200, 1)).toEqual([500, 100]);
    expect(surfaceTargetSize(4000, 400, 2)[0]).toBe(NAME_SURFACE.rtMaxWidth);
    expect(surfaceClock(0).t).toBe(NAME_SURFACE.start);
    expect(surfaceClock(10).t).toBeCloseTo(NAME_SURFACE.start + 10 * NAME_SURFACE.speed, 12);
    const [lx, ly] = surfaceClock(NAME_SURFACE.lightPeriod / 4).light;
    expect(lx).toBeCloseTo(NAME_SURFACE.lightRest[0], 9);
    expect(ly).toBeCloseTo(NAME_SURFACE.lightRest[1] + NAME_SURFACE.lightDrift, 9);
  });
});
