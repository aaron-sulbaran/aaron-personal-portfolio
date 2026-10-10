// The footer field's WebGL 2 plumbing: compile, link, the context and the
// fullscreen triangle every pass draws (position at attribute 0). Raw WebGL
// 2, no three (three lives only in the CoilScene chunk). This folder is the
// footer field's chunk: only components/footer/FooterField.tsx imports it,
// and only through import().

export type Program<U extends string> = {
  u: (name: U) => WebGLUniformLocation | null;
  use: () => void;
  dispose: () => void;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("[footer field] shader:", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

// A program over the fullscreen triangle whose uniform lookup takes only the
// names its pass declares (lib/footer/shaders.ts UNIFORMS).
export function link<U extends string>(gl: WebGL2RenderingContext, vert: string, frag: string): Program<U> | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[footer field] program:", gl.getProgramInfoLog(program));
    return null;
  }
  const cache = new Map<U, WebGLUniformLocation | null>();
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

// One context, or null (no WebGL 2, a blocklisted GPU, a lost context).
export function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
    return gl && !gl.isContextLost() ? gl : null;
  } catch {
    return null;
  }
}

export function fullscreenTriangle(gl: WebGL2RenderingContext): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}
