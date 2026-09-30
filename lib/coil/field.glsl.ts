// The Coil's two full-screen passes, ported from hero lab 2 (field 533-577,
// composite 579-631) with the design review's slice 3 fixes applied:
//
//   field      the Dusk-style weather at one third CSS resolution: a 3-octave
//              field warped twice, a vertical gradient, a soft blue mass from
//              the lower left and the corrected burnt orange second lobe
//              (review item 1: moved outward, shrunk, with a portrait term, so
//              orange holds about a fifth of the field on desktop and phone).
//   composite  the field upsampled at full resolution, "Aaron" drawn inside
//              its mask with explicit LOD (derivative sampling drew seams),
//              the lit surface below seen through the letters (the loader
//              lands on item 4's vertical gradient, which the surface grows
//              over), the bottom seam fading to paper (item 8), and a
//              sub-1/255 dither.
//              The lab's uHeroShift is gone: the canvas is sized from the
//              hero, so the hero is the whole view. "Hi, I'm" is part of the
//              name's mask, drawn with it (fx-hero).
//
// Strings only, no three import: the scene builds the materials.

import { WAKE } from "./wake";

// Field tuning from the design review (scaffold-inputs/design-review-lab2.md,
// "For slice 3" item 1). Colors come from the --shader-* tokens; these are
// the scalars the tokens cannot carry.
export const FIELD = {
  divisor: 3, // the field renders at a third of CSS resolution and is upsampled
  amount: 0.8, // fa
  second: { light: 0.75, dark: 0.5 }, // sec: the orange lobe's strength; light 0.75 lands the warm share near a fifth
  secondAt: [1.0, 1.2] as const, // lobe center, in field uv (above the top right)
  secondScale: [0.7, 1.45] as const, // lobe falloff, x (times aspect) and y
  // The static grain inside the letters: plus or minus 4/255, one device px.
  grain: 0.016,
  // The name's gradient mix: the lab mixes at ink * 2.2, so 12 percent ink is
  // 26.4 percent of the gradient color (review item 6, kept and written down).
  nameInkGain: 2.2,
  // The field fades to paper over the last 14 percent of the hero (item 8).
  seamFade: 0.14,
} as const;

export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

