import { NAME_COMPOSITE_GLSL } from "./field.glsl";

// The page's name canvas (slice 4d): the name's own small canvas draws the same
// letters the scene's composite drew (COMPOSITE_FRAG), from the same field, the
// same lit surface and the same per-letter reduction, but only the letters: the
// canvas is clear everywhere else, so the page shows through and the field is
// never anywhere but inside the letterforms. The uniforms are the composite's
// own names (scene/name.ts and its glyph pass write them and read them), and
// the letters' colour, once the surface has grown in (uSurfIn), is that
// composite's `letters` exactly: the surface, the wake, the per-letter minimum
// and the grain. The output is premultiplied by the letters' coverage.
//
// Before the surface grows in, the letters are the page's own text they take
// over from, pixel for pixel (the solid): a flat ink over the page, not over
// the field, at the solid's opacity (uSolidK). The name's is what the loader's
// lockup lands in (lib/home/loaderLanding.ts): "Aaron" in the gradient's
// middle at the ink's opacity (the same uniform as uNameK), "hi, i'm" in its
// top colour, whole, and no grain. Every page title wears the same fill
// (components/coil/fill): a title's solid is its own ink, whole.
export const NAME_ONLY_FRAG = /* glsl */ `
  uniform sampler2D uField, uName;
  uniform vec4 uView, uNameRect;
  uniform vec2 uFull;
  uniform vec3 uGradTop, uGradBottom;
  uniform float uNameK, uSolidK, uNameA, uGreetA, uGreetSplit, uLod;
  ${NAME_COMPOSITE_GLSL}

  void main() {
    vec2 fuv = gl_FragCoord.xy * uView.zw + uView.xy;
    vec2 px = vec2(fuv.x * uFull.x, (1.0 - fuv.y) * uFull.y);
    vec3 field = texture2D(uField, fuv).rgb;
    // Explicit LOD from the rect's own scale: no derivatives, so no seams.
    vec2 g = (px - uNameRect.xy) / uNameRect.zw;
    float inside = step(0.0, g.x) * step(0.0, g.y) * step(g.x, 1.0) * step(g.y, 1.0);
    float cover = textureLod(uName, vec2(clamp(g.x, 0.0, 1.0), 1.0 - clamp(g.y, 0.0, 1.0)), uLod).a * inside;
    float greeting = 1.0 - step(uGreetSplit, g.y);
    float m = cover * mix(uNameA, uGreetA, greeting);
    if (m <= 0.0) { gl_FragColor = vec4(0.0); return; }
    // The solid: the page's text as it was, over the page (premultiplied).
    float k = mix(clamp(uSolidK, 0.0, 1.0), 1.0, greeting);
    vec3 solid = mix(mix(uGradTop, uGradBottom, 0.5), uGradTop, greeting);
    vec4 was = vec4(solid, 1.0) * k * m;
    if (uSurfIn <= 0.0) { gl_FragColor = was; return; }
    vec3 letters = nameLetters(field, g, greeting);
    gl_FragColor = mix(was, vec4(letters * m, m), uSurfIn);
  }
`;

// A title that sits on the Coil's field (page 2's) sees that field, not one of
// its own: the field pass (FIELD_FRAG, unchanged) is drawn over a window of the
// Coil canvas's frame. uWindow is the title canvas in that frame's uv (x, y
// from the bottom left, w, h); (0, 0, 1, 1) is the canvas's own frame.
export const FIELD_WINDOW_VERT = /* glsl */ `
  uniform vec4 uWindow;
  varying vec2 vUv;
  void main() { vUv = uWindow.xy + uv * uWindow.zw; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
