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
//              vertical gradient in the letters (item 4), one of the name
//              fills below (fx-hero; solid is item 5's static grain), the
//              bottom seam fading to paper (item 8), and a sub-1/255 dither.
//              The lab's uHeroShift is gone: the canvas is sized from the
//              hero, so the hero is the whole view. "Hi, I'm" is part of the
//              name's mask, drawn with it (fx-hero).
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

// ---- fx-hero: the name's fill (Aaron, 2026-09-29) ----
//
// "Hi, I'm" and "Aaron" are one mask (the greeting a small line above the
// name's left edge); the letters take one of these fills, picked live by
// ?name=<key> (and a switcher under ?coildebug=name). Every textured fill
// idles by a slow advection (the texture drifts, it never re-seeds, so it
// never shimmers against the field) and is pushed aside by the cursor through
// the repel buffer (lib/coil/repel.ts). solid is the shipped gradient.
export const NAME_FILLS = ["grain", "stipple", "halftone", "grain-field", "grain-warm", "sand", "solid"] as const;
export type NameFill = (typeof NAME_FILLS)[number];
export const DEFAULT_NAME_FILL: NameFill = "grain";

export function parseNameFill(raw: string | null | undefined): NameFill {
  return NAME_FILLS.find((key) => key === raw) ?? DEFAULT_NAME_FILL;
}

// The live switch for the fill and the drift (the ?coildebug=name switcher
// dispatches it on window; the scene listens).
export const COIL_FX_EVENT = "coil:fx";
export type CoilFxDetail = { name?: string; drift?: string };

// The fill's scalars, in CSS px and seconds.
export const NAME_FILL = {
  // The greeting's cap height as a fraction of the name's, and the gap from
  // its lowest ink to the top of the "A" as a fraction of its cap height.
  greetingCap: 0.22,
  greetingGap: 0.45,
  greetingFadeMs: 350,
  // After the loader lands its solid DOM name, the texture grows in over this.
  fillInMs: 900,
  grainPx: 1.35, // grain: one grain about this wide
  stipplePx: 3.2, // stipple: one dot per cell this wide
  halftonePx: 5.5, // halftone: the screen's pitch
  halftoneDeg: 15,
  sandPx: 1.9,
  sandSpeed: 5, // px per second along the helix axis
  idlePx: 9, // the idle drift's reach
  idleScalePx: 190, // and the size of its eddies
  idleRate: 0.045, // how fast the eddies change
  warmShare: 0.4, // grain-warm: raises the orange grains' threshold at the corner (value noise sits near 0.5)
} as const;
// ---- end fx-hero ----