export const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const FIELD_FRAG = /* glsl */ `
  // uT is the orange clock (the tuned window); uTw the weather clock and uWarp
  // the gradient warp (fx-hero drift presets, lib/coil/drift.ts). With uTw
  // equal to uT and uWarp 0.45 this is the field as it shipped.
  uniform float uT, uTw, uWarp, uAspect, uAmt, uSec;
  uniform vec2 uSecAt, uSecScale;
  uniform vec3 uTop, uBottom, uGlow, uSecond;
  varying vec2 vUv;
  ${NOISE_GLSL}
  float fbm3(vec2 p) { float v = 0.0, a = 0.55; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 1.9 + vec2(1.7, 9.2); a *= 0.45; } return v / 0.9; }
  void main() {
    // Large, slow shapes only: two warps of a 3-octave field at a low frequency.
    vec2 p = vec2(vUv.x * uAspect, vUv.y) * 0.85;
    // The weather: the blue structure, on its own clock.
    float t = uTw;
    vec2 q = vec2(fbm3(p + vec2(0.0, 0.07 * t)), fbm3(p + vec2(3.1, 1.7) - 0.06 * t));
    vec2 r = vec2(fbm3(p * 0.8 + 1.3 * q + vec2(1.7, 9.2) + 0.05 * t), fbm3(p * 0.8 + 1.3 * q + vec2(8.3, 2.8) - 0.04 * t));
    float n = fbm3(p * 0.7 + 1.2 * r);
    // The orange lobe's warp stays on the tuned clock, so its share holds.
    float ro = r.x;
    if (uT != uTw) {
      vec2 qo = vec2(fbm3(p + vec2(0.0, 0.07 * uT)), fbm3(p + vec2(3.1, 1.7) - 0.06 * uT));
      ro = fbm3(p * 0.8 + 1.3 * qo + vec2(1.7, 9.2) + 0.05 * uT);
    }
    float y = vUv.y + (n - 0.5) * uWarp * uAmt;
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, y));
    // One soft mass rising from the lower left, its edge reshaped by the warp.
    float lobe = 1.0 - length((vUv - vec2(0.1, -0.12)) * vec2(uAspect * 0.46, 1.05));
    float glow = smoothstep(0.05, 0.85, lobe + (n - 0.5) * 1.1);
    col = mix(col, uGlow, glow * uAmt);
    // The second lobe, moved outward and shrunk; the portrait term keeps its
    // share steady on tall panes.
    float lobe2 = 1.0 - length((vUv - uSecAt) * vec2(uAspect * uSecScale.x, uSecScale.y * pow(max(1.0, 1.6 / uAspect), 0.3)));
    float sec = smoothstep(0.05, 0.85, lobe2 + (ro - 0.5) * 1.1);
    col = mix(col, uSecond, sec * uAmt * uSec);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const COMPOSITE_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---- the name: a lit shadergradient surface seen through the letters ----
//
// Ported from the winning name lab (Opus "Tide", labs/name-lab-opus-build/
// name-surface.js) with the design review's verdict (2026-09-30) and Aaron's
// answers of the same day:
//   surface    @shadergradient/react 2.4.20's "defaults" noise (MIT, ruucm and
//              stone-skipper; cnoise from hughsk/glsl-noise), as a fragment-only
//              pass (the runner-up Fable lab's approach): the analytic height
//              and finite-difference normals at half the name's device
//              resolution, in place of the lab's 32k-vertex mesh. The Tide
//              lab's color law (c1 to c2 across x, the pale crest c3 by height,
//              the stops clamped to a hull) and min/Max's relief and sheen.
//   wake       the pointer's wake grid (lib/coil/wake.ts) as a domain offset
//              of at most 0.6 plane units (it drags the weather along the
//              stroke), a swell, a press and a faster local clock, all scaling
//              with the wake so all of it settles with the wake. Sampled with
//              a cubic B-spline, so the offset has no seams at the grid's cells.
//   composite  the letters' lightness moves from the field's toward the
//              surface's in OKLab at the ink, the surface's own relief on top,
//              a floor so no crest dissolves a letter, the hue following the
//              surface faster; the wake raises the ink where it swells. Film
//              grain after the mix, scaled by the square root of the ink.
// "Hi, I'm" and "Aaron" are one mask, one lockup.

// The lockup and its fades, in CSS px and ms.
export const NAME = {
  // The greeting's cap height as a fraction of the name's (Aaron and the
  // builder, 2026-09-30: 0.22 read heavy), and the gap from its lowest ink to
  // the top of the "A" as a fraction of its own cap height.
  greetingCap: 0.18,
  greetingGap: 0.45,
  greetingFadeMs: 350,
  // After the loader lands its solid DOM name, the surface grows in over this.
  surfaceInMs: 900,
  // s: the per-letter minimum follows the drifting surface over about this.
  glyphEaseS: 0.4,
  // OKLab L the letters stay within: never pure black or white, even at full
  // ink (the unwound list's lead draws the whole surface).
  lightness: [0.22, 0.95] as const,
  // The per-letter reduction's slots: the name's letters from 0, the
  // greeting in the last.
  maxGlyphs: 8,
} as const;

// The surface pass: the lab's water plane (Dusk: fov 45 at distance 5, so the
// view at z = 0 is 4.14 plane units tall over the lockup), seen straight on.
export const NAME_SURFACE = {
  rtScale: 0.5, // half the name rect's device resolution
  rtMaxWidth: 1400,
  viewHeight: 4.142, // plane units across the lockup's height
  rotZ: -58, // degrees: the plane's turn in the view
  density: 0.7,
  strength: 2.2,
  speed: 0.1, // plane time per second
  start: 3, // plane time at clock 0
  crestBias: 0.35,
  relief: 0.55,
  sheen: 0.45,
  gloss: 14,
  bright: 0.96,
  eps: 0.05, // plane units: the normals' finite difference (the lab's)
  lightRest: [-0.45, 0.55] as const, // min/Max's REST_LIGHT
  lightDrift: 0.16, // the key light circles slowly: the idle breath catches it
  lightPeriod: 26, // s
} as const;

// What the wake does to the surface (the lab's "both", with the review's cuts:
// drag 4.0 to 2.0 as a bounded domain offset, churn 0.6 to 0.25).
export const NAME_DISTURB = {
  drag: 2,
  maxDrag: 0.6, // plane units
  swell: 1.4,
  churn: 0.25,
  shift: 1.2,
} as const;

// The wake's press (the cloth pushed back, or raised when negative) and its
// crest lift, per theme, tuned so a fast swipe moves the letters by 0.08 of
// lightness or more in light and 0.07 or more in dark: in light the touched
// cloth is pressed back into the deep stop, the way the rising ink already
// moves it; in dark it rises toward the pale crest, the way the ink moves it
// there. Either way the two never cancel.
export function nameDisturb(dark: boolean) {
  return dark ? { press: -0.6, lift: 0.8 } : { press: 1.4, lift: 0 };
}

// The composite's per-theme scalars. floor: the letters sit at least this
// far (OKLab L) from the field, darker in light, lighter in dark (dark keeps
// it low so the letters stay free to answer the wake; the per-letter minimum
// holds them off the night field). detail: the
// surface's own relief on top of the ink. reveal: how far the wake raises the
// ink. chroma: how much faster than the lightness the hue follows the surface.
// grain: film grain's amplitude at full ink. glyphRel: no letter's
// glyph-scale contrast falls under this share of the strongest letter's (the
// review's "A" fix, 2026-09-30); glyphAbs: nor under this (dark: the letters
// about +0.14 over the night field). greetFloor: the greeting's floor as a
// multiple of the name's (its strokes are thin). greetCap: when above 0, the
// greeting's mean contrast is held at or under this share of the name's mean
// (dark: the small line outshone the name). Measured against the field under
// it, which reads a little stronger than the field around it, hence just
// over 1: the greeting lands at or just under the name's mean.
export function nameComposite(dark: boolean) {
  return dark
    ? {
        floor: 0.04,
        floorSign: -1,
        detail: 1.3,
        reveal: 2.2,
        chroma: 1.7,
        grain: 0.055 * 0.7,
        glyphRel: 0.72,
        glyphAbs: 0.11,
        greetFloor: 1,
        greetCap: 1.05,
      }
    : { floor: 0.08, floorSign: 1, detail: 1, reveal: 1.8, chroma: 2.4, grain: 0.055, glyphRel: 0.72, glyphAbs: 0, greetFloor: 1.8, greetCap: 0 };
}
const GREET_SLOT = NAME.maxGlyphs - 1;
export const NAME_GRAIN = { size: 1, chroma: 0.35 } as const; // device px, and its color share

const f = (x: number) => x.toFixed(4);
const GLYPH_GRID = 24; // points a side on each letter's box, in the reduction

// A cubic B-spline lookup through four bilinear taps (Sigg and Hadwiger): C2
// smooth, so the wake's cells never show as creases.
const WAKE_SAMPLE_GLSL = /* glsl */ `
  uniform sampler2D uWake;
  uniform vec2 uWakeSize;
  uniform float uWakeOn;
  vec4 wakeAt(vec2 g) {
    vec2 uv = (g - 0.5) / ${f(1 + 2 * WAKE.margin)} + 0.5;
    uv.y = 1.0 - uv.y;
    vec2 st = uv * uWakeSize - 0.5;
    vec2 i = floor(st);
    vec2 t = st - i;
    vec2 t2 = t * t, t3 = t2 * t;
    vec2 w0 = (-t3 + 3.0 * t2 - 3.0 * t + 1.0) / 6.0;
    vec2 w1 = (3.0 * t3 - 6.0 * t2 + 4.0) / 6.0;
    vec2 w2 = (-3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0) / 6.0;
    vec2 w3 = t3 / 6.0;
    vec2 g0 = w0 + w1, g1 = w2 + w3;
    vec2 h0 = (i - 0.5 + w1 / g0) / uWakeSize;
    vec2 h1 = (i + 1.5 + w3 / g1) / uWakeSize;
    return g0.y * (g0.x * texture2D(uWake, h0) + g1.x * texture2D(uWake, vec2(h1.x, h0.y)))
         + g1.y * (g0.x * texture2D(uWake, vec2(h0.x, h1.y)) + g1.x * texture2D(uWake, h1));
  }
