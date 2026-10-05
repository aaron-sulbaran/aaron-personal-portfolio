import { createDotPainter } from "@/components/soundtrack/viewParts";
import { ACCENT_LINE, CENTER_RADIUS } from "@/lib/waveform/dots";
import { FLOOR, easeToward } from "@/lib/waveform/field";
import type { WaveSettings, ThemeName } from "./settings";
import { arcAtY, sampleSpine, type Point, type SpineSamples } from "./spineGeometry";
import { SECTION_KEYS, resolveSpine, spineById, type Anchors, type SectionKey, type Span } from "./spines";
import { bandAt, createSpectrum, stepSpectrum } from "./spectrum";

// The Path placement: the site's dotted wave laid along a spine in document
// space, drawn by scroll.
//
// Rendering: the layer sits in flow behind the content (z -1 inside the
// content's stacking context), so native scrolling carries it with no lag. It
// holds a stack of canvas tiles, each at most TILE px tall; a tile owns a
// bitmap only while it is near the viewport, and only those are repainted.
// Everything geometric (the spine's samples, each column's position, normal
// and curvature taper, which tiles each column touches) is built on resize or
// a settings change. A frame only moves the head, steps the music if it is
// on, and repaints the tiles in view, and it paints nothing at all when the
// head has not moved and the music is off.
//
// Curvature: the amplitude is tapered by the local radius (smoothed so the
// taper begins before a bend), so the inside of a bend never folds; a knot
// tight enough reads as a bare dotted thread. Crossings: every dot of a colour
// goes into one path and is filled once, so where the line crosses itself the
// dots union instead of stacking alpha: one thread over another in the same ink.

const TILE = 768;
const DPR_CAP = 2;
const SAMPLE_STEP = 4;
const HEAD_LEN = 180; // px of arc the head treatment spans
const FUZZ_RADIUS = 1.8;
const DOT_GAP = 6.5;
const ACCENT_PEAK = 0.36;
const MAX_STEP_S = 0.1;
const SPEC_PERIOD = 1100; // px of arc per pass through the spectrum

type Painter = ReturnType<typeof createDotPainter>;

interface Tile {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  painter: Painter;
  top: number;
  height: number;
  visible: boolean;
  first: number; // into tileCols
  count: number;
}

export interface PathInfo {
  length: number;
  head: number;
  target: number;
  tiles: number;
  visibleTiles: number;
  columns: number;
  paints: number;
}

export interface PathEngine {
  attach(layer: HTMLElement, root: HTMLElement): () => void;
  update(settings: WaveSettings, reduced: boolean): void;
  start(): void;
  stop(): void;
  info(): PathInfo;
}

