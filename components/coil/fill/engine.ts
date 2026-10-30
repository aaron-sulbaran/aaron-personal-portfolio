import { Vector2, type Scene, type WebGLRenderTarget } from "three";
import { budgetFor, type InputDriver } from "@/lib/coil/drivers";
import { COIL } from "@/lib/coil/constants";
import { OPEN_ALL } from "@/lib/coil/entrance";
import { FIELD } from "@/lib/coil/field.glsl";
import { NAME_ONLY_FRAG } from "@/lib/coil/nameCanvas.glsl";
import { readCoilTheme, watchTheme } from "@/lib/coil/theme";
import { readDebugFlags } from "../scene/debug";
import { createField, type Field } from "../scene/field";
import { createGlyphTargets } from "../scene/name";
import { createNameSurface, type NameSurface } from "../scene/nameSurface";
import { createPasses, createRenderer, type Gl } from "../scene/renderer";
import { createSceneState, type LoopLink, type SceneCtx } from "../scene/state";
import type { CoilSceneProps } from "../scene/types";

// The fill: the shader field inside a heading's letters, moving, with the
// grainy sheen the cursor stirs. Page 1's name was the first to wear it (hero
// rework, slice 4d); every numbered page's title wears it too, from this one
// engine, so the four can never drift apart (Aaron, 2026-10-29).
//
// One canvas a heading, on a renderer of its own, made from the Coil scene's
// own parts and run on a stub of its context: the field pass (the same shader,
// clocks and --shader tokens), the lit surface with the pointer's wake
// (scene/nameSurface.ts), the per-letter reduction (scene/glyphReduction.ts)
// and the composite cut down to the letters (lib/coil/nameCanvas.glsl.ts), so
// the field is drawn only inside the letterforms and the canvas is clear
// everywhere else. Same uniforms, same theme colours, same sheen. What differs
// is only the lettering: where the letters are and how the fill takes over
// from the page's own text (the name: scene/name.ts and the loader's landing;
// a title: ./title.ts, from the DOM's own layout).
//
// A fine pointer's movement over the page stirs the sheen (the wake); a coarse
// pointer leaves it to the slow drift of the surface's own clock. It draws
// only while it is on screen, the tab is showing and nothing has paused it.
// It lives in the Coil's dynamic chunk family (components/coil/sceneChunk.ts),
// so three never reaches the page's own bundle. Reduced motion mounts none of
// this: the page's CSS fallback is the heading then.

export type FillHooks = {
  onFirstFrame: () => void;
  onContextLost: () => void;
  onError: (error: unknown) => void;
};

// What a lettering is made from.
export type FillParts = {
  ctx: SceneCtx;
  gl: Gl;
  field: Field;
  surface: NameSurface;
  glyphTargets: [WebGLRenderTarget, WebGLRenderTarget];
  loop: LoopLink;
};

// Where the letters are and how they come in: the name's or a title's.
export type Lettering = {
  // What it waits for before the first frame (the face it is painted from).
  ready: () => Promise<void>;
  // Lays the letters out at the canvas's size (the renderer is sized).
  layout: () => void;
  // After the field's and the surface's theme: its own colours.
  applyTheme?: () => void;
  // Each frame, in the scene's order: the fades, the surface's clock and wake,
  // then (after the field) the surface and the per-letter reduction.
  fade: (now: number) => void;
  step: (dt: number) => void;
  renderSurface: (dt: number) => void;
  // Its own passes, compiled with the rest before the first frame.
  scenes: () => Scene[];
  // Elements whose size moves the letters without resizing the canvas.
  observe: () => Element[];
  dispose: () => void;
};

export type FillOptions = {
  // Compile every program off the main thread (KHR_parallel_shader_compile)
  // before the first frame, so a canvas made mid-scroll never stalls a frame.
  compileAsync: boolean;
};

export type FillStats = { frames: number; running: boolean; paused: boolean; size: [number, number]; clock: number; wakeActive: boolean };

export type FillRuntime = {
  // Lays out again at the canvas's size now (the page reflowed).
  relayout: () => void;
  // Holds the loop (page 2's title while the deal plays); the last frame stays.
  setPaused: (paused: boolean) => void;
  // Releases everything, the WebGL context included (a lost context: the canvas is done).
  dispose: () => void;
  stats: () => FillStats;
};