`;

export const CNOISE_GLSL = /* glsl */ `
  // @shadergradient/react 2.4.20 (MIT), from hughsk/glsl-noise periodic/3d.glsl, unchanged.
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
  float cnoise(vec3 P) {
    vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod289(Pi0); Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x); vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
    vec4 ixy = permute(permute(ix) + iy); vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 * (1.0 / 7.0); vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5; gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 * (1.0 / 7.0); vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5; gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x, gy0.x, gz0.x); vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
    vec3 g010 = vec3(gx0.z, gy0.z, gz0.z); vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
    vec3 g001 = vec3(gx1.x, gy1.x, gz1.x); vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
    vec3 g011 = vec3(gx1.z, gy1.z, gz1.z); vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    return 2.2 * mix(n_yz.x, n_yz.y, fade_xyz.x);
  }
`;

// The surface pass: one quad over the name's lockup rect into a half
// resolution target. vUv is the rect's uv, y up. uExt is the rect's half size
// in plane units; uRot the plane's turn (cos, sin).
export const SURFACE_FRAG = /* glsl */ `
  uniform float uT, uStrength, uCrestBias, uRelief, uSheen, uGloss, uBright;
  uniform float uDrag, uMaxDrag, uSwell, uPress, uChurn, uShift, uLift;
  uniform vec2 uExt, uRot, uLight;
  uniform vec3 uC1, uC2, uC3, uShadow, uSheenC;
  varying vec2 vUv;
  ${WAKE_SAMPLE_GLSL}
  ${CNOISE_GLSL}
  // The screen (world) to the plane's own axes, and back.
  vec2 toPlane(vec2 v) { return vec2(uRot.x * v.x + uRot.y * v.y, -uRot.y * v.x + uRot.x * v.y); }
  vec2 toScreen(vec2 v) { return vec2(uRot.x * v.x - uRot.y * v.y, uRot.y * v.x + uRot.x * v.y); }
  // @shadergradient/react: distortion = 0.75 * cnoise(0.43 * position * density + t).
  float lift(vec2 p, float t) { return 0.75 * cnoise(vec3(p * ${f(0.43 * NAME_SURFACE.density)}, 0.0) + t); }
  void main() {
    vec2 p = toPlane((vUv * 2.0 - 1.0) * uExt);
    float e = 0.0;
    vec2 drag = vec2(0.0);
    if (uWakeOn > 0.5) {
      vec4 wk = wakeAt(vec2(vUv.x, 1.0 - vUv.y));
      e = wk.r;
      // The hand drags the weather along the stroke, as a bounded domain offset.
      drag = toPlane(wk.gb * 2.0 - 1.0) * e * uDrag;
      float dl = length(drag);
      if (dl > uMaxDrag) drag *= uMaxDrag / dl;
    }
    // Its folds swell, it is pressed back, and its weather runs a little
    // faster where it was touched; all of it scales with the wake.
    float t = uT + e * uChurn;
    float k = uStrength * (1.0 + e * uSwell);
    float press = e * uPress;
    vec2 q = p - drag;
    float h = lift(q, t) * k - press;
    float hx = (lift(q + vec2(${f(NAME_SURFACE.eps)}, 0.0), t) * k - press - h) / ${f(NAME_SURFACE.eps)};
    float hy = (lift(q + vec2(0.0, ${f(NAME_SURFACE.eps)}), t) * k - press - h) / ${f(NAME_SURFACE.eps)};
    // The lab's color: c1 to c2 along the plane's x, the pale crest c3 by
    // height, clamped to the stops' hull.
    vec3 base = mix(uC1, uC2, smoothstep(-3.0, 3.0, p.x + e * uShift));
    float crest = clamp(h - uCrestBias + e * uLift, 0.0, 1.0);
    vec3 col = mix(base, uC3, crest) * uBright;
    // min/Max's relief and sheen: a key light shading toward the shadow stop,
    // and a broad sheen, screened on so no channel clips before another.
    vec3 N = normalize(vec3(toScreen(vec2(-hx, -hy)), 1.0));
    vec3 L = normalize(vec3(uLight, 1.0));
    float diffuse = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), uGloss);
    col = mix(col, uShadow, uRelief * 0.7 * (1.0 - diffuse));
    col = 1.0 - (1.0 - col) * (1.0 - uSheenC * spec * uSheen);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

