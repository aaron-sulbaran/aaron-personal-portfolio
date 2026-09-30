import {
  Color,
  LinearFilter,
  LinearSRGBColorSpace,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { COIL } from "@/lib/coil/constants";
import { FIELD } from "@/lib/coil/field.glsl";
import { cameraFor, solveGeometry } from "@/lib/coil/geometry";
import { seenRingDpr } from "@/lib/coil/material";
import { disableColorManagement } from "@/lib/coil/theme";
import type { LoopLink, SceneCtx } from "./state";

// The renderer and what every pass draws with: the scene canvas's WebGL
// renderer (linear output, no color management, so token hex maps 1:1), the
// two cameras, the three scenes, the field's render target, the shared
// fullscreen quad. Also the layout (sized from the host, never the viewport),
// its resize observer, and the lost context.

export type Gl = {
  renderer: WebGLRenderer;
  orthoCamera: OrthographicCamera;
  camera: PerspectiveCamera;
  fieldScene: Scene;
  compScene: Scene;
  cardScene: Scene;
  fieldTarget: WebGLRenderTarget;
  // The scene canvas's buffer origin and texel size, read by the composite and the cards.
  uView: { value: Vector4 };
  quad: PlaneGeometry;
};

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  disableColorManagement();
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(new Color(0, 0, 0), 0);
  renderer.autoClear = false;
  return renderer;
}

export function createPasses(renderer: WebGLRenderer): Gl {
  return {
    renderer,
    orthoCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    camera: new PerspectiveCamera(COIL.camera.fovDeg, 1, 0.1, 100),
    fieldScene: new Scene(),
    compScene: new Scene(),
    cardScene: new Scene(),
    fieldTarget: new WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }),
    uView: { value: new Vector4(0, 0, 1, 1) },
    quad: new PlaneGeometry(2, 2),
  };
}

// Slice 7: a rotation (or a resize across the narrow line) rebuilds the whole
// frame; the cards and the name fade back in over REBUILD_FADE_MS (entrance.ts).
const REBUILD_WIDTH_CHANGE = 0.2;

export type LayoutParts = {
  // The field and composite uniforms that follow the size.
  resizePasses: (buffer: Vector2) => void;
  ensureSlots: (count: number) => void;
  layoutName: () => void;
};

export function createLayout(ctx: SceneCtx, gl: Gl, parts: LayoutParts, loop: LoopLink) {
  const { st, host, tileCount, debug } = ctx;
  const { renderer, camera, fieldTarget, uView } = gl;

  return function layout(width: number, height: number) {
    st.view.width = Math.max(1, width);
    st.view.height = Math.max(1, height);
    st.view.dpr = Math.min(window.devicePixelRatio || 1, st.budget.dprCap);
    const rect = host.getBoundingClientRect();
    st.view.docTop = rect.top + window.scrollY;
    st.view.docLeft = rect.left + window.scrollX;
    renderer.setPixelRatio(st.view.dpr);
    renderer.setSize(st.view.width, st.view.height, false);
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    uView.value.set(0, 0, 1 / buffer.x, 1 / buffer.y);
    camera.aspect = st.view.width / st.view.height;
    st.geoCamera = cameraFor(st.view);
    camera.position.set(0, 0, st.geoCamera.distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    fieldTarget.setSize(
      Math.max(8, Math.round(st.view.width / FIELD.divisor)),
      Math.max(8, Math.round(st.view.height / FIELD.divisor)),
    );
    parts.resizePasses(buffer);
    seenRingDpr.value = buffer.y / st.view.height; // fx-hero: the seen ring stays one CSS px wide
    st.lastFieldTime = Number.NaN;
    const before = st.geo;
    st.geo = solveGeometry(st.view, tileCount);
    // Slice 7: a new composition or a rotation lays every card out afresh;
    // fade the new frame in rather than jump (only while the loop runs: a
    // still frame behind a modal just re-lays out).
    if (
      before &&
      loop.shouldRun() &&
      (before.narrow !== st.geo.narrow ||
        Math.abs(st.view.width - before.viewport.width) > REBUILD_WIDTH_CHANGE * before.viewport.width)
    ) {
      st.rebuildAt = performance.now();
    }
    parts.ensureSlots(st.geo.slotCount);
    st.poses.length = st.geo.slotCount;
    st.rendered.length = st.geo.slotCount;
    if (debug) debug.geo = st.geo;
    parts.layoutName();
  };
}

// The host's size, as the ResizeObserver reports it: laid out at once once
// the scene is ready (a still frame when the loop is not running), else held
// for the boot's first layout.
export function observeResize(ctx: SceneCtx, layout: (width: number, height: number) => void, loop: LoopLink) {
  const { st, host } = ctx;
  const resizeObserver = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (!box) return;
    st.pendingSize = { width: box.width, height: box.height };
    if (!st.ready) return;
    layout(box.width, box.height);
    if (!st.raf) loop.renderStill();
  });
  resizeObserver.observe(host);
  return () => resizeObserver.disconnect();
}

// A lost context stops the loop; CoilStage shows the poster and remounts once.
export function watchContext(ctx: SceneCtx, loop: LoopLink) {
  const { st, canvas, live } = ctx;
  const onContextLost = () => {
    st.contextLost = true;
    loop.stop();
    live.current.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  return () => canvas.removeEventListener("webglcontextlost", onContextLost);
}
