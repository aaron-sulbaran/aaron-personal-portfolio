import { DPR_CAP } from "@/lib/waveform/layout";
import { EMPTY_COLUMNS, layColumns, mapTiles, tileReach, type PathColumns, type TileMap } from "@/lib/wavepath/columns";
import { ALPHAS, SAMPLE_STEP, SPACING, TILE_MARGIN_PX, TILE_PX } from "@/lib/wavepath/constants";
import { sampleSpine, type SpineSamples } from "@/lib/wavepath/geometry";
import { HEAD_PARAMS, firstOnScreenY, gatedTarget, headTarget, runFlatness, runLength } from "@/lib/wavepath/head";
import { buildPathDots, clearSink, createSink } from "@/lib/wavepath/paint";
import { nearestColumn } from "@/lib/wavepath/pluck";
import { pathProbe } from "@/lib/wavepath/probe";
import { SIGNATURE_ON, resolveSpine } from "@/lib/wavepath/spine";
import { amplitudeFor, chooseTrain, visibleOptions } from "@/lib/wavepath/visible";
import { createDotPainter, themeNow } from "../viewParts";
import type { Changed, WaveConductor, WaveFrame, WaveView } from "../waveConductor";
import type { Anchors } from "@/lib/wavepath/spine";
import { docTop, measureAnchors } from "./measure";

type Tile = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; painter: ReturnType<typeof createDotPainter>; top: number; height: number; visible: boolean };

