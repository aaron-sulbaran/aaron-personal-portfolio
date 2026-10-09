import { FIELD, FIELD_FRAG } from "@/lib/coil/field.glsl";
import type { FieldTokens } from "./tokens";

// The site's field shader (lib/coil/field.glsl.ts, the hero's weather) in a
// bare WebGL 2 program: no three, which the site allows only inside the Coil
// chunk. The fragment source is the site's own string, moved to GLSL ES 3.00
// with exact replacements, plus the lab's layers: an intensity that scales
// the field's distance from the paper (1 is the hero's field, 0 is paper), a
// frame (the field's uv over the canvas: the canvas itself, or the hero's
// frame for the hero backdrop), and the egg's ripple rings, which push the
// field outward as they pass and tint their crest toward the glow.

export const FIELD_VERT = `#version 300 es
in vec2 position;
out vec2 vUv0;
void main() { vUv0 = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

// The vertex shader for passes that read vUv (the name's surface).
export const UV_VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

export const MAX_RIPPLES = 2;

const VARYING = "varying vec2 vUv;";
const OUTPUT = "gl_FragColor = vec4(col, 1.0);";
const MAIN = "void main()";

// uRip[i]: a ring's center (canvas px from the top left), its radius and its
// push (px); uRipShine[i]: how far its crest leans toward the glow; uRipW:
// the ring's half width (px). uFrame maps the canvas's uv into the field's:
// scale in xy, offset in zw.
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

export function adaptFieldFrag(source: string): string {
  if (!source.includes(VARYING) || !source.includes(OUTPUT) || !source.includes(MAIN)) {
    throw new Error("The site's field shader changed shape; update the footer lab's adapter.");
  }
  const body = source
    .replace(VARYING, "")
    .replace(MAIN, "void fieldMain()")
    .replace(OUTPUT, "fragColor = vec4(clamp(uPaper + (col - uPaper) * uIntensity, 0.0, 1.0), 1.0);");
  const main = `
void main() {
  vUv = rippled(vUv0) * uFrame.xy + uFrame.zw;
  fieldMain();
  fragColor.rgb = mix(fragColor.rgb, clamp(uPaper + (uGlow - uPaper) * uIntensity, 0.0, 1.0), clamp(ripCrest, 0.0, 0.85));
}
`;
  return `#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec3 uPaper;\nuniform float uIntensity;\n${RIPPLE_GLSL}${body}${main}`;
}

// One ring for the shader: center in canvas px from its top left, radius
// and push in px, and its crest's tint.
export type RippleRing = { x: number; y: number; radius: number; push: number; shine: number };

export type FieldFrame = {
  readonly orange: number;
  readonly weather: number;
  readonly warp: number;
  readonly intensity: number;
  readonly tokens: FieldTokens;
  // The field's frame: its aspect, the canvas's height as a share of its
  // height, and where the canvas's bottom sits in it (1 and 0: the canvas
  // is the frame).
  readonly aspect: number;
  readonly frameY: number;
  readonly frameY0: number;
  readonly stagePx: readonly [number, number]; // the canvas in CSS px
  readonly rings: readonly RippleRing[];
  readonly ringWidthPx: number;
};

export function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("[footer lab] shader:", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

export type Program = {
  u: (name: string) => WebGLUniformLocation | null;
  use: () => void;
  dispose: () => void;
};

// A program over the shared fullscreen triangle (position at attribute 0).
export function link(gl: WebGL2RenderingContext, vert: string, frag: string): Program | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[footer lab] program:", gl.getProgramInfoLog(program));
    return null;
  }
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    u: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
      return cache.get(name) ?? null;
    },
    use: () => gl.useProgram(program),
    dispose: () => {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

export function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
    return gl && !gl.isContextLost() ? gl : null;
  } catch {
    return null;
  }
}

// The fullscreen triangle every pass draws, bound at attribute 0.
export function fullscreenTriangle(gl: WebGL2RenderingContext): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}

export type FieldPass = { draw: (frame: FieldFrame, width: number, height: number) => void; dispose: () => void };

// The field program: draws into whatever framebuffer is bound, at width by height.
export function createFieldPass(gl: WebGL2RenderingContext): FieldPass | null {
  const p = link(gl, FIELD_VERT, adaptFieldFrag(FIELD_FRAG));
  if (!p) return null;
  const rings = new Float32Array(4 * MAX_RIPPLES);
  const shines = new Float32Array(MAX_RIPPLES);
  return {
    draw(frame, width, height) {
      const { tokens } = frame;
      p.use();
      gl.uniform1f(p.u("uAmt"), FIELD.amount);
      gl.uniform2f(p.u("uSecAt"), ...FIELD.secondAt);
      gl.uniform2f(p.u("uSecScale"), ...FIELD.secondScale);
      gl.uniform1f(p.u("uT"), frame.orange);
      gl.uniform1f(p.u("uTw"), frame.weather);
      gl.uniform1f(p.u("uWarp"), frame.warp);
      gl.uniform1f(p.u("uAspect"), frame.aspect);
      gl.uniform1f(p.u("uSec"), tokens.dark ? FIELD.second.dark : FIELD.second.light);
      gl.uniform3f(p.u("uTop"), ...tokens.top);
      gl.uniform3f(p.u("uBottom"), ...tokens.bottom);
      gl.uniform3f(p.u("uGlow"), ...tokens.glow);
      gl.uniform3f(p.u("uSecond"), ...tokens.second);
      gl.uniform3f(p.u("uPaper"), ...tokens.paper);
      gl.uniform1f(p.u("uIntensity"), frame.intensity);
      gl.uniform4f(p.u("uFrame"), 1, frame.frameY, 0, frame.frameY0);
      gl.uniform2f(p.u("uStagePx"), Math.max(1, frame.stagePx[0]), Math.max(1, frame.stagePx[1]));
      rings.fill(0);
      shines.fill(0);
      frame.rings.slice(0, MAX_RIPPLES).forEach((r, i) => {
        rings.set([r.x, r.y, r.radius, r.push], 4 * i);
        shines[i] = r.shine;
      });
      gl.uniform4fv(p.u("uRip[0]"), rings);
      gl.uniform1fv(p.u("uRipShine[0]"), shines);
      gl.uniform1f(p.u("uRipW"), Math.max(1, frame.ringWidthPx));
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: p.dispose,
  };
}

export type FieldGl = { draw: (frame: FieldFrame) => void; resize: (width: number, height: number) => void; dispose: () => void };

// The footer's own field (rounds 1 to 3): the field drawn straight to a
// canvas at a third of CSS resolution, the browser upsampling it. Null when
// no WebGL 2 context can be made or the program fails: the caller shows the
// poster stand-in.
export function createFieldGl(canvas: HTMLCanvasElement): FieldGl | null {
  const gl = getContext(canvas);
  if (!gl) return null;
  const buffer = fullscreenTriangle(gl);
  const pass = createFieldPass(gl);
  if (!pass) return null;
  return {
    draw(frame) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      pass.draw(frame, canvas.width, canvas.height);
    },
    resize(width, height) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
    },
    dispose() {
      gl.deleteBuffer(buffer);
      pass.dispose();
      // No loseContext here: a dev remount (StrictMode) asks the same canvas
      // for its context again, and a lost one would fail every later call.
    },
  };
}