const OKLAB_GLSL = /* glsl */ `
  // OKLab with the exact sRGB transfer (the lab's pow 2.2 read the night
  // field's darks about 0.02 L low), so the floors are true L.
  vec3 toLinear(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  vec3 oklab(vec3 c) {
    c = toLinear(c);
    float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
    float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
    float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
    return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
  }
  vec3 fromOklab(vec3 o) {
    float l = o.x + 0.3963377774 * o.y + 0.2158037573 * o.z;
    float m = o.x - 0.1055613458 * o.y - 0.0638541728 * o.z;
    float s = o.x - 0.0894841775 * o.y - 1.2914855480 * o.z;
    l = l * l * l; m = m * m * m; s = s * s * s;
    vec3 c = vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                  -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                  -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
    return toSrgb(c);
  }
`;

// The per-letter reduction: one fragment per letter (a target NAME.maxGlyphs
// wide, one tall), each averaging its letter's contrast against the field at
// the rest ink (the floor applied) over a grid of points on its ink. The
// composite lifts any letter whose mean falls short of glyphRel of the
// strongest letter's (or of glyphAbs) by the shortfall, the whole letter at
// once, so it keeps its relief. Encoded c * 2 + 0.5 (c in -0.25..0.25). The
// result eases from the last one at uGlyphBlend (0 holds it: while the wake
// is live, so the lift never cancels what a gesture does to a letter).
export const GLYPH_FRAG = /* glsl */ `
  uniform sampler2D uField, uName, uSurf, uGlyphPrev;
  uniform float uGlyphBlend;
  uniform vec4 uNameRect;
  uniform vec2 uFull;
  uniform vec3 uSurfMean;
  uniform float uNameK, uDetail, uFloor, uFloorSign, uGlyphN, uGreetFloor;
  uniform vec4 uGlyphBox[${NAME.maxGlyphs}];
  ${OKLAB_GLSL}
  void main() {
    int i = int(gl_FragCoord.x);
    bool greeting = i == ${GREET_SLOT};
    if (float(i) >= uGlyphN && !greeting) { gl_FragColor = vec4(0.5, 0.0, 0.0, 1.0); return; }
    vec4 box = uGlyphBox[i];
    float floorL = greeting ? uFloor * uGreetFloor : uFloor;
    float k = clamp(uNameK, 0.0, 1.0);
    float meanL = oklab(uSurfMean).x;
    float sum = 0.0, count = 0.0;
    for (int y = 0; y < ${GLYPH_GRID}; y++) {
      for (int x = 0; x < ${GLYPH_GRID}; x++) {
        vec2 g = mix(box.xy, box.zw, (vec2(float(x), float(y)) + 0.5) / ${f(GLYPH_GRID)});
        vec2 uv = vec2(g.x, 1.0 - g.y);
        if (textureLod(uName, uv, 0.0).a < 0.5) continue;
        vec2 px = uNameRect.xy + g * uNameRect.zw;
        float fieldL = oklab(texture2D(uField, vec2(px.x / uFull.x, 1.0 - px.y / uFull.y)).rgb).x;
        float surfL = oklab(textureLod(uSurf, uv, 0.0).rgb).x;
        float L = mix(fieldL, surfL, k) + (surfL - meanL) * k * uDetail;
        L = uFloorSign > 0.0 ? min(L, fieldL - floorL) : max(L, fieldL + floorL);
        sum += uFloorSign * (fieldL - L);
        count += 1.0;
      }
    }
    float c = count > 0.0 ? sum / count : 0.0;
    float previous = texture2D(uGlyphPrev, vec2((float(i) + 0.5) / ${f(NAME.maxGlyphs)}, 0.5)).r;
    gl_FragColor = vec4(mix(previous, clamp(c * 2.0 + 0.5, 0.0, 1.0), uGlyphBlend), step(0.5, count), 0.0, 1.0);
  }
`;