// The line below the band: canvas tiles at most TILE_PX tall in an in-flow
// layer behind the sections (z -1 in the content's stacking context), so
// native scrolling carries it. A tile owns a bitmap only near the viewport,
// and repaints only when the frame changed. Geometry is laid out on resize,
// on a section's reflow and when the fonts land; never per frame.
export function createPathView(layer: HTMLElement, root: HTMLElement, conductor: WaveConductor): WaveView & { destroy(): void } {
  const tiles: Tile[] = [];
  const sink = createSink();
  const probe = pathProbe();
  let cols: PathColumns = EMPTY_COLUMNS;
  let map: TileMap = mapTiles(EMPTY_COLUMNS, TILE_PX, 0, 0);
  let samples: SpineSamples | null = null;
  let measured: Anchors | null = null;
  let origin = 0, viewport = 0, maxScrollY = 0, entry = 0, amp = 0, width = 0, raf = 0, innerWidth = 0, runLen = 0, runFlat = 0;
  let dirty = true, laid = false, destroyed = false;
  let alphas = ALPHAS[themeNow()];

  const sizeTile = (tile: Tile) => {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = tile.visible ? Math.round(width * dpr) : 0;
    const h = tile.visible ? Math.round(tile.height * dpr) : 0;
    if (tile.canvas.width !== w || tile.canvas.height !== h) {
      tile.canvas.width = w;
      tile.canvas.height = h;
    }
    if (tile.visible) tile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const tile = tiles.find((t) => t.canvas === e.target);
      if (!tile) continue;
      tile.visible = e.isIntersecting;
      sizeTile(tile);
    }
    dirty = true;
    conductor.wake();
  }, { rootMargin: `${TILE_MARGIN_PX}px 0px` });

  const syncTiles = (height: number) => {
    const count = Math.max(1, Math.ceil(height / TILE_PX));
    while (tiles.length > count) {
      const t = tiles.pop()!;
      io.unobserve(t.canvas);
      t.canvas.remove();
    }
    while (tiles.length < count) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:absolute;left:0;width:100%;display:block";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const painter = createDotPainter(ctx);
      painter.readColors();
      tiles.push({ canvas, ctx, painter, top: 0, height: 0, visible: false });
      layer.appendChild(canvas);
      io.observe(canvas);
    }
    tiles.forEach((t, i) => {
      t.top = i * TILE_PX;
      t.height = Math.max(1, Math.min(TILE_PX, height - t.top));
      t.canvas.style.top = `${t.top}px`;
      t.canvas.style.height = `${t.height}px`;
      sizeTile(t);
    });
  };

  const layout = () => {
    raf = 0;
    if (destroyed) return;
    const band = root.querySelector<HTMLElement>('[data-wave-anchor="band"]');
    if (!band) return;
    origin = docTop(band);
    const anchors = measureAnchors(root, origin);
    if (!anchors) return;
    if (probe) probe.layouts++;
    measured = anchors;
    width = anchors.width;
    innerWidth = window.innerWidth;
    viewport = window.innerHeight;
    maxScrollY = Math.max(0, document.documentElement.scrollHeight - viewport);
    amp = amplitudeFor(width);
    samples = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport }), SAMPLE_STEP);
    runLen = runLength(samples, width);
    runFlat = runFlatness(samples, runLen);
    entry = firstOnScreenY(samples, width);
    cols = layColumns(samples, SPACING, amp, anchors.blocks);
    const height = anchors.box.footer.bottom;
    layer.style.top = `${origin - docTop(root)}px`;
    layer.style.height = `${height}px`;
    syncTiles(height);
    map = mapTiles(cols, TILE_PX, tiles.length, tileReach(amp));
    dirty = true;
    conductor.setPath({ runLen, length: samples.length, train: chooseTrain(samples, anchors, visibleOptions(width, viewport)), runFlat }, !laid);
    laid = true;
  };
  // A window resize that leaves the width alone (a phone's toolbar collapsing
  // as it scrolls) moves only what hangs on the viewport's height: the scroll
  // limit and the train check. The anchors, spine and tiles stay as laid.
  const onResize = () => {
    if (destroyed || raf) return;
    if (!laid || !samples || !measured || window.innerWidth !== innerWidth) return schedule();
    viewport = window.innerHeight;
    maxScrollY = Math.max(0, document.documentElement.scrollHeight - viewport);
    conductor.setPath({ runLen, length: samples.length, train: chooseTrain(samples, measured, visibleOptions(width, viewport)), runFlat }, false);
  };
  const schedule = () => {
    if (!destroyed && !raf) raf = requestAnimationFrame(layout);
  };

  const view = {
    breathes: true,
    prepare(f: WaveFrame) {
      if (!samples) return;
      const raw = headTarget(HEAD_PARAMS, { samples, viewport, scrollY: f.scrollY, maxScrollY, layerTop: origin, runLen: f.runLen, entryY: entry });
      f.state.target = gatedTarget(raw, f.runLen, f.length, f.decided, f.still);
      const j = Math.min(cols.count - 1, Math.max(0, Math.floor(f.state.head / SPACING)));
      f.state.gateTarget = f.decided && cols.inWords[j] !== 1 ? 1 : 0;
      if (f.pointer.moved) nearestColumn(cols, f.pointer.x, f.pointer.y + f.scrollY - origin, f.head, f.tail, f.near);
    },
    paint(f: WaveFrame, changed: Changed | null) {
      if (changed && !dirty && !changed.head && !changed.music && !changed.breath && !changed.plucks && !changed.ripple) return;
      // Before an answer (and near the top) the head sits at the run's end: the path has no ink, so a breath alone repaints nothing.
      if (changed && !dirty && !changed.head && !changed.music && !changed.plucks && f.head <= f.runLen) return;
      dirty = false;
      sink.viewTop = f.scrollY - origin;
      sink.viewBottom = sink.viewTop + viewport;
      sink.width = width;
      sink.onScreen = 0;
      for (let t = 0; t < tiles.length; t++) {
        const tile = tiles[t];
        if (!tile.visible) continue;
        tile.ctx.clearRect(0, 0, width, tile.height);
        clearSink(sink);
        buildPathDots(cols, map.list, map.first[t], map.count[t], f, amp, tile.top, f.runLen, Infinity, null, sink);
        tile.painter.fill(sink.muted, tile.painter.colors.muted, alphas.muted);
        tile.painter.fill(sink.accent, tile.painter.colors.accent, alphas.accent);
        tile.ctx.globalAlpha = 1;
        if (probe) probe.paints++;
      }
    },
    active: () => tiles.some((t) => t.visible),
    countVisible(f: WaveFrame) {
      dirty = true;
      view.paint(f, null);
      return sink.onScreen;
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      resize.disconnect();
      theme.disconnect();
      io.disconnect();
      window.removeEventListener("resize", onResize);
      tiles.forEach((t) => t.canvas.remove());
      tiles.length = 0;
    },
  };

  const resize = new ResizeObserver(schedule);
  resize.observe(root);
  root.querySelectorAll("[data-wave-anchor]").forEach((el) => resize.observe(el));
  const theme = new MutationObserver(() => {
    alphas = ALPHAS[themeNow()];
    tiles.forEach((t) => t.painter.readColors());
    dirty = true;
    conductor.wake();
  });
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("resize", onResize);
  document.fonts?.ready.then(schedule);
  layout();
  return view;
}