const TAU = Math.PI * 2;
const shape = (a: number) => Math.sin(a) * 0.62 + Math.sin(2 * a + 1.1) * 0.26 + Math.sin(3 * a + 2.3) * 0.12;
const smooth = (v: number) => {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};
const hash = (i: number, k: number) => {
  const h = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

// Document top of an element from its offset chain: transforms (the reveals'
// rise) never move it, so a measure taken mid-reveal is already right.
function docTop(el: HTMLElement): number {
  let y = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop;
  return y;
}

function measureAnchors(layer: HTMLElement, root: HTMLElement): Anchors | null {
  const origin = docTop(layer);
  const box = {} as Record<SectionKey, Span>;
  const words = {} as Record<SectionKey, Span>;
  for (const key of SECTION_KEYS) {
    const el = root.querySelector<HTMLElement>(`[data-lab-section="${key}"]`);
    if (!el) return null;
    const top = docTop(el) - origin;
    box[key] = { top, bottom: top + el.offsetHeight };
    let first = Infinity;
    let last = -Infinity;
    el.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((w) => {
      const t = docTop(w) - origin;
      // An element whose words overhang its box (Up to now's offset column) says so.
      const overhang = Math.max(0, Number(w.dataset.waveAvoidPad || 0) - 20);
      first = Math.min(first, t);
      last = Math.max(last, t + w.offsetHeight + overhang);
    });
    words[key] = Number.isFinite(first) ? { top: first, bottom: last } : box[key];
  }
  return { width: layer.clientWidth, box, words };
}

function pushDot(out: number[], x: number, y: number, r: number) {
  out.push(x, y, r);
}

export function createPathEngine(initial: WaveSettings): PathEngine {
  let settings = initial;
  let reduced = false;
  let started = false;
  let layer: HTMLElement | null = null;
  let root: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let themeObserver: MutationObserver | null = null;
  let tileObserver: IntersectionObserver | null = null;
  const timers: number[] = [];
  const tiles: Tile[] = [];

  let samples: SpineSamples | null = null;
  let controls: Point[] = [];
  let columns = 0;
  let colS = new Float32Array(0);
  let colX = new Float32Array(0);
  let colY = new Float32Array(0);
  let colNx = new Float32Array(0);
  let colNy = new Float32Array(0);
  let colTaper = new Float32Array(0);
  let tileCols = new Int32Array(0);
  let width = 0;

  let layerDocTop = 0;
  let viewport = 0;
  let scrollY = 0;
  let head = 0;
  let target = 0;
  let paintedHead = -1;
  let dirty = true;
  let paints = 0;
  let music = 0;
  let clock = 0;
  let raf = 0;
  let last = 0;
  let theme: ThemeName = "light";
  const spectrum = createSpectrum();
  const muted: number[] = [];
  const accent: number[] = [];

  const themeNow = (): ThemeName => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  const sizeTile = (tile: Tile) => {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = tile.visible ? Math.max(1, Math.round(width * dpr)) : 0;
    const h = tile.visible ? Math.max(1, Math.round(tile.height * dpr)) : 0;
    if (tile.canvas.width !== w || tile.canvas.height !== h) {
      tile.canvas.width = w;
      tile.canvas.height = h;
    }
    if (tile.visible) tile.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // Geometry: anchors, spine, columns, tiles. Layout reads live here only.
  const layout = () => {
    if (!layer || !root) return;
    const anchors = measureAnchors(layer, root);
    if (!anchors) return;
    width = anchors.width;
    viewport = window.innerHeight;
    layerDocTop = docTop(layer);
    scrollY = window.scrollY;
    controls = resolveSpine(spineById(settings.path.spine), anchors);
    samples = sampleSpine(controls, SAMPLE_STEP);

    const spacing = settings.spacing;
    columns = Math.max(0, Math.floor(samples.length / spacing));
    colS = new Float32Array(columns);
    colX = new Float32Array(columns);
    colY = new Float32Array(columns);
    colNx = new Float32Array(columns);
    colNy = new Float32Array(columns);
    colTaper = new Float32Array(columns);
    const reachOf = (amp: number) => amp * 0.55;
    const amp = settings.amplitude;
    for (let j = 0; j < columns; j++) {
      const s = j * spacing + spacing / 2;
      const i = Math.min(samples.count - 1, Math.round(s / SAMPLE_STEP));
      colS[j] = s;
      colX[j] = samples.x[i];
      colY[j] = samples.y[i];
      colNx[j] = samples.nx[i];
      colNy[j] = samples.ny[i];
      // Keep the farthest dot inside 80 percent of the bend's radius.
      colTaper[j] = Math.min(1, (0.8 * samples.radius[i]) / Math.max(1, reachOf(amp)));
    }

    // Tiles: one canvas per TILE px of the layer's height.
    const height = layer.clientHeight;
    const count = Math.max(1, Math.ceil(height / TILE));
    while (tiles.length > count) {
      const tile = tiles.pop()!;
      tileObserver?.unobserve(tile.canvas);
      tile.canvas.remove();
    }
    while (tiles.length < count) {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const painter = createDotPainter(ctx);
      painter.readColors();
      const tile: Tile = { canvas, ctx, painter, top: 0, height: 0, visible: false, first: 0, count: 0 };
      tiles.push(tile);
      layer.appendChild(canvas);
      tileObserver?.observe(canvas);
    }
    tiles.forEach((tile, t) => {
      tile.top = t * TILE;
      tile.height = Math.max(1, Math.min(TILE, height - tile.top));
      tile.canvas.style.top = `${tile.top}px`;
      tile.canvas.style.height = `${tile.height}px`;
      sizeTile(tile);
    });

    // Which columns each tile must paint: any whose dots can reach into it.
    const reach = amp * (0.75 + settings.path.musicLayer) + 24;
    const counts = new Int32Array(count);
    for (let j = 0; j < columns; j++) {
      const a = Math.max(0, Math.floor((colY[j] - reach) / TILE));
      const b = Math.min(count - 1, Math.floor((colY[j] + reach) / TILE));
      for (let t = a; t <= b; t++) counts[t]++;
    }
    let total = 0;
    tiles.forEach((tile, t) => {
      tile.first = total;
      tile.count = 0;
      total += counts[t];
    });
    tileCols = new Int32Array(total);
    for (let j = 0; j < columns; j++) {
      const a = Math.max(0, Math.floor((colY[j] - reach) / TILE));
      const b = Math.min(count - 1, Math.floor((colY[j] + reach) / TILE));
      for (let t = a; t <= b; t++) tileCols[tiles[t].first + tiles[t].count++] = j;
    }
    target = targetHead();
    if (reduced || paintedHead < 0) head = target;
    dirty = true;
    refresh();
  };

  const targetHead = (): number => {
    if (!samples) return 0;
    const L = samples.length;
    if (reduced) return L;
    const p = settings.path;
    const line = scrollY + p.headAt * viewport - layerDocTop;
    if (p.headMode === "progress") {
      const y0 = samples.y[0];
      const y1 = samples.yMax[samples.count - 1];
      const progress = Math.min(1, Math.max(0, (line - y0) / Math.max(1, y1 - y0)));
      return L * (p.preDrawn + (1 - p.preDrawn) * progress);
    }
    return Math.max(p.preDrawn * L, arcAtY(samples, line));
  };

  const paintTile = (tile: Tile) => {
    const { ctx, painter } = tile;
    ctx.clearRect(0, 0, width, tile.height);
    if (!samples) return;
    muted.length = 0;
    accent.length = 0;
    const p = settings.path;
    const amp = settings.amplitude;
    const gap = DOT_GAP * settings.dotScale;
    const train = p.tail === "train" && !reduced;
    const tailS = train ? head - p.trainLength : -Infinity;
    const tailFade = p.trainLength * 0.3;
    const shift = p.shapeTravel * head;
    const lambda = p.wavelength;
    const musicAmount = music * p.musicLayer;
    const top = tile.top;
    let sparkJ = -1;

    for (let k = 0; k < tile.count; k++) {
      const j = tileCols[tile.first + k];
      const s = colS[j];
      if (s > head || s < tailS) continue;
      let w = p.lineOnly ? 0 : colTaper[j];
      let r = settings.dotScale;
      const fromHead = head - s;
      if (!reduced) {
        if (p.headStyle === "taper") {
          const f = smooth(fromHead / HEAD_LEN);
          w *= f;
          r *= 0.55 + 0.45 * f;
        } else if (p.headStyle === "swell") {
          w *= 1 + 0.7 * Math.exp(-((fromHead / 140) ** 2));
        } else if (p.headStyle === "spark" && fromHead < settings.spacing) {
          sparkJ = j;
        }
      }
      let present = 1;
      if (train) {
        present = smooth((s - tailS) / tailFade);
        w *= present;
        r *= 0.6 + 0.4 * present;
      }
      if (present < 1 && hash(j, 0) > present) continue;

      const a = (TAU * (s - shift)) / lambda;
      const disp = 0.26 * shape(a);
      let mag = FLOOR + 0.05 + 0.17 * (0.5 + 0.5 * Math.sin(a / 0.55 + 0.6)) ** 2;
      if (musicAmount > 1e-3) mag += musicAmount * bandAt(spectrum, (s % SPEC_PERIOD) / SPEC_PERIOD);
      const magnitude = FLOOR + (mag - FLOOR) * w;
      const nx = colNx[j];
      const ny = colNy[j];
      const cx = colX[j] - nx * disp * w * amp;
      const cy = colY[j] - top - ny * disp * w * amp;
      const peak = magnitude > ACCENT_PEAK;
      pushDot(magnitude > ACCENT_LINE ? accent : muted, cx, cy, CENTER_RADIUS * r);

      const thick = Math.min(settings.maxThick, Math.floor((magnitude * amp) / gap));
      for (let q = 1; q <= thick; q++) {
        const fade = 1 - q / (thick + 1.5);
        // The site's shimmer, frozen per column: the pattern is a property of
        // the arc length, so scrolling reveals it rather than animating it.
        const shimmer = 0.5 + 0.5 * Math.sin(j * 1.3 + q * 2.1 + (musicAmount > 1e-3 ? clock * 6 : 0));
        if (shimmer >= 0.5 + fade * 0.45) continue;
        if (present < 1 && hash(j, q) > present) continue;
        const out = q >= thick && peak ? accent : muted;
        const o = q * gap;
        pushDot(out, cx + nx * o, cy + ny * o, FUZZ_RADIUS * r);
        pushDot(out, cx - nx * o, cy - ny * o, FUZZ_RADIUS * r);
      }
    }
    if (sparkJ >= 0) pushDot(accent, colX[sparkJ], colY[sparkJ] - top, CENTER_RADIUS * 1.7 * settings.dotScale);

    const alphas = settings.alpha[theme];
    painter.fill(muted, painter.colors.muted, alphas.muted);
    painter.fill(accent, painter.colors.accent, alphas.accent);
    ctx.globalAlpha = 1;
    if (p.debug) paintDebug(tile);
    paints++;
  };

  const paintDebug = (tile: Tile) => {
    if (!samples) return;
    const { ctx, painter } = tile;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = painter.colors.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < samples.count; i++) {
      const y = samples.y[i] - tile.top;
      if (i === 0) ctx.moveTo(samples.x[i], y);
      else ctx.lineTo(samples.x[i], y);
    }
    ctx.stroke();
    ctx.fillStyle = painter.colors.accent;
    for (const c of controls) {
      ctx.beginPath();
      ctx.arc(c.x, c.y - tile.top, 4, 0, TAU);
      ctx.fill();
    }
    const h = Math.min(samples.count - 1, Math.round(head / SAMPLE_STEP));
    ctx.beginPath();
    ctx.arc(samples.x[h], samples.y[h] - tile.top, 9, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const paintVisible = () => {
    for (let t = 0; t < tiles.length; t++) if (tiles[t].visible) paintTile(tiles[t]);
    paintedHead = head;
    dirty = false;
  };

  const musicLive = () => !reduced && settings.path.musicLayer > 0 && (settings.music || music > 1e-3);

  const tick = (t: number) => {
    raf = 0;
    if (!started) return;
    const dt = last ? Math.min((t - last) / 1000, MAX_STEP_S) : 1 / 60;
    last = t;
    clock += dt;
    target = targetHead();
    const lambda = settings.path.smoothing;
    head = lambda <= 0 || reduced ? target : target + (head - target) * Math.exp(-lambda * dt);
    if (Math.abs(head - target) < 0.2) head = target;
    const live = musicLive();
    if (live) {
      music = easeToward(music, settings.music ? 1 : 0, settings.music ? 0.05 : 0.11, dt);
      stepSpectrum(spectrum, clock, dt, music * settings.intensity, settings.beat);
    }
    if (dirty || live || Math.abs(head - paintedHead) > 0.2) paintVisible();
    if (head !== target || live) raf = requestAnimationFrame(tick);
    else last = 0;
  };

  const wake = () => {
    if (!started || raf || document.hidden) return;
    raf = requestAnimationFrame(tick);
  };

  const refresh = () => {
    if (!started) return;
    if (reduced) {
      if (dirty) paintVisible();
      return;
    }
    wake();
  };

  const onScroll = () => {
    scrollY = window.scrollY;
    wake();
  };
  const onResize = () => layout();
  const onVisibility = () => {
    last = 0;
    wake();
  };

  return {
    attach(nextLayer, nextRoot) {
      layer = nextLayer;
      root = nextRoot;
      tileObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const tile = tiles.find((x) => x.canvas === entry.target);
            if (!tile) continue;
            tile.visible = entry.isIntersecting;
            sizeTile(tile);
          }
          dirty = true;
          refresh();
        },
        { rootMargin: "200px 0px" },
      );
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(nextRoot);
      layout();
      // The reveals settle and the web fonts land after mount; measure again.
      timers.push(window.setTimeout(layout, 800), window.setTimeout(layout, 2000));
      document.fonts?.ready.then(() => layout());
      return () => {
        timers.forEach((id) => window.clearTimeout(id));
        timers.length = 0;
        resizeObserver?.disconnect();
        tileObserver?.disconnect();
        tiles.forEach((tile) => tile.canvas.remove());
        tiles.length = 0;
        layer = null;
        root = null;
      };
    },
    update(next, nextReduced) {
      settings = next;
      reduced = nextReduced;
      layout();
    },
    start() {
      if (started) return;
      started = true;
      theme = themeNow();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      themeObserver = new MutationObserver(() => {
        theme = themeNow();
        tiles.forEach((tile) => tile.painter.readColors());
        dirty = true;
        if (reduced) paintVisible();
        else wake();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      dirty = true;
      refresh();
    },
    stop() {
      if (!started) return;
      started = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver?.disconnect();
      themeObserver = null;
    },
    info: () => ({
      length: samples?.length ?? 0,
      head,
      target,
      tiles: tiles.length,
      visibleTiles: tiles.filter((t) => t.visible).length,
      columns,
      paints,
    }),
  };
}