// The composite's name block: the letters from the field, the surface and the wake.
const NAME_COMPOSITE_GLSL = /* glsl */ `
  uniform sampler2D uSurf;
  uniform vec3 uSurfMean;
  uniform float uSurfIn, uDetail, uChroma, uFloor, uFloorSign, uReveal, uGrainAmt;
  // The per-letter minimum: each letter's box (the rect's uv, x0 y0 x1 y1)
  // and its mean contrast from the reduction (GLYPH_FRAG).
  uniform sampler2D uGlyph;
  uniform vec4 uGlyphBox[${NAME.maxGlyphs}];
  uniform float uGlyphN, uGlyphRel, uGlyphAbs, uGreetFloor, uGreetCap;
  ${WAKE_SAMPLE_GLSL}
  ${OKLAB_GLSL}
  vec3 h32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }

  vec2 surfUv(vec2 g) { return vec2(clamp(g.x, 0.0, 1.0), 1.0 - clamp(g.y, 0.0, 1.0)); }
  float glyphMean(int i) { return (texture2D(uGlyph, vec2((float(i) + 0.5) / ${f(NAME.maxGlyphs)}, 0.5)).r - 0.5) * 0.5; }

  vec3 nameLetters(vec3 field, vec2 g, float greeting) {
    vec3 surf = textureLod(uSurf, surfUv(g), 0.0).rgb;
    // The wake raises the ink where it swells: the touched region surfaces
    // out of the field, then sinks back with the wake (same envelope).
    float wake = uWakeOn > 0.5 ? wakeAt(g).r : 0.0;
    float k = clamp(uNameK * (1.0 + uReveal * wake), 0.0, 1.0);
    vec3 fl = oklab(field), s = oklab(surf), sm = oklab(uSurfMean);
    float L = mix(fl.x, s.x, k) + (s.x - sm.x) * k * uDetail;
    // No letter's mean contrast falls under glyphRel of the strongest
    // letter's (nor under glyphAbs): a letter that does moves by its
    // shortfall, all of it at once, so it keeps its relief.
    float strongest = 0.0, mine = 1.0, total = 0.0;
    for (int i = 0; i < ${NAME.maxGlyphs}; i++) {
      if (float(i) >= uGlyphN) break;
      float c = glyphMean(i);
      strongest = max(strongest, c);
      total += c;
      vec4 box = uGlyphBox[i];
      if (g.x >= box.x && g.x < box.z) mine = c;
    }
    float floorL = uFloor * mix(1.0, uGreetFloor, greeting);
    L = uFloorSign > 0.0 ? min(L, fl.x - floorL) : max(L, fl.x + floorL);
    // After the floor, as the reduction measured it, so the letter's mean
    // moves by exactly its shortfall.
    L -= uFloorSign * max(0.0, max(uGlyphRel * strongest, uGlyphAbs) - mine) * (1.0 - greeting);
    // The greeting's mean held at or under greetCap of the name's (the same
    // move the other way, never past the plain floor).
    if (uGreetCap > 0.0 && greeting > 0.0) {
      float excess = max(0.0, glyphMean(${GREET_SLOT}) - uGreetCap * total / max(1.0, uGlyphN));
      L += uFloorSign * excess * greeting;
      L = uFloorSign > 0.0 ? min(L, fl.x - uFloor) : max(L, fl.x + uFloor);
    }
    L = clamp(L, ${f(NAME.lightness[0])}, ${f(NAME.lightness[1])});
    vec2 ab = mix(fl.yz, s.yz, clamp(k * uChroma, 0.0, 1.0));
    vec3 letters = clamp(fromOklab(vec3(L, ab)), 0.0, 1.0);
    // Film grain after the mix (the Fable lab's): zero-mean triangular noise
    // locked to the device pixels, scaled by the ink's visibility and capped
    // by headroom, so it reads at a low ink, never dominates at full ink and
    // never moves the mean.
    vec2 cell = floor(gl_FragCoord.xy / ${f(NAME_GRAIN.size)});
    vec3 n = h32(cell) + h32(cell + 91.7) - 1.0;
    vec3 grain = mix(vec3(n.g), n, ${f(NAME_GRAIN.chroma)});
    vec3 room = max(min(letters, 1.0 - letters), 0.0);
    letters += grain * min(vec3(uGrainAmt * sqrt(k)), room);
    return letters;
  }
`;

