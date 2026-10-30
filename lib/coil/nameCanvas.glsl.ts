import { NAME_COMPOSITE_GLSL } from "./field.glsl";

// The page's name canvas (slice 4d): the name's own small canvas draws the same
// letters the scene's composite drew (COMPOSITE_FRAG), from the same field, the
// same lit surface and the same per-letter reduction, but only the letters: the
// canvas is clear everywhere else, so the page shows through and the field is
// never anywhere but inside the letterforms. The uniforms are the composite's
// own names (scene/name.ts and its glyph pass write them and read them), and
// the letters' colour is that composite's `letters` exactly: the loader's solid
// gradient (uNameK), the surface growing over it (uSurfIn), the wake, the
// per-letter minimum and the grain. The output is premultiplied by the letters'
// coverage.
//
// Every page title wears the same fill (components/coil/fill): uSolidK is how
// much of the solid the letters show before the surface grows over it. The
// name's is its ink (the same uniform as uNameK: the loader's solid name); a
// title's is 1 with the solid in the title's own ink and no grain, so the first
// frame is the DOM text it takes over from.
export const NAME_ONLY_FRAG = /* glsl */ `
  uniform sampler2D uField, uName;
  uniform vec4 uView, uNameRect;
  uniform vec2 uFull, uNameSpan;
  uniform vec3 uGradTop, uGradBottom;
  uniform float uNameK, uSolidK, uNameA, uGreetA, uGreetSplit, uLod, uGrain, uDpr;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
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
    // The loader's solid name: a vertical gradient over the name's band with
    // static grain locked to the name's own device pixels.
    float gy = clamp((g.y - uNameSpan.x) / uNameSpan.y, 0.0, 1.0);
    vec3 gc = mix(uGradTop, uGradBottom, smoothstep(0.0, 1.0, gy));
    vec2 cell = floor((px - uNameRect.xy) * uDpr);
    vec3 letters = mix(field, gc + (h12(cell + 17.0) - 0.5) * 2.0 * uGrain, clamp(uSolidK, 0.0, 1.0));
    if (uSurfIn > 0.0) letters = mix(letters, nameLetters(field, g, greeting), uSurfIn);
    gl_FragColor = vec4(letters * m, m);
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
