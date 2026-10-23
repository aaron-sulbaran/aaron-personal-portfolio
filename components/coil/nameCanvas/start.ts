import { Vector2 } from "three";
import type { NameTarget } from "@/lib/coil/nameTarget";
import { budgetFor, type InputDriver } from "@/lib/coil/drivers";
import { COIL } from "@/lib/coil/constants";
import { OPEN_ALL } from "@/lib/coil/entrance";
import { FIELD } from "@/lib/coil/field.glsl";
import { NAME_ONLY_FRAG } from "@/lib/coil/nameCanvas.glsl";
import { readCoilTheme, watchTheme } from "@/lib/coil/theme";
import { PROFA } from "@/lib/home/lockup";
import { readDebugFlags } from "../scene/debug";
import { createField } from "../scene/field";
import { createGlyphTargets, createName, type NamePlacement } from "../scene/name";
import { createNameSurface } from "../scene/nameSurface";
import { createPasses, createRenderer } from "../scene/renderer";
import { createSceneState, type LoopLink, type SceneCtx } from "../scene/state";
import type { CoilSceneProps } from "../scene/types";

// The page's name, drawn in its own small canvas (hero rework, slice 4d). The
// Coil's stage belongs to page 2 after the deal, so the name cannot live on it;
// instead this is the scene's name layer on a renderer of its own, made from the
// scene's own parts and run on a stub of the scene's context: the field pass
// (the same shader and the same clocks, the same --shader tokens), the lit
// surface with the pointer's wake (nameSurface.ts), the per-letter reduction and
// the loader's landing (name.ts), and the composite's fragment cut down to the
// letters (lib/coil/nameCanvas.glsl.ts), so the field is drawn only inside the
// letterforms and the canvas is clear everywhere else. Same uniforms, same theme
// colours, same sheen. A fine pointer's movement over the page stirs the sheen
// (the wake); a coarse pointer leaves it to the slow drift of the surface's
// own clock. It draws only while it is on screen and the tab is showing.
//
// It lives in the Coil's dynamic chunk family (components/home/NameCanvas.tsx
// imports it with import()), so three never reaches the page's own bundle.
// Reduced motion mounts none of this: the page's CSS fallback is the name then.

// Where the lockup sits in the canvas: the page's own h1 ([data-coil-name], whose
// [data-lockup-name] line is "Aaron") said where, as in the loader's landing.
function placeName(canvas: HTMLElement): NamePlacement | null {
  const heading = document.querySelector<HTMLElement>("[data-coil-name]");
  const line = heading?.querySelector<HTMLElement>("[data-lockup-name]");
  if (!heading || !line) return null;
  const size = parseFloat(getComputedStyle(heading).fontSize);
  const stage = canvas.getBoundingClientRect();
  const rect = line.getBoundingClientRect();
  if (!(size > 0) || rect.width <= 0) return null;
  return { left: rect.left - stage.left, baseline: rect.top - stage.top + PROFA.base * size, size };
}

export type NameCanvasHooks = {
  onFirstFrame: () => void;
  onContextLost: () => void;
  onError: (error: unknown) => void;
};

export type NameCanvasRuntime = {
  // The lockup in viewport px for the loader to land on; null until laid out.
  nameRect: () => NameTarget | null;
  // Shows the lockup now, drawing this frame synchronously (the loader goes in the same task).
  landName: () => boolean;
  // Lays out again at the canvas's size now (the page reflowed).
  relayout: () => void;
  dispose: () => void;
  // QA: frames drawn, and whether it is running.
  stats: () => { frames: number; running: boolean; landed: boolean; size: [number, number] };
};

export function startNameCanvas(canvas: HTMLCanvasElement, hooks: NameCanvasHooks): NameCanvasRuntime {
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
  const name = createName(ctx, gl, field.compMaterial, surface, glyphTargets, loop);
  const { view, pointer } = st;

  function running() {
    return st.ready && !disposed && !st.contextLost && visible && !document.hidden;
  }

  function applyTheme() {
    field.applyTheme();
    surface.applyTheme();
    st.lastFieldTime = Number.NaN;
  }

  // The canvas's size in CSS px is its layout box: the name's own lockup box and its reach (app/globals.css).
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
    name.layoutName(placeName(canvas));
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
    name.entranceFade({ now, nameFromLoader: false });
    name.step({ dt, listProgress: 0 });
    field.field({ dt });
    name.renderSurface({ dt });
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
    if (!st.ready) return;
    layout();
    if (!raf) drawStill();
  });
  resizeObserver.observe(canvas);
  const heading = document.querySelector("[data-coil-name]");
  if (heading) resizeObserver.observe(heading);
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

  // The face first: the lockup is painted from it.
  st.nameFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
  void Promise.race([document.fonts.load(`900 100px ${st.nameFamily}`).then(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, 6000))])
    .then(() => {
      if (disposed) return;
      applyTheme();
      st.ready = true;
      layout();
      draw(0);
      wake();
    })
    .catch((error) => {
      if (!disposed) hooks.onError(error);
    });

  return {
    nameRect: name.nameRect,
    landName: name.landName,
    relayout() {
      if (!st.ready || disposed) return;
      layout();
      if (!raf) drawStill();
    },
    dispose() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      stopWatchingTheme();
      name.dispose();
      field.dispose();
      gl.quad.dispose();
      gl.fieldTarget.dispose();
      gl.surfaceTarget.dispose();
      renderer.dispose();
    },
    stats: () => ({ frames, running: raf !== 0, landed: name.landed(), size: [view.width, view.height] }),
  };
}
