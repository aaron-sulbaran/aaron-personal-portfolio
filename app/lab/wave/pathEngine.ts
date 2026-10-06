import { createDotPainter } from "@/components/soundtrack/viewParts";
import { ACCENT_LINE, CENTER_RADIUS } from "@/lib/waveform/dots";
import { FLOOR, easeToward } from "@/lib/waveform/field";
import type { WaveSettings, ThemeName } from "./settings";
import { sampleSpine, type Point, type SpineSamples } from "./spineGeometry";
import { headTarget, runLength, tailStart } from "./headMap";
import type { Decision } from "./decisionStore";
import { publishMeasure } from "./anchorStore";
import { createCursor } from "./pathCursor";
import { SECTION_KEYS, resolveSpine, type Anchors, type Rect, type SectionKey, type Span, type SpinePoint } from "./spines";
import { BINS, bandAt, createSpectrum, stepSpectrum } from "./spectrum";
import { beatScale, measureBeat, type BeatReport } from "./motionProbe";

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
//
// The pointer (pathCursor.ts): fine pointers only, never under reduced
// motion. Its state is stepped only for the tiles its reach touches and the
// tiles still settling, only those are repainted when nothing else changed,
// and the loop stops once every column is back at rest.

const TILE = 768;
const DPR_CAP = 2;
const SAMPLE_STEP = 4;
const HEAD_LEN = 180; // px of arc the head treatment spans
const FUZZ_RADIUS = 1.8;
const DOT_GAP = 6.5;
const ACCENT_PEAK = 0.36;
const MAX_STEP_S = 0.1;
const FEATHER = 0.08; // soft rows: the width of the shimmer cut's feather, in the shimmer's 0..1 units
const PROBE_FRAMES = 240; // the music probe's memory: 4 s at 60fps

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
  layoutMs: number; // the last full layout: measure, sample, columns, tiles
  sampleMs: number; // of which sampling the spline and laying the columns
  interactPaints: number; // tile repaints caused by the pointer alone
  runLen: number; // the band run's arc length, 0 without one
  decision: Decision;
  scrollY: number;
  maxScrollY: number;
  endShortPx: number; // how far the head's target is from the line's end at this scroll (0 at the end)
  frameMs: number; // the last frame's work, ms
  maxFrameMs: number; // the worst since resetStats()
  frames: number; // frames since resetStats()
  onScreenDots: number; // dots the last paint put inside the viewport (layer width by the window's height)
}

export interface PathEngine {
  attach(layer: HTMLElement, root: HTMLElement): () => void;
  update(settings: WaveSettings, reduced: boolean, points: SpinePoint[]): void;
  decide(decision: Decision): void;
  resetStats(): void;
  // Paint now and return how many drawn dots sit inside the viewport (a test hook).
  probeVisible(): number;
  // The music's measured hold on the dots over the last `seconds` of frames (motionProbe.ts).
  musicProbe(seconds?: number): BeatReport | null;
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

// The horizontal ink of an element: the union of its text runs (and icons),
// from client rects (a reveal's rise is vertical, so x is never skewed).
function inkX(el: HTMLElement, originLeft: number): { left: number; right: number } {
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = Infinity;
  let right = -Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  }
  el.querySelectorAll("svg").forEach((icon) => {
    const r = icon.getBoundingClientRect();
    if (!r.width) return;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  });
  if (left > right) {
    const r = el.getBoundingClientRect();
    return { left: r.left - originLeft, right: r.right - originLeft };
  }
  return { left: left - originLeft, right: right - originLeft };
}

