import { buildDots, carveTargets, reachOf, type Cursor } from "@/lib/waveform/dots";
import { PHONE_MAX_PX, bandLayout } from "@/lib/waveform/layout";
import { blendWeights, columnWeights, type Rect, type WeightLayout } from "@/lib/waveform/weights";
import type { WaveConductor, WaveView } from "./waveConductor";
import { createDotPainter, sizeCanvas, themeNow, trackPointer, type Alphas } from "./viewParts";

// One canvas that paints the conductor's field: sizing, weights, colors, the
// cursor and the dots. The conductor (waveConductor.ts) owns the field and the
// loop; a view only measures, feeds its cursor carve in and paints. This file
// is the band's view.
//
// The canvas fills its parent and is sized by a ResizeObserver, never the
// viewport. `still` (reduced motion) draws one flat line and takes no cursor.

const AVOID_PAD = 6; // px of air kept between the copy and the nearest dot
const FEATHER = 48;

export interface ViewOptions {
  kind: "band";
  still: boolean;
  avoidRoot: ParentNode; // where [data-wave-avoid] is queried
  alphas: Alphas | ((theme: "light" | "dark") => Alphas);
}

export interface WaveViewHandle extends WaveView {
  setActive(active: boolean): void;
  destroy(): void;
}

export function createWaveView(canvas: HTMLCanvasElement, conductor: WaveConductor, options: ViewOptions): WaveViewHandle | null {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  if (!ctx || !host) return null;
  const { still, avoidRoot } = options;

  let layout = bandLayout(0, 0);
  let weights: Float32Array = new Float32Array(0);
  let calmWeights: Float32Array = new Float32Array(0);
  let loudWeights: Float32Array = new Float32Array(0);
  let carve: Float32Array = new Float32Array(0);
  const carveLayout = { ...layout };
  const muted: number[] = [];
  const accent: number[] = [];
  const painter = createDotPainter(ctx);
  let alphas: Alphas = { muted: 0.55, accent: 0.9 };
  const cursor: Cursor = { x: -1e4, y: -1e4, on: false };
  let width = 0;
  let height = 0;
  let active = false;
  let measureRaf = 0;

  const readColors = () => {
    painter.readColors();
    alphas = typeof options.alphas === "function" ? options.alphas(themeNow()) : options.alphas;
  };

  const paint = (time: number) => {
    ctx.clearRect(0, 0, width, height);
    buildDots(conductor.field, layout, time, weights, cursor, muted, accent);
    painter.fill(muted, painter.colors.muted, alphas.muted);
    painter.fill(accent, painter.colors.accent, alphas.accent);
    ctx.globalAlpha = 1;
  };

  const syncCursor = () => {
    if (!pointer.on) {
      cursor.on = false;
      return;
    }
    const origin = canvas.getBoundingClientRect();
    cursor.x = pointer.x - origin.left;
    cursor.y = pointer.y - origin.top;
    cursor.on = cursor.y > -layout.maxAmp && cursor.y < height + layout.maxAmp;
  };

  const { pointer, dispose: disposePointer } = trackPointer(!still && window.matchMedia("(pointer: fine)").matches, () =>
    conductor.wake(),
  );

  const view: WaveViewHandle = {
    // Before the field steps: the weights follow the field's levels as they
    // stood, and this view's carve targets raise the shared carve.
    prepare() {
      syncCursor();
      blendWeights(calmWeights, loudWeights, conductor.field.levels.reactive, weights);
      if (!cursor.on) return;
      carveTargets(carveLayout, cursor, carve);
      const shared = conductor.carve;
      for (let i = 0; i < carve.length && i < shared.length; i++) if (carve[i] > shared[i]) shared[i] = carve[i];
    },
    paint,
    active: () => active,
    // The band has nothing easing of its own: the carve eases inside the
    // field and settles with it, so a cursor resting on a still line lets
    // the loop stop, as it always has.
    busy: () => false,
    setActive(next) {
      active = next;
      conductor.wake();
    },
    destroy() {
      if (measureRaf) cancelAnimationFrame(measureRaf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      disposePointer();
    },
  };

  const measure = () => {
    measureRaf = 0;
    width = host.clientWidth;
    height = host.clientHeight;
    sizeCanvas(canvas, ctx, width, height);

    layout = bandLayout(width, height);
    conductor.setColumns(layout.columns, view);
    carve = new Float32Array(layout.columns);
    Object.assign(carveLayout, layout);

    const origin = canvas.getBoundingClientRect();
    const rects: Rect[] = [];
    avoidRoot.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rects.push({
        left: r.left - origin.left - AVOID_PAD,
        right: r.right - origin.left + AVOID_PAD,
        top: r.top - origin.top - AVOID_PAD,
        bottom: r.bottom - origin.top + AVOID_PAD,
      });
    });
    // The band's own top and bottom edges count as boxes too, so the loudest
    // music scales to fit the band instead of clipping at its edges.
    rects.push({ left: -1e6, right: 1e6, top: -1e6, bottom: 0 }, { left: -1e6, right: 1e6, top: height, bottom: 1e6 });
    const base: Omit<WeightLayout, "reach"> = {
      ...layout,
      feather: FEATHER,
      edgeTaper: width <= PHONE_MAX_PX ? 24 : 96,
      rects,
    };
    calmWeights = columnWeights({ ...base, reach: reachOf(layout.maxAmp, "calm") });
    loudWeights = columnWeights({ ...base, reach: reachOf(layout.maxAmp, "loud") });
    weights = new Float32Array(layout.columns);
    blendWeights(calmWeights, loudWeights, conductor.field.levels.reactive, weights);
    // Repaint at once so a resize never leaves the canvas blank while paused.
    paint(conductor.time);
  };

  const scheduleMeasure = () => {
    if (!measureRaf) measureRaf = requestAnimationFrame(measure);
  };

  readColors();
  measure();

  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(host);
  avoidRoot.querySelectorAll("[data-wave-avoid]").forEach((el) => resizeObserver.observe(el));

  // A repaint at the last stepped time; if the loop is running, its next
  // frame paints the same field again in the new colors.
  const themeObserver = new MutationObserver(() => {
    readColors();
    paint(conductor.time);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return view;
}