// uView maps gl_FragCoord to canvas uv (1 / drawing buffer size). uFull is
// the canvas in CSS px; uNameRect is the name mask's rect in CSS px (x, y
// from the top left, w, h; the greeting included); uDpr is device px per CSS
// px. uNameSpan is the name's own band in the mask (top, height, as fractions
// of the mask's height): the gradient spans it, the greeting above it takes
// the gradient's top color and its own alpha (uGreetA).
export const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D uField, uName, uRepel;
  uniform vec4 uView, uNameRect;
  uniform vec2 uFull, uNameSpan, uFlowDir;
  uniform vec3 uPaper, uGradTop, uGradBottom, uWarm;
  uniform float uNameK, uNameA, uGreetA, uGreetSplit, uLod, uGrain, uDpr, uSeam;
  uniform float uMode, uFillMix, uNameT, uRepelOn, uRepelMax;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // Zero-mean grain in [-1, 1] that moves smoothly (value noise, two taps).
  float grain(vec2 p) { return vnoise(p) + vnoise(p + vec2(91.7, 37.3)) - 1.0; }
  vec2 repelAt(vec2 uv) {
    vec4 r = texture2D(uRepel, clamp(uv, 0.0, 1.0));
    return (r.xy * 255.0 - 128.0) / 127.0 * uRepelMax;
  }
  // A round dot of radius r at distance d, antialiased over one device px.
  float dotCover(float d, float r) { float aa = 0.6 / uDpr; return 1.0 - smoothstep(r - aa, r + aa, d); }

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
      // A vertical gradient over the name's band against the field's vertical
      // gradient keeps a contrast floor everywhere, including over the orange.
      float gy = clamp((g.y - uNameSpan.x) / uNameSpan.y, 0.0, 1.0);
      vec3 gc = mix(uGradTop, uGradBottom, smoothstep(0.0, 1.0, gy));
      float k = clamp(uNameK, 0.0, 1.0);
      // The shipped fill: the gradient with static grain locked to the name's
      // own device pixels.
      vec2 cell = floor((px - uNameRect.xy) * uDpr);
      vec3 solid = gc + (h12(cell + 17.0) - 0.5) * 2.0 * uGrain;
      vec3 letters = mix(field, solid, k);
      int mode = int(uMode + 0.5);
      if (mode != 6 && uFillMix > 0.0) {
        // Name space in CSS px. The repel buffer moves the texture: a pixel
        // shows the point that was pushed onto it (fixed-point steps of the
        // inverse). The buffer never stretches the texture past 2x, so they
        // converge; where overlapping strokes still leave a residual, the
        // grain thins there by at most half.
        vec2 np = px - uNameRect.xy;
        vec2 q = np;
        float clearing = 0.0;
        if (uRepelOn > 0.5) {
          vec2 p1 = np - repelAt(g);
          vec2 p2 = np - repelAt(p1 / uNameRect.zw);
          vec2 p3 = np - repelAt(p2 / uNameRect.zw);
          clearing = 0.5 * smoothstep(2.0, 8.0, length(p3 - p2));
          q = p3;
        }
        // The greeting's strokes are thin: its texture runs finer, so it reads.
        q *= mix(1.0, 1.7, greeting);
        // Idle: slow eddies advect the texture a few px; never re-seeded.
        float tt = uNameT * ${NAME_FILL.idleRate.toFixed(4)};
        vec2 e = q / ${NAME_FILL.idleScalePx.toFixed(1)};
        q += (vec2(vnoise(e + vec2(0.0, tt)), vnoise(e + vec2(5.2, 1.3) - tt)) - 0.5) * ${(2 * NAME_FILL.idlePx).toFixed(1)};
        vec3 fill = letters;
        if (mode == 0 || mode == 4) {
          // grain (and grain-warm): fine film grain modulating the ink, the
          // shadergradient look, over the vertical gradient.
          float gn = grain(q / ${NAME_FILL.grainPx.toFixed(3)});
          float ink = k * (1.0 + 0.9 * gn);
          vec3 tone = gc * (1.0 + 0.14 * gn);
          if (mode == 4) {
            // Two tones: a share of the grains turn burnt orange toward the
            // name's upper right corner (the field's own second hue).
            float corner = 1.0 - smoothstep(0.0, 0.62, length((g - vec2(1.0, 0.0)) * vec2(1.0, 0.8)));
            // Value noise sits near 0.5, so the threshold rises from under its
            // floor (no orange) to about warmShare's quantile at the corner.
            float pick = step(vnoise(q / ${NAME_FILL.grainPx.toFixed(3)} + vec2(13.1, 71.9)), 0.2 + corner * ${NAME_FILL.warmShare.toFixed(3)});
            tone = mix(tone, uWarm, pick);
            ink *= 1.0 + 0.35 * pick;
          }
          fill = mix(field, tone, clamp(ink, 0.0, 1.0) * (1.0 - clearing));
        } else if (mode == 1) {
          // stipple: one dot per jittered cell (blue-noise-like spacing), of
          // varying size and tone, denser toward the bottom of the letters.
          float s = ${NAME_FILL.stipplePx.toFixed(3)};
          vec2 c = floor(q / s);
          vec2 j = h22(c);
          vec2 center = (c + 0.2 + 0.6 * j) * s;
          float r3 = h12(c + 41.0);
          float density = mix(0.62, 1.0, gy);
          float present = step(r3, density);
          float radius = s * mix(0.27, 0.42, h12(c + 7.0)) * mix(0.88, 1.12, gy);
          float d = dotCover(length(q - center), radius) * present;
          float ink = min(1.0, k * 3.0) * mix(0.7, 1.0, j.x);
          fill = mix(field, gc, ink * d * (1.0 - clearing));
        } else if (mode == 2) {
          // halftone: a regular screen rotated 15 degrees, the dot size
          // following a slow noise and the gradient.
          float a = radians(${NAME_FILL.halftoneDeg.toFixed(1)});
          vec2 rq = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
          float s = ${NAME_FILL.halftonePx.toFixed(3)};
          vec2 cc = (floor(rq / s) + 0.5) * s;
          float tone = clamp(0.3 + 0.45 * vnoise(cc / 140.0 + vec2(tt * 1.6, 0.0)) + 0.18 * gy, 0.08, 0.9);
          float d = dotCover(length(rq - cc), 0.5 * s * sqrt(tone) * 1.05);
          fill = mix(field, gc, min(1.0, k * 1.7) * d * (1.0 - clearing));
        } else if (mode == 3) {
          // grain-field: the letters as a window onto a stronger field, grain
          // on top.
          vec3 win = clamp(field + (field - uPaper) * 0.9, 0.0, 1.0);
          win = mix(win, gc, 0.3);
          float gn = grain(q / ${NAME_FILL.grainPx.toFixed(3)});
          // The window's ink is high, so the thinning is halved again here.
          fill = mix(field, win * (1.0 + 0.22 * gn), clamp(0.8 + 0.6 * gn, 0.0, 1.0) * (1.0 - 0.5 * clearing));
        } else if (mode == 5) {
          // sand: coarse grains drifting slowly along the helix's axis.
          vec2 sq = q - uFlowDir * uNameT * ${NAME_FILL.sandSpeed.toFixed(2)};
          float sn = vnoise(sq / ${NAME_FILL.sandPx.toFixed(3)});
          float grainy = smoothstep(0.38, 0.66, sn) * mix(0.85, 1.1, vnoise(sq / 23.0));
          float ink = min(1.0, k * 2.0) * grainy;
          fill = mix(field, gc * (0.92 + 0.16 * sn), ink * (1.0 - clearing));
        }
        letters = mix(letters, fill, uFillMix);
      }
      col = mix(col, letters, m);
    }
    // The hero's bottom edge fades to paper, so the field never meets the page in a seam.
    col = mix(uPaper, col, smoothstep(0.0, uSeam, fuv.y));
    col += (h12(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;
