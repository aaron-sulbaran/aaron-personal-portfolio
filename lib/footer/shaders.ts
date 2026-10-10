import { COMPOSITE_FRAG, FIELD_FRAG, NAME_SURFACE, SURFACE_FRAG } from "@/lib/coil/field.glsl";
import { MAX_RIPPLES } from "./egg";
import { lockupHeight } from "./heroFrame";

// The footer field's shaders: the hero's own strings (lib/coil/field.glsl.ts)
// imported, never copied, and moved to GLSL ES 3.00 by exact replacements,
// plus the footer's layers. A change to the hero's shape throws here and
// fails lib/footer/shaders.test.ts instead of drifting from it. Only the
// footer field's chunk (components/footer/gl/) and the tests import this
// module, so these strings never reach the main bundle.

export const FIELD_VERT = `#version 300 es
in vec2 position;
out vec2 vUv0;
void main() { vUv0 = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

// The vertex shader for the passes that read vUv (the name's surface, the composite).
export const UV_VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const ES3_HEADER = "#version 300 es\nprecision highp float;\nprecision highp int;\n#define texture2D texture\nout vec4 fragColor;\n";
const VARYING = "varying vec2 vUv;";
const FRAG_COLOR = "gl_FragColor = ";
const FIELD_OUTPUT = "gl_FragColor = vec4(col, 1.0);";
const MAIN = "void main()";
const LETTERS = "vec3 nameLetters(vec3 field, vec2 g, float greeting)";

// The egg's rings in the field: uRip[i] is a ring's center (canvas px from
// the top left), its radius and its push (px); uRipShine[i] how far its crest
// leans toward the glow; uRipW the ring's half width (px). uFrame maps the
// canvas's uv into the field's (the hero's frame): scale in xy, offset in zw.
const RIPPLE_GLSL = `
uniform vec2 uStagePx;
uniform vec4 uFrame;
uniform vec4 uRip[${MAX_RIPPLES}];
uniform float uRipShine[${MAX_RIPPLES}];
uniform float uRipW;
in vec2 vUv0;
vec2 vUv;
float ripCrest;
vec2 rippled(vec2 uv0) {
  vec2 px = vec2(uv0.x, 1.0 - uv0.y) * uStagePx;
  vec2 push = vec2(0.0);
  ripCrest = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    vec2 d = px - r.xy;
    float len = length(d);
    float x = (len - r.z) / uRipW;
    push += (len > 0.001 ? d / len : vec2(0.0)) * r.w * (-x * exp(0.5 - 0.5 * x * x));
    ripCrest += exp(-x * x) * uRipShine[i];
  }
  px -= push;
  return vec2(px.x / uStagePx.x, 1.0 - px.y / uStagePx.y);
}
`;

// The hero's field with an intensity (1 is the hero's, 0 paper), the hero's
// frame and the egg's rings, whose crest tints toward the glow.
export function adaptFieldFrag(source: string): string {
  if (!source.includes(VARYING) || !source.includes(FIELD_OUTPUT) || !source.includes(MAIN)) {
    throw new Error("The hero's field shader changed shape; update lib/footer/shaders.ts.");
  }
  const body = source
    .replace(VARYING, "")
    .replace(MAIN, "void fieldMain()")
    .replace(FIELD_OUTPUT, "fragColor = vec4(clamp(uPaper + (col - uPaper) * uIntensity, 0.0, 1.0), 1.0);");
  const main = `
void main() {
  vUv = rippled(vUv0) * uFrame.xy + uFrame.zw;
  fieldMain();
  fragColor.rgb = mix(fragColor.rgb, clamp(uPaper + (uGlow - uPaper) * uIntensity, 0.0, 1.0), clamp(ripCrest, 0.0, 0.85));
}
`;
  return `#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec3 uPaper;\nuniform float uIntensity;\n${RIPPLE_GLSL}${body}${main}`;
}

// The hero name's lit surface, unchanged but for the version.
export function adaptSurfaceFrag(source: string): string {
  if (!source.includes(VARYING) || !source.includes(FRAG_COLOR)) {
    throw new Error("The hero's surface shader changed shape; update lib/footer/shaders.ts.");
  }
  return ES3_HEADER + source.replace(VARYING, "in vec2 vUv;").replace(FRAG_COLOR, "fragColor = ");
}