function measureAnchors(layer: HTMLElement, root: HTMLElement): Anchors | null {
  const origin = docTop(layer);
  const originLeft = layer.getBoundingClientRect().left;
  const box = {} as Record<SectionKey, Span>;
  const words = {} as Record<SectionKey, Span>;
  const blocks: Rect[] = [];
  const headings: Rect[] = [];
  const links: Rect[] = [];
  const hairlines: number[] = [];
  const vertical = (el: HTMLElement, pad = 0) => {
    const top = docTop(el) - origin;
    return { top, bottom: top + el.offsetHeight + pad };
  };
  for (const key of SECTION_KEYS) {
    const el = root.querySelector<HTMLElement>(`[data-lab-section="${key}"]`);
    if (!el) return null;
    const top = docTop(el) - origin;
    box[key] = { top, bottom: top + el.offsetHeight };
    let first = Infinity;
    let last = -Infinity;
    el.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((w) => {
      // An element whose words overhang its box (Up to now's offset column) says so.
      const overhang = Math.max(0, Number(w.dataset.waveAvoidPad || 0) - 20);
      const v = vertical(w, overhang);
      first = Math.min(first, v.top);
      last = Math.max(last, v.bottom);
      blocks.push({ ...inkX(w, originLeft), ...v });
    });
    words[key] = Number.isFinite(first) ? { top: first, bottom: last } : box[key];
    el.querySelectorAll<HTMLElement>("h2").forEach((h) => headings.push({ ...inkX(h, originLeft), ...vertical(h) }));
    // The section kickers ("About", "Who I am", ...): a short rule and a label.
    // Their ink runs from the rule's left end to the label's last letter.
    el.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((w) => {
      const rule = w.querySelector<HTMLElement>(":scope > span.h-px");
      if (!rule) return;
      const ink = inkX(w, originLeft);
      headings.push({ left: rule.getBoundingClientRect().left - originLeft, right: ink.right, ...vertical(w) });
    });
    if (key === "connect") el.querySelectorAll<HTMLElement>("ul").forEach((u) => links.push({ ...inkX(u, originLeft), ...vertical(u) }));
    const first0 = el.firstElementChild as HTMLElement | null;
    if (first0 && parseFloat(getComputedStyle(first0).borderTopWidth) > 0) hairlines.push(docTop(first0) - origin);
  }
  return { width: layer.clientWidth, box, words, blocks, headings, links, hairlines };
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
  let colInWords = new Uint8Array(0); // the column's spine point sits on a text block's ink
  let swellGate = 1; // the head's swell, relaxed to 0 while the head is inside a text block or waiting on the band
  let decision: Decision = "undecided";
  let runLen = 0;
  let maxScrollY = 0;
  let headVel = 0; // px of arc per second, the capped catch-up's current speed
  let breathClock = 0;
  let frameMs = 0;
  let maxFrameMs = 0;
  let frames = 0;
  let tileCols = new Int32Array(0);
  let width = 0;
  let points: SpinePoint[] = [];
  let layerLeft = 0;
  let layoutMs = 0;
  let sampleMs = 0;
  let interactPaints = 0;
  const cursor = createCursor();
  let fine = false;
  let clientX = 0;
  let clientY = 0;
  let tileActive = new Uint8Array(0);
  const repelOut = { x: 0, y: 0 };

  let layerDocTop = 0;
  let viewport = 0;
  let scrollY = 0;
  let head = 0;
  let target = 0;
  let paintedHead = -1;
  let dirty = true;
  let paints = 0;
  let music = 0;
  let shimmerClock = 0; // advances at the shimmer's rate, so moving the slider never jumps the pattern
  let raf = 0;
  let last = 0;
  let theme: ThemeName = "light";
  const spectrum = createSpectrum();
  // The last PROBE_FRAMES frames of the music's px per spectrum column, a ring.
  const probeSeries = new Float32Array(PROBE_FRAMES * BINS);
  const probeTimes = new Float32Array(PROBE_FRAMES);
  let probeAt = 0;
  let probeCount = 0;
  let probeClock = 0;
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
  // Below 600px wide the wave scales down (phones only), so it is not a fifth of the screen.
  const amplitudeNow = () => (width > 0 && width < 600 && settings.path.phoneAmplitude > 0 ? settings.path.phoneAmplitude : settings.amplitude);
  let entryY = 0; // where the line first comes on screen, layer px

  const layout = () => {
    if (!layer || !root) return;
    const t0 = performance.now();
    const anchors = measureAnchors(layer, root);
    if (!anchors) return;
    publishMeasure({ anchors, viewport: window.innerHeight });
    layerLeft = 0;
    for (let node: HTMLElement | null = layer; node; node = node.offsetParent as HTMLElement | null) layerLeft += node.offsetLeft;
    const t1 = performance.now();
    width = anchors.width;
    viewport = window.innerHeight;
    layerDocTop = docTop(layer);
    scrollY = window.scrollY;
    controls = resolveSpine({ points }, anchors, { bandRun: settings.path.bandRun, viewport });
    samples = sampleSpine(controls, SAMPLE_STEP);
    runLen = settings.path.bandRun ? runLength(samples, width) : 0;
    maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const spacing = settings.spacing;
    columns = Math.max(0, Math.floor(samples.length / spacing));
    colS = new Float32Array(columns);
    colX = new Float32Array(columns);
    colY = new Float32Array(columns);
    colNx = new Float32Array(columns);
    colNy = new Float32Array(columns);
    colTaper = new Float32Array(columns);
    colInWords = new Uint8Array(columns);
    const reachOf = (amp: number) => amp * 0.55;
    const amp = amplitudeNow();
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
      const cx = colX[j];
      const cy = colY[j];
      for (const b of anchors.blocks) {
        if (cx > b.left - 4 && cx < b.right + 4 && cy > b.top - 4 && cy < b.bottom + 4) {
          colInWords[j] = 1;
          break;
        }
      }
    }
    cursor.resize(columns);
    entryY = samples.y[0];
    for (let i = 0; i < samples.count; i++) {
      if (samples.x[i] > 0 && samples.x[i] < width) {
        entryY = samples.y[i];
        break;
      }
    }
    sampleMs = performance.now() - t1;

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
    tileActive = new Uint8Array(count);
    target = targetHead();
    if (reduced || paintedHead < 0) head = target;
    dirty = true;
    layoutMs = performance.now() - t0;
    refresh();
  };

  // The swell relaxes while the head sits on a text block (the head column, by arc length).
  const waiting = () => settings.path.bandRun && decision === "undecided" && !reduced;

  const gateFor = () => {
    if (waiting()) return 0;
    if (!settings.path.swellOutsideWords || !columns) return 1;
    const j = Math.min(columns - 1, Math.max(0, Math.floor(head / settings.spacing)));
    return colInWords[j] ? 0 : 1;
  };

  const interactive = () => fine && !reduced && cursor.mode !== "none";

  // One dot out, through the pointer's repel (carve and blend) when its
  // column is near the pointer. Module-level scratch, no allocation.
  let emitTop = 0;
  let emitRepel = false;
  let onScreenDots = 0;
  let viewTop = 0; // the viewport's top in layer px, for the on-screen count
  const emit = (out: number[], x: number, y: number, r: number) => {
    let dx = x;
    let dy = y;
    if (emitRepel) {
      cursor.repel(x, y + emitTop, repelOut);
      dx = repelOut.x;
      dy = repelOut.y - emitTop;
    }
    const ly = dy + emitTop;
    if (dx >= 0 && dx <= width && ly >= viewTop && ly <= viewTop + viewport) onScreenDots++;
    pushDot(out, dx, dy, r);
  };

  // Where the head is heading: the band run's right end while the visitor
  // has not answered, otherwise the scroll's target (headMap.ts), which is
  // the line's end at the page's maximum scroll.
  const targetHead = (): number => {
    if (!samples) return 0;
    if (reduced) return samples.length;
    if (waiting()) return runLen;
    const p = settings.path;
    return headTarget(
      { mode: p.headMode, headAt: p.headAt, preDrawn: p.preDrawn, fromBand: p.headFromBand },
      { samples, viewport, scrollY, maxScrollY, layerTop: layerDocTop, runLen, entryY },
    );
  };

  // The head toward its target: the smoothing's pull, never faster than the
  // draw speed, so a flick is followed by the line drawing itself rather than
  // a jump. "eased" lets the catch-up accelerate in (about 0.25s) instead of
  // starting at full speed.
  const stepHead = (dt: number) => {
    const p = settings.path;
    const gap = target - head;
    if (reduced) {
      head = target;
      headVel = 0;
      return;
    }
    let want = p.smoothing <= 0 ? gap / Math.max(dt, 1e-3) : gap * p.smoothing;
    if (p.drawSpeed > 0) want = Math.max(-p.drawSpeed, Math.min(p.drawSpeed, want));
    if (p.drawEase === "eased" && p.drawSpeed > 0 && Math.abs(want) > Math.abs(headVel)) {
      headVel = want + (headVel - want) * Math.exp(-dt / 0.25);
    } else {
      headVel = want;
    }
    head += headVel * dt;
    if ((gap > 0 && head > target) || (gap < 0 && head < target) || Math.abs(head - target) < 0.2) {
      head = target;
      headVel = 0;
    }
  };

  const paintTile = (tile: Tile) => {
    const { ctx, painter } = tile;
    ctx.clearRect(0, 0, width, tile.height);
    if (!samples) return;
    muted.length = 0;
    accent.length = 0;
    const p = settings.path;
    const amp = amplitudeNow();
    const gap = DOT_GAP * settings.dotScale;
    const train = p.tail === "train" && !reduced;
    const tailFade = p.trainLength * 0.3;
    const tailS = train ? tailStart(head, p.trainLength, tailFade, runLen) : -Infinity;
    // The band run breathes while it waits, like the band's own wave: a slow
    // standing swell along the run, gone over its last 200px so the line
    // leaving it is still.
    const breathing = runLen > 0 && !reduced;
    const breath = Math.sin(breathClock * 0.9);
    const shift = p.shapeTravel * head;
    const lambda = p.wavelength;
    const musicAmount = music * p.musicLayer;
    const specPeriod = Math.max(50, p.spectrumPeriod);
    const top = tile.top;
    let sparkJ = -1;
    const touch = interactive();
    const plucking = touch && cursor.hasPlucks();
    const repelR = cursor.radius + 30;
    const pointer = cursor.pointer;
    const soft = p.shimmer === "soft";
    const depth = settings.motion.shimmerDepth;
    const softRows = settings.motion.softRows;
    emitTop = top;

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
          w *= 1 + 0.7 * swellGate * Math.exp(-((fromHead / 140) ** 2));
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

      let carved = 1;
      let bright = 0;
      let ox = 0;
      let oy = 0;
      emitRepel = false;
      if (touch) {
        w *= cursor.swellScale(j);
        carved = cursor.carveScale(j);
        bright = cursor.brightness(j);
        ox = cursor.offX(j);
        oy = cursor.offY(j);
        emitRepel = pointer.on && Math.abs(colX[j] - pointer.x) < repelR && Math.abs(colY[j] - pointer.y) < repelR + amp;
      }

      const a = (TAU * (s - shift)) / lambda;
      let disp = 0.26 * shape(a) + (plucking ? cursor.pluck(s) : 0);
      if (breathing && s < runLen) disp *= 1 + 0.35 * breath * Math.sin(a * 0.5) * smooth((runLen - s) / 200);
      // The resting shape cedes to the music by the music's share: at a share
      // of 1 the column is the band's reactive target (the floor plus the
      // band), so the music owns the amplitude and a quiet bar thins to the line.
      let mag = FLOOR + (0.05 + 0.17 * (0.5 + 0.5 * Math.sin(a / 0.55 + 0.6)) ** 2) * (1 - musicAmount);
      if (musicAmount > 1e-3) mag += musicAmount * bandAt(spectrum, (s % specPeriod) / specPeriod);
      const magnitude = FLOOR + (mag - FLOOR) * w * carved;
      const nx = colNx[j];
      const ny = colNy[j];
      const cx = colX[j] - nx * disp * w * amp + ox;
      const cy = colY[j] - top - ny * disp * w * amp + oy;
      const inWords = colInWords[j] === 1;
      // Inside a text block: no accent (the darkest mark in light) and no lone
      // centre dot (it reads as punctuation between words).
      const plain = p.accentOutsideWords && inWords;
      const peak = !plain && magnitude > ACCENT_PEAK;
      // Soft rows: the level's row count is continuous; the outermost row's
      // dots grow with its fraction instead of popping in whole.
      const rows = Math.min(settings.maxThick, (magnitude * amp) / gap);
      const thick = softRows ? Math.ceil(rows - 1e-3) : Math.floor(rows);
      const rowsFor = softRows ? rows : thick;
      let centre = 1;
      if (p.thinInWords && inWords && rows < 1) {
        if (!softRows) continue;
        centre = smooth(rows);
        if (centre < 0.05) continue;
      }
      emit(!plain && (magnitude > ACCENT_LINE || (bright > 0 && hash(j, 9) < bright)) ? accent : muted, cx, cy, CENTER_RADIUS * r * centre);
      for (let q = 1; q <= thick; q++) {
        const fade = 1 - q / (rowsFor + 1.5);
        // The site's shimmer, frozen per column: the pattern is a property of
        // the arc length, so scrolling reveals it rather than animating it.
        // "threshold": music animates the site's blink (each fuzz dot on or off
        // at the shimmer clock x3). "soft": the pattern stays put and each dot
        // breathes in size instead, slower, so nothing pops behind a word.
        const shimmer = 0.5 + 0.5 * Math.sin(j * 1.3 + q * 2.1 + (!soft && musicAmount > 1e-3 ? shimmerClock * 3 : 0));
        const breathe = soft && musicAmount > 1e-3 ? 1 - depth + depth * (0.5 + 0.5 * Math.sin(shimmerClock + j * 1.3 + q * 2.1)) : 1;
        const cut = 0.5 + fade * 0.45;
        // Soft rows feather the cut (centred on it, so the ink stays the same on
        // average): a dot the level moves across it shrinks away instead of vanishing.
        const kept = softRows ? smooth((cut - shimmer) / FEATHER + 0.5) * Math.min(1, rows - (q - 1)) : shimmer < cut ? 1 : 0;
        if (kept < 0.05) continue;
        if (present < 1 && hash(j, q) > present) continue;
        const out = !plain && ((q >= thick && peak) || (bright > 0 && hash(j, q + 9) < bright)) ? accent : muted;
        const o = q * gap;
        const fuzz = FUZZ_RADIUS * r * breathe * kept;
        emit(out, cx + nx * o, cy + ny * o, fuzz);
        emit(out, cx - nx * o, cy - ny * o, fuzz);
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
    onScreenDots = 0;
    viewTop = scrollY - layerDocTop;
    for (let t = 0; t < tiles.length; t++) if (tiles[t].visible) paintTile(tiles[t]);
    paintedHead = head;
    dirty = false;
  };

  // Behind a band run the music is the visitor's answer: none until "Play it".
  const musicWanted = () => settings.music && (!settings.path.bandRun || decision === "play");
  const musicLive = () => !reduced && settings.path.musicLayer > 0 && (musicWanted() || music > 1e-3);
  // The waiting band run breathes, so the loop runs while its tile is in view.
  const breathingLive = () => runLen > 0 && !reduced && tiles.some((tile) => tile.visible && tile.top < (samples ? samples.y[0] + 200 : 0));

  const tick = (t: number) => {
    raf = 0;
    if (!started) return;
    const dt = last ? Math.min((t - last) / 1000, MAX_STEP_S) : 1 / 60;
    last = t;
    const started0 = performance.now();
    const motion = settings.motion;
    shimmerClock += dt * motion.shimmerRate * motion.speed;
    breathClock += dt * motion.speed;
    target = targetHead();
    const gateTarget = gateFor();
    const gateBefore = swellGate;
    swellGate = reduced ? gateTarget : gateTarget + (swellGate - gateTarget) * Math.exp(-dt / 0.25);
    if (Math.abs(swellGate - gateTarget) < 0.01) swellGate = gateTarget;
    if (swellGate !== gateBefore) dirty = true;
    stepHead(dt);
    const live = musicLive();
    if (live) {
      const on = musicWanted();
      music = easeToward(music, on ? 1 : 0, on ? 0.05 : 0.11, dt);
      stepSpectrum(spectrum, dt, music * settings.intensity, settings.beat, motion);
      probeClock += dt;
      const px = music * settings.path.musicLayer * amplitudeNow();
      const row = probeAt * BINS;
      for (let b = 0; b < BINS; b++) probeSeries[row + b] = spectrum.bins[b] * px;
      probeTimes[probeAt] = probeClock;
      probeAt = (probeAt + 1) % PROBE_FRAMES;
      probeCount = Math.min(PROBE_FRAMES, probeCount + 1);
    }
    const touching = interactive() && stepPointer(dt);
    const breathing = breathingLive();
    if (dirty || live || breathing || Math.abs(head - paintedHead) > 0.2) {
      paintVisible();
    } else if (touching) {
      for (let k = 0; k < tiles.length; k++) {
        if (tiles[k].visible && tileActive[k]) {
          paintTile(tiles[k]);
          interactPaints++;
        }
      }
    }
    if (interactive()) cursor.endFrame();
    frameMs = performance.now() - started0;
    maxFrameMs = Math.max(maxFrameMs, frameMs);
    frames++;
    if (head !== target || live || breathing || swellGate !== gateTarget || (interactive() && cursor.busy())) raf = requestAnimationFrame(tick);
    else last = 0;
  };

  // Step the pointer's state for the tiles its reach touches and the tiles
  // still settling; mark them for repaint. Returns true if any tile needs it.
  const stepPointer = (dt: number): boolean => {
    cursor.beginFrame(dt);
    const p = cursor.pointer;
    const reach = cursor.radius * 2 + amplitudeNow() + 40;
    const plucking = cursor.hasPlucks();
    let any = false;
    let nearJ = -1;
    let nearD = Infinity;
    let nearSide = 0;
    const tailS = settings.path.tail === "train" ? head - settings.path.trainLength : -Infinity;
    for (let k = 0; k < tiles.length; k++) {
      const tile = tiles[k];
      if (!tile.visible) {
        tileActive[k] = 0;
        continue;
      }
      const inReach = p.on && p.y + reach > tile.top && p.y - reach < tile.top + tile.height;
      if (!inReach && !tileActive[k] && !plucking) continue;
      const before = cursor.unsettledCount();
      for (let c = 0; c < tile.count; c++) {
        const j = tileCols[tile.first + c];
        cursor.step(j, colX[j], colY[j], dt);
        if (p.moved && p.on && colS[j] <= head && colS[j] >= tailS) {
          const dx = p.x - colX[j];
          const dy = p.y - colY[j];
          const d = dx * dx + dy * dy;
          if (d < nearD) {
            nearD = d;
            nearJ = j;
            nearSide = Math.sign(dx * colNx[j] + dy * colNy[j]);
          }
        }
      }
      tileActive[k] = inReach || plucking || cursor.unsettledCount() > before ? 1 : 0;
      if (tileActive[k]) any = true;
    }
    if (nearJ >= 0 && nearD < cursor.radius * cursor.radius) cursor.crossing(nearJ, nearSide, colS[nearJ]);
    else if (p.moved) cursor.crossing(-1, 0, 0);
    return any;
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
    if (cursor.pointer.on) cursor.place(clientX - layerLeft, clientY + scrollY - layerDocTop);
    wake();
  };
  const onPointer = (event: PointerEvent) => {
    if (!interactive() || event.pointerType === "touch") return;
    clientX = event.clientX;
    clientY = event.clientY;
    cursor.move(clientX - layerLeft, clientY + scrollY - layerDocTop, event.timeStamp);
    wake();
  };
  const onLeave = () => {
    cursor.leave();
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
    update(next, nextReduced, nextPoints) {
      settings = next;
      reduced = nextReduced;
      points = nextPoints;
      cursor.configure(next.cursor);
      layout();
    },
    start() {
      if (started) return;
      started = true;
      theme = themeNow();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      fine = window.matchMedia("(pointer: fine)").matches;
      if (fine) {
        window.addEventListener("pointermove", onPointer, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
      }
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
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver?.disconnect();
      themeObserver = null;
    },
    decide(next) {
      decision = next;
      dirty = true;
      wake();
    },
    resetStats() {
      maxFrameMs = 0;
      frames = 0;
    },
    musicProbe(seconds = 2) {
      if (probeCount < 2) return null;
      const newest = probeTimes[(probeAt + PROBE_FRAMES - 1) % PROBE_FRAMES];
      let n = 0;
      while (n < probeCount && newest - probeTimes[(probeAt + PROBE_FRAMES - 1 - n) % PROBE_FRAMES] <= seconds) n++;
      const series = new Float32Array(n * BINS);
      const times = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const from = (probeAt + PROBE_FRAMES - n + k) % PROBE_FRAMES;
        series.set(probeSeries.subarray(from * BINS, from * BINS + BINS), k * BINS);
        times[k] = probeTimes[from];
      }
      return measureBeat(series, times, n, beatScale({ ...settings, amplitude: amplitudeNow() }));
    },
    probeVisible() {
      scrollY = window.scrollY;
      paintVisible();
      return onScreenDots;
    },
    info: () => ({
      length: samples?.length ?? 0,
      head,
      target,
      tiles: tiles.length,
      visibleTiles: tiles.filter((t) => t.visible).length,
      columns,
      paints,
      layoutMs,
      sampleMs,
      interactPaints,
      runLen,
      decision,
      scrollY,
      maxScrollY,
      endShortPx: samples ? samples.length - target : 0,
      frameMs,
      maxFrameMs,
      frames,
      onScreenDots,
    }),
  };
}
