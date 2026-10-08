import { describe, expect, it } from "vitest";
import { FIELD_FRAG } from "@/lib/coil/field.glsl";
import { adaptFieldFrag } from "../fieldGl";
import { fieldTokens, parseToken } from "../tokens";

describe("the field port", () => {
  it("moves the site's shader to GLSL ES 3.00 with the intensity knob", () => {
    const src = adaptFieldFrag(FIELD_FRAG);
    expect(src.startsWith("#version 300 es\n")).toBe(true);
    expect(src).not.toMatch(/\bvarying\b|gl_FragColor/);
    expect(src).toContain("in vec2 vUv;");
    expect(src).toContain("uPaper + (col - uPaper) * uIntensity");
    expect(src).toContain("uniform float uT, uTw, uWarp, uAspect, uAmt, uSec;");
  });

  it("refuses a shader whose shape changed", () => {
    expect(() => adaptFieldFrag("void main() {}")).toThrow();
  });
});

describe("the tokens", () => {
  it("parses hex and rgb, and falls back to paper", () => {
    expect(parseToken("#FAFAF7")).toEqual([250 / 255, 250 / 255, 247 / 255]);
    expect(parseToken("#fff")).toEqual([1, 1, 1]);
    expect(parseToken("rgba(255, 0, 51, 0.5)")).toEqual([1, 0, 0.2]);
    expect(parseToken("var(--x)")).toBeNull();
    const t = fieldTokens((name) => (name === "--color-background" ? "#0E1419" : name === "--shader-top" ? "#0A0F13" : ""), true);
    expect(t.top).toEqual([10 / 255, 15 / 255, 19 / 255]);
    expect(t.glow).toEqual(t.paper);
  });
});