// The footer's composite: the field upsampled, above the letters' band at
// the depth behind the footer, inside it at the letters' depth with the
// hero's name drawn from the surface over it (the band shows only through the
// letters: the paper cover holds the rest), then the hero's dither.
const FOOTER_MAIN = `
uniform vec2 uStage;
uniform float uBand, uBehind, uLetterK, uSurfOn;
uniform vec4 uRect;
void main() {
  vec2 fuv = gl_FragCoord.xy * uView.zw;
  vec3 field = texture(uField, fuv).rgb;
  vec2 px = vec2(fuv.x * uStage.x, (1.0 - fuv.y) * uStage.y);
  vec3 col;
  if (uBand >= 0.0 && px.y >= uBand) {
    vec3 deep = clamp(uPaper + (field - uPaper) * uLetterK, 0.0, 1.0);
    col = uSurfOn > 0.5 ? nameLetters(deep, (px - uRect.xy) / uRect.zw, 0.0) : deep;
  } else {
    col = clamp(uPaper + (field - uPaper) * uBehind, 0.0, 1.0);
  }
  col += (h12(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
`;

// The hero's composite up to its main (its uniforms, its grain hash and the
// name's letters), with the footer's main in place of the hero's.
export function adaptCompositeFrag(source: string): string {
  const at = source.indexOf(MAIN);
  if (at < 0 || !source.includes(LETTERS) || !source.includes("float h12(")) {
    throw new Error("The hero's composite changed shape; update lib/footer/shaders.ts.");
  }
  return ES3_HEADER + source.slice(0, at) + FOOTER_MAIN;
}

export const fieldSource = () => adaptFieldFrag(FIELD_FRAG);
export const surfaceSource = () => adaptSurfaceFrag(SURFACE_FRAG);
export const compositeSource = () => adaptCompositeFrag(COMPOSITE_FRAG);

// Every uniform each pass sets. The chunk's programs take only these names
// (a typed lookup), and the tests hold each one to a declaration in the
// adapted source, so a uniform the hero renames fails a test instead of
// silently reading 0.
export const UNIFORMS = {
  field: ["uAmt", "uSecAt", "uSecScale", "uT", "uTw", "uWarp", "uAspect", "uSec", "uTop", "uBottom", "uGlow", "uSecond", "uPaper", "uIntensity", "uFrame", "uStagePx", "uRip[0]", "uRipShine[0]", "uRipW"],
  surface: ["uWake", "uWakeOn", "uWakeSize", "uT", "uStrength", "uCrestBias", "uRelief", "uSheen", "uGloss", "uBright", "uDrag", "uMaxDrag", "uSwell", "uPress", "uChurn", "uShift", "uLift", "uExt", "uRot", "uLight", "uC1", "uC2", "uC3", "uShadow", "uSheenC"],
  composite: [
    "uField", "uName", "uGlyph", "uWake", "uSurf", "uView", "uStage", "uPaper", "uBehind", "uBand", "uLetterK", "uSurfOn", "uRect",
    "uNameK", "uSurfIn", "uSurfMean", "uDetail", "uChroma", "uFloor", "uFloorSign", "uReveal", "uGrainAmt", "uGlyphN", "uGlyphRel",
    "uGlyphAbs", "uGreetFloor", "uGreetCap", "uWakeOn",
  ],
} as const;

export type FieldUniform = (typeof UNIFORMS.field)[number];
export type SurfaceUniform = (typeof UNIFORMS.surface)[number];
export type CompositeUniform = (typeof UNIFORMS.composite)[number];

// The surface's plane extent (half width, half height, plane units) over a
// rect of the word: the hero's NAME_SURFACE.viewHeight spans the hero's
// lockup height, so a px here is a px there and the folds are the hero's size.
export function surfaceExtent(rectW: number, rectH: number, stageW: number, viewportH: number): [number, number] {
  const unitsPerPx = NAME_SURFACE.viewHeight / lockupHeight(stageW, viewportH);
  return [(rectW * unitsPerPx) / 2, (rectH * unitsPerPx) / 2];
}

// The surface target's size over a rect (CSS px), as the hero sizes its
// own: half the device resolution, at most NAME_SURFACE.rtMaxWidth wide.
export function surfaceTargetSize(rectW: number, rectH: number, dpr: number): [number, number] {
  const scale = Math.min(NAME_SURFACE.rtScale * dpr, NAME_SURFACE.rtMaxWidth / Math.max(1, rectW));
  return [Math.max(8, Math.round(rectW * scale)), Math.max(8, Math.round(rectH * scale))];
}

// The surface's clock and key light after `clock` seconds, as the hero's.
export function surfaceClock(clock: number) {
  const a = (clock / NAME_SURFACE.lightPeriod) * Math.PI * 2;
  return {
    t: NAME_SURFACE.start + clock * NAME_SURFACE.speed,
    light: [NAME_SURFACE.lightRest[0] + Math.cos(a) * NAME_SURFACE.lightDrift, NAME_SURFACE.lightRest[1] + Math.sin(a) * NAME_SURFACE.lightDrift] as const,
  };
}