// uView maps gl_FragCoord to canvas uv (1 / drawing buffer size). uFull is
// the canvas in CSS px; uNameRect is the name mask's rect in CSS px (x, y
// from the top left, w, h; the greeting included); uDpr is device px per CSS
// px. uNameSpan is the name's own band in the mask (top, height, as fractions
// of the mask's height): the handoff gradient spans it. The greeting (above
// uGreetSplit) takes its own alpha (uGreetA). uSurfIn grows the surface over
// the solid gradient the loader lands on.
export const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D uField, uName;
  uniform vec4 uView, uNameRect;
  uniform vec2 uFull, uNameSpan;
  uniform vec3 uPaper, uGradTop, uGradBottom;
  uniform float uNameK, uNameA, uGreetA, uGreetSplit, uLod, uGrain, uDpr, uSeam;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  ${NAME_COMPOSITE_GLSL}

  void main() {
    vec2 fuv = gl_FragCoord.xy * uView.zw + uView.xy;
    vec2 px = vec2(fuv.x * uFull.x, (1.0 - fuv.y) * uFull.y);
    vec3 field = texture2D(uField, fuv).rgb;
    vec3 col = field;
    // Explicit LOD from the rect's own scale: no derivatives, so no seams.
    vec2 g = (px - uNameRect.xy) / uNameRect.zw;
    float inside = step(0.0, g.x) * step(0.0, g.y) * step(g.x, 1.0) * step(g.y, 1.0);
    float cover = textureLod(uName, vec2(clamp(g.x, 0.0, 1.0), 1.0 - clamp(g.y, 0.0, 1.0)), uLod).a * inside;
    float greeting = 1.0 - step(uGreetSplit, g.y);
    float m = cover * mix(uNameA, uGreetA, greeting);
    if (m > 0.0) {
      // The loader's solid name: a vertical gradient over the name's band
      // with static grain locked to the name's own device pixels.
      float gy = clamp((g.y - uNameSpan.x) / uNameSpan.y, 0.0, 1.0);
      vec3 gc = mix(uGradTop, uGradBottom, smoothstep(0.0, 1.0, gy));
      vec2 cell = floor((px - uNameRect.xy) * uDpr);
      vec3 letters = mix(field, gc + (h12(cell + 17.0) - 0.5) * 2.0 * uGrain, clamp(uNameK, 0.0, 1.0));
      if (uSurfIn > 0.0) letters = mix(letters, nameLetters(field, g, greeting), uSurfIn);
      col = mix(col, letters, m);
    }
    // The hero's bottom edge fades to paper, so the field never meets the page in a seam.
    col = mix(uPaper, col, smoothstep(0.0, uSeam, fuv.y));
    col += (h12(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;
