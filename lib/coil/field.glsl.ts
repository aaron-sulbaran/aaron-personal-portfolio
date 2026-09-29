// The Coil's two full-screen passes, ported from hero lab 2 (field 533-577,
// composite 579-631) with the design review's slice 3 fixes applied:
//
//   field      the Dusk-style weather at one third CSS resolution: a 3-octave
//              field warped twice, a vertical gradient, a soft blue mass from
//              the lower left and the corrected burnt orange second lobe
//              (review item 1: moved outward, shrunk, with a portrait term, so
//              orange holds about a fifth of the field on desktop and phone).
//   composite  the field upsampled at full resolution, "Aaron" drawn inside
//              its mask with explicit LOD (derivative sampling drew seams), a
//              vertical gradient in the letters (item 4), static grain locked
//              to the name's own pixels (item 5), the bottom seam fading to
//              paper (item 8), and a sub-1/255 dither. The lab's uHeroShift is
//              gone: the canvas is sized from the hero, so the hero is the
//              whole view. The greeting is DOM (components/coil/HeroOverlay).
//
// Strings only, no three import: the scene builds the materials.

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
  uniform float uT, uAspect, uAmt, uSec;
  uniform vec2 uSecAt, uSecScale;
  uniform vec3 uTop, uBottom, uGlow, uSecond;
  varying vec2 vUv;
  ${NOISE_GLSL}
  float fbm3(vec2 p) { float v = 0.0, a = 0.55; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 1.9 + vec2(1.7, 9.2); a *= 0.45; } return v / 0.9; }
  void main() {
    // Large, slow shapes only: two warps of a 3-octave field at a low frequency.
    vec2 p = vec2(vUv.x * uAspect, vUv.y) * 0.85;
    float t = uT;
    vec2 q = vec2(fbm3(p + vec2(0.0, 0.07 * t)), fbm3(p + vec2(3.1, 1.7) - 0.06 * t));
    vec2 r = vec2(fbm3(p * 0.8 + 1.3 * q + vec2(1.7, 9.2) + 0.05 * t), fbm3(p * 0.8 + 1.3 * q + vec2(8.3, 2.8) - 0.04 * t));
    float n = fbm3(p * 0.7 + 1.2 * r);
    float y = vUv.y + (n - 0.5) * 0.45 * uAmt;
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, y));
    // One soft mass rising from the lower left, its edge reshaped by the warp.
    float lobe = 1.0 - length((vUv - vec2(0.1, -0.12)) * vec2(uAspect * 0.46, 1.05));
    float glow = smoothstep(0.05, 0.85, lobe + (n - 0.5) * 1.1);
    col = mix(col, uGlow, glow * uAmt);
    // The second lobe, moved outward and shrunk; the portrait term keeps its
    // share steady on tall panes.
    float lobe2 = 1.0 - length((vUv - uSecAt) * vec2(uAspect * uSecScale.x, uSecScale.y * pow(max(1.0, 1.6 / uAspect), 0.3)));
    float sec = smoothstep(0.05, 0.85, lobe2 + (r.x - 0.5) * 1.1);
    col = mix(col, uSecond, sec * uAmt * uSec);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const COMPOSITE_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// uView maps gl_FragCoord to canvas uv (1 / drawing buffer size). uFull is
// the canvas in CSS px; uNameRect is the name mask's rect in CSS px (x, y
// from the top left, w, h); uDpr is device px per CSS px for the grain cell.
export const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D uField, uName;
  uniform vec4 uView, uNameRect;
  uniform vec2 uFull;
  uniform vec3 uPaper, uGradTop, uGradBottom;
  uniform float uNameK, uNameA, uLod, uGrain, uDpr, uSeam;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main() {
    vec2 fuv = gl_FragCoord.xy * uView.zw + uView.xy;
    vec2 px = vec2(fuv.x * uFull.x, (1.0 - fuv.y) * uFull.y);
    vec3 field = texture2D(uField, fuv).rgb;
    vec3 col = field;
    // Explicit LOD from the rect's own scale: no derivatives, so no seams.
    vec2 g = (px - uNameRect.xy) / uNameRect.zw;
    float inside = step(0.0, g.x) * step(0.0, g.y) * step(g.x, 1.0) * step(g.y, 1.0);
    float m = textureLod(uName, vec2(clamp(g.x, 0.0, 1.0), 1.0 - clamp(g.y, 0.0, 1.0)), uLod).a * inside * uNameA;
    if (m > 0.0) {
      // A vertical gradient against the field's vertical gradient keeps a
      // contrast floor everywhere, including over the orange.
      vec3 gc = mix(uGradTop, uGradBottom, smoothstep(0.0, 1.0, g.y));
      // Static grain, locked to the name's own device pixels, never animated.
      vec2 cell = floor((px - uNameRect.xy) * uDpr);
      gc += (h12(cell + 17.0) - 0.5) * 2.0 * uGrain;
      vec3 letters = mix(field, gc, clamp(uNameK, 0.0, 1.0));
      col = mix(col, letters, m);
    }
    // The hero's bottom edge fades to paper, so the field never meets the page in a seam.
    col = mix(uPaper, col, smoothstep(0.0, uSeam, fuv.y));
    col += (h12(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;
