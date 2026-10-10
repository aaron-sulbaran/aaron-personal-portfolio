import { columnWeights, type Rect } from "@/lib/waveform/weights";
import { dotReach, runColumns, type PathColumns } from "@/lib/wavepath/columns";
import { ALPHAS, SPACING } from "@/lib/wavepath/constants";
import { buildPathDots, clearSink, createSink } from "@/lib/wavepath/paint";
import { nearestColumn } from "@/lib/wavepath/pluck";
import { pathProbe } from "@/lib/wavepath/probe";
import { amplitudeFor } from "@/lib/wavepath/visible";
import type { Changed, WaveConductor, WaveFrame, WaveView } from "./waveConductor";
import { createDotPainter, sizeCanvas, themeNow } from "./viewParts";

// The band's view: the line's first stretch, the level run across the band.
// It paints the run's columns (arc s < runLen) on the band's own canvas; the
// path layer paints the rest from the run's right end on the same column grid
// and arc, so the two meet in phase. It keeps the band's copy clear (column
// weights from its own [data-wave-avoid]) and its run breathes while in view.
// Sized from its container, never the viewport.

const AVOID_PAD = 6;
const FEATHER = 48;

export interface WaveViewHandle extends WaveView { setActive(active: boolean): void; destroy(): void }

export function createWaveView(canvas: HTMLCanvasElement, conductor: WaveConductor, still: boolean): WaveViewHandle | null {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  if (!ctx || !host) return null;
  const painter = createDotPainter(ctx);
  const sink = createSink();
  const probe = pathProbe();
  let cols: PathColumns = runColumns(0, 0, SPACING);
  let all = new Int32Array(0);
  let weights: Float32Array = new Float32Array(0);
  let width = 0, height = 0, amp = 0, canvasTop = 0, viewport = 0, active = false, measureRaf = 0;
  let alphas = ALPHAS[themeNow()];

  const draw = (f: WaveFrame) => {
    ctx.clearRect(0, 0, width, height);
    clearSink(sink);
    sink.viewTop = f.scrollY - canvasTop;
    sink.viewBottom = sink.viewTop + viewport;
    sink.width = width;
    sink.onScreen = 0;
    buildPathDots(cols, all, 0, cols.count, f, amp, 0, -Infinity, f.runLen || Infinity, weights, sink);
    painter.fill(sink.muted, painter.colors.muted, alphas.muted);
    painter.fill(sink.accent, painter.colors.accent, alphas.accent);
    ctx.globalAlpha = 1;
    if (probe) probe.paints++;
  };

  const view: WaveViewHandle = {
    breathes: !still,
    prepare(f) {
      if (f.pointer.moved && active) nearestColumn(cols, f.pointer.x, f.pointer.y + f.scrollY - canvasTop, f.head, f.tail, f.near);
    },
    paint(f, changed: Changed | null) {
      if (changed && !changed.head && !changed.music && !changed.breath && !changed.plucks) return;
      draw(f);
    },
    active: () => active,
    countVisible(f) {
      draw(f);
      return active ? sink.onScreen : 0;
    },
    setActive(next) {
      active = next;
      // A band that was off screen when the page loaded has ink as it comes into view.
      if (next) draw(conductor.frame);
      conductor.wake();
    },
    destroy() {
      if (measureRaf) cancelAnimationFrame(measureRaf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    },
  };

  const measure = () => {
    measureRaf = 0;
    width = host.clientWidth;
    height = host.clientHeight;
    sizeCanvas(canvas, ctx, width, height);
    amp = amplitudeFor(width);
    cols = runColumns(width, height / 2, SPACING);
    all = Int32Array.from({ length: cols.count }, (_, j) => j);
    const origin = canvas.getBoundingClientRect();
    canvasTop = origin.top + window.scrollY;
    viewport = window.innerHeight;
    const rects: Rect[] = [];
    host.closest("section")?.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) rects.push({ left: r.left - origin.left - AVOID_PAD, right: r.right - origin.left + AVOID_PAD, top: r.top - origin.top - AVOID_PAD, bottom: r.bottom - origin.top + AVOID_PAD });
    });
    rects.push({ left: -1e6, right: 1e6, top: -1e6, bottom: 0 }, { left: -1e6, right: 1e6, top: height, bottom: 1e6 });
    weights = columnWeights({ columns: cols.count, startX: cols.x[0] ?? 0, spacing: SPACING, baseline: height / 2, reach: dotReach(amp), feather: FEATHER, edgeTaper: 0, rects });
    if (probe) probe.layouts++;
    draw(conductor.frame);
  };
  const scheduleMeasure = () => {
    if (!measureRaf) measureRaf = requestAnimationFrame(measure);
  };

  painter.readColors();
  measure();
  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(host);
  const themeObserver = new MutationObserver(() => {
    painter.readColors();
    alphas = ALPHAS[themeNow()];
    draw(conductor.frame);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return view;
}