export function startFill<L extends Lettering>(
  canvas: HTMLCanvasElement,
  makeLettering: (parts: FillParts) => L,
  hooks: FillHooks,
  options: FillOptions,
): FillRuntime & { lettering: L } {
  const flags = readDebugFlags();
  const fine = window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
  const input: InputDriver = fine ? "fine" : "coarse";
  const renderer = createRenderer(canvas);
  const gl = createPasses(renderer);
  const st = createSceneState(readCoilTheme(), budgetFor(input), 0);
  st.open = { cx: 0, cy: 0, radius: OPEN_ALL, feather: 1 };
  const live = { current: { frozen: false, interactive: false, input, overlay: { current: null }, onFirstFrame() {}, onContextLost() {}, onError() {} } as CoilSceneProps };
  const ctx: SceneCtx = { host: canvas, canvas, live, tiles: [], tileCount: 0, flags, debug: null, flightLog: null, st };
  let frames = 0;
  let raf = 0;
  let visible = true;
  let paused = false;
  let lastTime = performance.now();
  let disposed = false;

  const loop: LoopLink = {
    wake: () => wake(),
    stop: () => stop(),
    renderStill: () => drawStill(),
    shouldRun: () => running(),
    update: () => {},
    render: (dt) => draw(dt),
  };

  const surface = createNameSurface(ctx, gl);
  const glyphTargets = createGlyphTargets();
  const field = createField(ctx, gl, { surface: surface.texture, wake: surface.wakeUniforms, glyph: glyphTargets[0].texture }, NAME_ONLY_FRAG);
  const lettering = makeLettering({ ctx, gl, field, surface, glyphTargets, loop });
  const { view, pointer } = st;

  function running() {
    return st.ready && !disposed && !st.contextLost && visible && !paused && !document.hidden;
  }

  function applyTheme() {
    field.applyTheme();
    surface.applyTheme();
    lettering.applyTheme?.();
    st.lastFieldTime = Number.NaN;
  }

  // The canvas's size in CSS px is its layout box (the page's CSS sizes it).
  function layout() {
    const rect = canvas.getBoundingClientRect();
    view.width = Math.max(1, canvas.clientWidth || rect.width);
    view.height = Math.max(1, canvas.clientHeight || rect.height);
    view.dpr = Math.min(window.devicePixelRatio || 1, st.budget.dprCap);
    renderer.setPixelRatio(view.dpr);
    renderer.setSize(view.width, view.height, false);
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    gl.uView.value.set(0, 0, 1 / buffer.x, 1 / buffer.y);
    gl.fieldTarget.setSize(Math.max(8, Math.round(view.width / FIELD.divisor)), Math.max(8, Math.round(view.height / FIELD.divisor)));
    field.resizePasses(buffer);
    st.lastFieldTime = Number.NaN;
    lettering.layout();
  }

  // The pointer, in the canvas's own px (page scroll moves the canvas under a still pointer, and a still pointer is no stroke: the wake works from client px).
  function updatePointerLocal() {
    if (!pointer.known) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = pointer.clientX - rect.left;
    pointer.y = pointer.clientY - rect.top;
    pointer.inside = true;
  }
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.known = true;
    updatePointerLocal();
    wake();
  };
  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    pointer.known = false;
    pointer.inside = false;
  };

  function draw(dt: number) {
    const now = performance.now();
    updatePointerLocal();
    lettering.fade(now);
    lettering.step(dt);
    field.field({ dt });
    lettering.renderSurface(dt);
    field.composite();
    frames += 1;
    if (frames === 1) hooks.onFirstFrame();
  }

  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max(now - lastTime, 0) / 1000, COIL.lab.maxFrameSeconds);
    lastTime = now;
    try {
      draw(dt);
    } catch (error) {
      stop();
      hooks.onError(error);
    }
  }

  function wake() {
    if (raf || !running()) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // One frame outside the loop (a resize, a theme change off screen), so the canvas never shows a stretched stale buffer.
  function drawStill() {
    if (!st.ready || disposed || st.contextLost) return;
    draw(0);
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!st.ready || disposed) return;
    layout();
    if (!raf) drawStill();
  });
  resizeObserver.observe(canvas);
  for (const el of lettering.observe()) resizeObserver.observe(el);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    wake();
  });
  intersection.observe(canvas);
  const onVisibility = () => wake();
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLost = (event: Event) => {
    event.preventDefault();
    st.contextLost = true;
    stop();
    hooks.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  if (fine) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut);
  }
  const stopWatchingTheme = watchTheme((next) => {
    st.theme = next;
    applyTheme();
    if (!raf) drawStill();
    wake();
  });

  // Every program compiled before the first frame, off the main thread where
  // the browser can (three's compileAsync polls KHR_parallel_shader_compile).
  async function compile() {
    if (!options.compileAsync) return;
    const camera = gl.orthoCamera;
    await Promise.all([gl.fieldScene, gl.surfaceScene, gl.compScene, ...lettering.scenes()].map((scene) => renderer.compileAsync(scene, camera)));
  }

  // The face first: the letters are painted from it.
  st.nameFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
  void lettering
    .ready()
    .then(() => {
      if (disposed) return;
      applyTheme();
      return compile();
    })
    .then(() => {
      if (disposed || st.contextLost) return;
      st.ready = true;
      layout();
      draw(0);
      wake();
    })
    .catch((error) => {
      if (!disposed) hooks.onError(error);
    });

  return {
    lettering,
    relayout() {
      if (!st.ready || disposed) return;
      layout();
      if (!raf) drawStill();
    },
    setPaused(next) {
      if (paused === next) return;
      paused = next;
      if (paused) stop();
      else wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      stopWatchingTheme();
      lettering.dispose();
      field.dispose();
      gl.quad.dispose();
      gl.fieldTarget.dispose();
      gl.surfaceTarget.dispose();
      renderer.dispose();
      // The context goes with the canvas: a title far away holds none.
      renderer.forceContextLoss();
    },
    stats: () => ({
      frames,
      running: raf !== 0,
      paused,
      size: [view.width, view.height],
      clock: surface.state().clock,
      wakeActive: surface.state().wakeActive,
    }),
  };
}
