import { FIELD, FIELD_FRAG } from "@/lib/coil/field.glsl";
import type { FieldTokens } from "./tokens";

// The site's field shader (lib/coil/field.glsl.ts, the hero's weather) in a
// bare WebGL 2 program: no three, which the site allows only inside the Coil
// chunk. The fragment source is the site's own string, moved to GLSL ES 3.00
// with two exact replacements, plus one lab knob: an intensity that scales
// the field's distance from the paper (1 is the hero's field, 0 is paper).

export const FIELD_VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const VARYING = "varying vec2 vUv;";
const OUTPUT = "gl_FragColor = vec4(col, 1.0);";

export function adaptFieldFrag(source: string): string {
  if (!source.includes(VARYING) || !source.includes(OUTPUT)) {
    throw new Error("The site's field shader changed shape; update the footer lab's adapter.");
  }
  const body = source
    .replace(VARYING, "in vec2 vUv;")
    .replace(OUTPUT, "fragColor = vec4(clamp(uPaper + (col - uPaper) * uIntensity, 0.0, 1.0), 1.0);");
  return `#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec3 uPaper;\nuniform float uIntensity;\n${body}`;
}

export type FieldFrame = {
  readonly orange: number;
  readonly weather: number;
  readonly warp: number;
  readonly intensity: number;
  readonly tokens: FieldTokens;
};

export type FieldGl = { draw: (frame: FieldFrame) => void; resize: (width: number, height: number) => void; dispose: () => void };

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("[footer lab] field shader:", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

// Null when no WebGL 2 context can be made or the program fails: the caller
// shows the poster stand-in.
export function createFieldGl(canvas: HTMLCanvasElement): FieldGl | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
  } catch {
    gl = null;
  }
  if (!gl || gl.isContextLost()) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, FIELD_VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, adaptFieldFrag(FIELD_FRAG));
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[footer lab] field program:", gl.getProgramInfoLog(program));
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    t: u("uT"), tw: u("uTw"), warp: u("uWarp"), aspect: u("uAspect"), amt: u("uAmt"), sec: u("uSec"),
    secAt: u("uSecAt"), secScale: u("uSecScale"), top: u("uTop"), bottom: u("uBottom"), glow: u("uGlow"),
    second: u("uSecond"), paper: u("uPaper"), intensity: u("uIntensity"),
  };
  gl.uniform1f(loc.amt, FIELD.amount);
  gl.uniform2f(loc.secAt, ...FIELD.secondAt);
  gl.uniform2f(loc.secScale, ...FIELD.secondScale);

  return {
    draw(frame) {
      const { tokens } = frame;
      gl.uniform1f(loc.t, frame.orange);
      gl.uniform1f(loc.tw, frame.weather);
      gl.uniform1f(loc.warp, frame.warp);
      gl.uniform1f(loc.aspect, canvas.width / Math.max(1, canvas.height));
      gl.uniform1f(loc.sec, tokens.dark ? FIELD.second.dark : FIELD.second.light);
      gl.uniform3f(loc.top, ...tokens.top);
      gl.uniform3f(loc.bottom, ...tokens.bottom);
      gl.uniform3f(loc.glow, ...tokens.glow);
      gl.uniform3f(loc.second, ...tokens.second);
      gl.uniform3f(loc.paper, ...tokens.paper);
      gl.uniform1f(loc.intensity, frame.intensity);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize(width, height) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // No loseContext here: a dev remount (StrictMode) asks the same canvas
      // for its context again, and a lost one would fail every later call.
    },
  };
}
