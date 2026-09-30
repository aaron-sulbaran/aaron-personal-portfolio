import { DoubleSide, PlaneGeometry, ShaderMaterial, Vector2, type IUniform, type Texture } from "three";
import { COIL } from "./constants";

// The card material, ported from hero lab 2 (634-693).
//
// Vertex: the flat 3:4 plane wraps exactly onto a cylinder coaxial with the
// helix (an isometric bend), so the card's edges follow the spring. It mirrors
// bendLocal() in geometry.ts, which the flight and picking use.
//
// Fragment: the front texture, or the back (the duotone for photos, the plain
// pane for work cards, both painted in textures.ts); the seen ring (a 1px
// outline dot in the upper corner, ink or paper by what sits under it, never
// a grey-out); a gentle falloff across the bend; the token-strength sheen; the
// hover brightening toward paper; and the recede into the field by brightness,
// never blur. The hairline and the flat 1px highlight are painted into the
// textures, so they bend with the card. Last, the card dissolves over the
// hero's bottom edge on the field's own seam curve (smoothstep(0, uSeam, y) in
// canvas uv, the canvas being the hero): it blends toward what the composite
// shows behind it there, the field faded to paper, so a card crossing the
// hero's edge fades out with the field instead of clipping on a hard line.
//
// Two uniforms exist for the flight (the scene draws the flown card with this
// same shader above the modal): uSeamMix releases the seam dissolve as the card
// leaves the hero (1 in the coil), and uSoft trades the coil's hard alpha edge
// for the painted edge's own alpha as the card grows to the modal's size (0 in
// the coil). At their coil values the shader is the one the coil always had.

export const CARD_VERT = /* glsl */ `
  uniform float uBend;   // 1 / bend radius, in card heights
  uniform vec2 uAxis;    // the helix axis in the card's own plane (sin b, cos b)
  varying vec2 vUv; varying vec3 vN; varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec3 p = position;
    vec3 n = vec3(0.0, 0.0, 1.0);
    if (abs(uBend) > 1e-4) {
      vec2 perp = vec2(uAxis.y, -uAxis.x);
      float along = dot(p.xy, uAxis);
      float w = dot(p.xy, perp);
      float a = w * uBend;
      p.xy = uAxis * along + perp * (sin(a) / uBend);
      p.z = (cos(a) - 1.0) / uBend;
      n = vec3(perp * sin(a), cos(a));
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    vN = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
  }
`;

export const CARD_FRAG = /* glsl */ `
  uniform sampler2D mapF, mapB, uField;
  uniform vec4 uView;
  uniform vec3 uInk, uPaper;
  uniform vec2 uSize;
  uniform float uFade, uBright, uAlpha, uSeen, uShade, uSheen, uSeam, uSeamMix, uSoft;
  varying vec2 vUv; varying vec3 vN; varying vec3 vViewPos;
  void main() {
    bool front = gl_FrontFacing;
    vec2 uv = front ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec4 t = front ? texture2D(mapF, uv) : texture2D(mapB, uv);
    float edge = mix(step(0.5, t.a), t.a, uSoft);
    if (edge < 0.004) discard;
    vec3 c = t.rgb;
    if (front && uSeen > 0.001) {
      vec2 p = vUv * uSize;
      vec2 cen = vec2(uSize.x - 0.085, uSize.y - 0.085);
      float d = length(p - cen);
      float fw = fwidth(d);
      float ring = 1.0 - smoothstep(0.35, 1.0, abs(d - 0.028) / fw);
      vec3 under = texture2D(mapF, cen / uSize).rgb;
      vec3 rc = dot(under, vec3(0.299, 0.587, 0.114)) > 0.55 ? uInk : uPaper;
      c = mix(c, rc, ring * uSeen);
    }
    vec3 N = normalize(vN); if (!front) N = -N;
    vec3 V = normalize(-vViewPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    c *= mix(1.0, 0.74 + 0.26 * ndv, uShade);
    vec3 H = normalize(normalize(vec3(-0.35, 0.55, 1.0)) + V);
    c += uSheen * pow(max(dot(N, H), 0.0), 70.0);
    c = mix(c, uPaper, uBright);
    vec2 fuv = gl_FragCoord.xy * uView.zw + uView.xy;
    vec3 fc = texture2D(uField, clamp(fuv, 0.0, 1.0)).rgb;
    c = mix(c, fc, clamp(uFade, 0.0, 1.0));
    float seam = mix(1.0, smoothstep(0.0, uSeam, fuv.y), uSeamMix);
    c = mix(mix(uPaper, fc, seam), c, seam);
    gl_FragColor = vec4(c, uAlpha * edge);
  }
`;

// Uniforms every card shares (one object each, so a theme or resize update
// is one write): the field texture, the view mapping, ink, paper, sheen and
// the seam fade.
export type SharedCardUniforms = {
  uField: IUniform<Texture | null>;
  uView: IUniform;
  uInk: IUniform;
  uPaper: IUniform;
  uSheen: IUniform<number>;
  uSeam: IUniform<number>;
};

export type CardUniforms = SharedCardUniforms & {
  mapF: IUniform<Texture | null>;
  mapB: IUniform<Texture | null>;
  uSize: IUniform;
  uBend: IUniform<number>;
  uAxis: IUniform;
  uFade: IUniform<number>;
  uBright: IUniform<number>;
  uAlpha: IUniform<number>;
  uSeen: IUniform<number>;
  uShade: IUniform<number>;
  uSeamMix: IUniform<number>;
  uSoft: IUniform<number>;
};

// One plane, shared by every card: 28 by 8 segments carry the bend smoothly.
export function createCardGeometry() {
  return new PlaneGeometry(COIL.cardAspect, 1, 28, 8);
}

export function createCardMaterial(shared: SharedCardUniforms) {
  const uniforms: CardUniforms = {
    ...shared,
    mapF: { value: null },
    mapB: { value: null },
    uSize: { value: new Vector2(COIL.cardAspect, 1) },
    uBend: { value: 0 },
    uAxis: { value: new Vector2(0, 1) },
    uFade: { value: 0 },
    uBright: { value: 0 },
    uAlpha: { value: 1 },
    uSeen: { value: 0 },
    uShade: { value: 1 },
    uSeamMix: { value: 1 },
    uSoft: { value: 0 },
  };
  const material = new ShaderMaterial({
    vertexShader: CARD_VERT,
    fragmentShader: CARD_FRAG,
    side: DoubleSide,
    transparent: false,
    depthWrite: true,
    uniforms: uniforms as unknown as Record<string, IUniform>,
  });
  return { material, uniforms };
}
