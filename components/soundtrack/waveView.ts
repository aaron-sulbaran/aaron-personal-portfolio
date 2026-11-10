import { columnWeights, type Rect } from "@/lib/waveform/weights";
import { dotReach, runColumns, type PathColumns } from "@/lib/wavepath/columns";
import { chaseLevel, sweepLevel, tailAtLevel } from "@/lib/wavepath/bandSweep";
import { ALPHAS, BAND_SWEEP_S, RELEASE_LINE, RUN_START, SPACING, TRAIN_FADE } from "@/lib/wavepath/constants";
import { rippleFit } from "@/lib/wavepath/fit";
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
// The run leaves with the scroll past the release line and comes back with it
// (lib/wavepath/bandSweep), so it paints while the band is on screen at all.
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
  let fit: Float32Array | null = null;
  let width = 0, height = 0, amp = 0, canvasTop = 0, viewport = 0, active = false, measureRaf = 0;
  let originS: number | null = null;
  let alphas = ALPHAS[themeNow()];
  let bandTop = 0, bandBottom = 0; // the band's edges on the page
  let level = 0; // how far the scroll has swept the run off now, 0 whole to 1 gone; it chases the scroll's level
  let drawnLevel = NaN; // the level of the last draw
  const scrollLevel = (scrollY: number) => sweepLevel(bandBottom - scrollY, RELEASE_LINE * viewport);
  // Reduced motion has no train and keeps the run whole.
  const sweeps = () => conductor.frame.train !== null;

  const draw = (f: WaveFrame) => {
    ctx.clearRect(0, 0, width, height);
    clearSink(sink);
    sink.viewTop = f.scrollY - canvasTop;
    sink.viewBottom = sink.viewTop + viewport;
    sink.width = width;
    sink.onScreen = 0;
    drawnLevel = level;
    // The band's run leaves with the scroll, never with the head's train: the train comes back at the head's calm pace, which left
    // the band sitting empty for seconds on the way back up (the band lab, 2026-11-10).
    const tail = f.tail;
    f.tail = f.train === null ? -Infinity : tailAtLevel(level, f.runLen, f.train * TRAIN_FADE);
    buildPathDots(cols, all, 0, cols.count, f, amp, 0, -Infinity, f.runLen || Infinity, weights, sink, fit);
    f.tail = tail;
    painter.fill(sink.muted, painter.colors.muted, alphas.muted);
    painter.fill(sink.accent, painter.colors.accent, alphas.accent);
    ctx.globalAlpha = 1;
    if (probe) probe.paints++;
  };

  const view: WaveViewHandle = {
    breathes: !still,
    prepare(f) {
      // Once a step: the sweep moves toward where the scroll has the band, no faster than BAND_SWEEP_S for a whole sweep.
      if (f.train !== null) level = chaseLevel(level, scrollLevel(f.scrollY), f.dt, BAND_SWEEP_S);
      if (f.pointer.moved && active) nearestColumn(cols, f.pointer.x, f.pointer.y + f.scrollY - canvasTop, f.head, f.tail, f.near);
    },
    paint(f, changed: Changed | null) {
      if (changed && level === drawnLevel && !changed.head && !changed.music && !changed.breath && !changed.plucks && !changed.ripple) return;
      draw(f);
    },
    // In view by the band's observer (below the dock line), or on screen at all while the sweep is taking the run off: above the dock
    // line the band counts as passed, and a run left part drawn there would hold still until it scrolled away.
    active: () => active || (sweeps() && bandBottom > conductor.frame.scrollY && bandTop < conductor.frame.scrollY + viewport),
    busy: () => sweeps() && level !== scrollLevel(conductor.frame.scrollY),
    rippleOrigin: () => originS ?? conductor.frame.runLen / 2,
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
    const bandBox = (host.closest<HTMLElement>("#listen") ?? host.closest("section"))?.getBoundingClientRect();
    bandTop = bandBox ? bandBox.top + window.scrollY : 0;
    bandBottom = bandBox ? bandBox.bottom + window.scrollY : 0;
    level = scrollLevel(window.scrollY); // a fresh layout lands where the scroll has it, with no sweep
    const rects: Rect[] = [];
    host.closest("section")?.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) rects.push({ left: r.left - origin.left - AVOID_PAD, right: r.right - origin.left + AVOID_PAD, top: r.top - origin.top - AVOID_PAD, bottom: r.bottom - origin.top + AVOID_PAD });
    });
    rects.push({ left: -1e6, right: 1e6, top: -1e6, bottom: 0 }, { left: -1e6, right: 1e6, top: height, bottom: 1e6 });
    // The ripple starts under the answer buttons: their horizontal centre, as the run's arc.
    const buttons = host.closest("section")?.querySelector<HTMLElement>("[data-wave-ripple-origin]");
    const box = buttons?.getBoundingClientRect();
    originS = box && box.width ? box.left + box.width / 2 - origin.left - RUN_START : null;
    const layout = { columns: cols.count, startX: cols.x[0] ?? 0, spacing: SPACING, baseline: height / 2, feather: FEATHER, edgeTaper: 0, rects };
    weights = columnWeights({ ...layout, reach: dotReach(amp) });
    fit = rippleFit(layout, amp, fit);
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
  const originEl = host.closest("section")?.querySelector("[data-wave-ripple-origin]");
  if (originEl) resizeObserver.observe(originEl);
  const themeObserver = new MutationObserver(() => {
    painter.readColors();
    alphas = ALPHAS[themeNow()];
    draw(conductor.frame);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return view;
}
