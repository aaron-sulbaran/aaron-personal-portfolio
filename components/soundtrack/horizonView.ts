import { ScrollTrigger } from "@/lib/gsap";
import { buildDots, carveTargets, type Cursor, type DotLayout } from "@/lib/waveform/dots";
import { DUCK, DUCK_ALPHA, duckTargets, stepDuck } from "@/lib/waveform/duck";
import { HORIZON, PHONE_MAX_PX, horizonLayout } from "@/lib/waveform/layout";
import { trainX } from "@/lib/waveform/sweep";
import { columnWeights, type Rect } from "@/lib/waveform/weights";
import type { WaveConductor } from "./waveConductor";
import type { ViewOptions, WaveViewHandle } from "./waveView";
import { createDotPainter, layTrack, sizeCanvas, themeNow, trackPointer, type Alphas, type Theme } from "./viewParts";

// The horizon view: the train's second track, a strip fixed along the bottom
// of the viewport (HorizonCanvas.tsx). It paints column i at
// x_i + (1 - sweep) * W, so the ribbon that leaves the band to the left
// arrives here from the right, its first ten columns rising from below.
//
// Readability is a sidechain duck (lib/waveform/duck.ts): the text boxes
// marked [data-wave-avoid] under main and the footer are measured in document
// space once per layout; each frame compares them with the strip's span (from
// the cached scroll position, no layout read) and every column under text
// eases to a still centreline painted at the DUCK_ALPHA ceiling.
//
// Reduced motion never travels: the strip paints its still line at rest,
// repaints on scroll (the conductor never loops then) and fades in over 400ms
// once the sweep target passes half. The fade is a Web Animation, since
// globals.css collapses every CSS transition under reduced motion.

const MAX_STEP_S = 0.1;
const FADE_MS = 400;
const AVOID_SELECTOR = "main [data-wave-avoid], footer [data-wave-avoid]";

export function createHorizonView(
  canvas: HTMLCanvasElement,
  conductor: WaveConductor,
  options: ViewOptions,
): WaveViewHandle | null {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  if (!ctx || !host) return null;
  const { still } = options;

  let layout = horizonLayout(0);
  let track: DotLayout = layout;
  const carveLayout = { ...layout };
  // Preallocated per layout; the frame writes into these and allocates nothing.
  let open: Float32Array = new Float32Array(0); // the page-edge taper
  let xs = new Float32Array(0);
  let offsets = new Float32Array(0);
  let weights = new Float32Array(0);
  let env = new Float32Array(0);
  let targets = new Float32Array(0);
  let carve = new Float32Array(0);
  const scratch = { dy: 0, scale: 1 };
  const atX = (i: number) => xs[i];
  const muted: number[] = [];
  const accent: number[] = [];
  const ducked = { duck: env as ArrayLike<number>, muted: [] as number[], accent: [] as number[] };
  const painter = createDotPainter(ctx);
  let theme: Theme = "light";
  let alphas: Alphas = { muted: 0.3, accent: 0.5 };
  const cursor: Cursor = { x: -1e4, y: -1e4, on: false };
  let rects: Rect[] = [];
  const strip = { top: 0, bottom: 0 };
  let width = 0;
  let viewportH = window.innerHeight;
  let scrollTop = window.scrollY;
  let lastTime = -Infinity;
  let primed = false;
  let ducking = false;
  let painted = false;
  let shown: boolean | null = null;
  let measureRaf = 0;
  let stillRaf = 0;
  let destroyed = false;

  const readColors = () => {
    painter.readColors();
    theme = themeNow();
    alphas = typeof options.alphas === "function" ? options.alphas(theme) : options.alphas;
  };

  const sweepNow = () => (still ? 1 : conductor.sweep.value);

  const paint = (time: number) => {
    ctx.clearRect(0, 0, width, HORIZON.height);
    painted = false;
    ducking = false;
    const sweep = sweepNow();
    if (sweep <= 0 || !layout.columns) return;
    layTrack(layout, sweep, "horizon", layout.baseline, open, xs, offsets, weights, scratch);
    strip.top = scrollTop + viewportH - HORIZON.height;
    strip.bottom = scrollTop + viewportH;
    duckTargets(rects, xs, strip, targets);
    const dt = Math.min(Math.max(time - lastTime, 0), MAX_STEP_S);
    lastTime = time;
    // A fresh layout lands already ducked rather than easing down under text.
    if (still || !primed) {
      env.set(targets);
      primed = true;
    } else {
      ducking = stepDuck(env, targets, dt);
    }
    for (let i = 0; i < weights.length; i++) weights[i] *= 1 - env[i];
    buildDots(conductor.field, track, time, weights, cursor, muted, accent, atX, ducked);
    const floor = DUCK_ALPHA[theme];
    painter.fill(muted, painter.colors.muted, alphas.muted);
    painter.fill(accent, painter.colors.accent, alphas.accent);
    painter.fill(ducked.muted, painter.colors.muted, floor);
    painter.fill(ducked.accent, painter.colors.accent, floor);
    ctx.globalAlpha = 1;
    painted = true;
  };

  const { pointer, dispose: disposePointer } = trackPointer(!still && window.matchMedia("(pointer: fine)").matches, () =>
    conductor.wake(),
  );

  const view: WaveViewHandle = {
    // The cursor carves and repels only while it is over the strip.
    prepare() {
      const top = viewportH - HORIZON.height;
      cursor.on = pointer.on && pointer.y >= top;
      if (!cursor.on) return;
      cursor.x = pointer.x;
      cursor.y = pointer.y - top;
      carveLayout.startX = trainX(0, layout, layout.columns, sweepNow(), "horizon");
      carveTargets(carveLayout, cursor, carve);
      const shared = conductor.carve;
      for (let i = 0; i < carve.length && i < shared.length; i++) if (carve[i] > shared[i]) shared[i] = carve[i];
    },
    paint,
    // Painted while any of the train is here, plus one frame to clear the
    // canvas once it has all gone back to the band.
    active: () => conductor.sweep.value > 0 || painted,
    busy: () => ducking,
    setActive() {},
    destroy() {
      destroyed = true;
      if (measureRaf) cancelAnimationFrame(measureRaf);
      if (stillRaf) cancelAnimationFrame(stillRaf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      ScrollTrigger.removeEventListener("refresh", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", onScroll);
      disposePointer();
      host.getAnimations().forEach((animation) => animation.cancel());
      host.style.opacity = "";
    },
  };

  // Reduced motion: no loop, so the strip repaints itself and fades. The
  // still line is painted before the fade starts.
  const stillFrame = () => {
    stillRaf = 0;
    const next = conductor.sweep.target >= 0.5;
    if (next) paint(conductor.time);
    if (next === shown) return;
    const first = shown === null;
    shown = next;
    host.style.opacity = next ? "1" : "0";
    if (!first) host.animate({ opacity: next ? [0, 1] : [1, 0] }, { duration: FADE_MS, easing: "ease-out" });
  };

  const refresh = () => {
    if (still) return stillFrame();
    if (view.active()) paint(conductor.time);
    conductor.wake();
  };

  const measureRects = () => {
    const y = window.scrollY;
    const next: Rect[] = [];
    document.querySelectorAll<HTMLElement>(AVOID_SELECTOR).forEach((el) => {
      const r = inkBox(el);
      if (!r) return;
      next.push({
        left: r.left - DUCK.padPx,
        right: r.right + DUCK.padPx,
        top: r.top + y - DUCK.padPx,
        bottom: r.bottom + y + DUCK.padPx,
      });
    });
    rects = next.sort((a, b) => a.top - b.top);
  };

  const measure = () => {
    measureRaf = 0;
    width = host.clientWidth;
    viewportH = window.innerHeight;
    scrollTop = window.scrollY;
    sizeCanvas(canvas, ctx, width, HORIZON.height);

    layout = horizonLayout(width);
    conductor.setColumns(layout.columns, view);
    const n = layout.columns;
    xs = new Float32Array(n);
    offsets = new Float32Array(n);
    weights = new Float32Array(n);
    env = new Float32Array(n);
    targets = new Float32Array(n);
    carve = new Float32Array(n);
    ducked.duck = env;
    primed = false;
    track = { ...layout, baselineOffset: offsets };
    Object.assign(carveLayout, layout);
    open = columnWeights({ ...layout, reach: 1, feather: 0, edgeTaper: width <= PHONE_MAX_PX ? 24 : 96, rects: [] });
    measureRects();
    refresh();
  };

  const scheduleMeasure = () => {
    if (!destroyed && !measureRaf) measureRaf = requestAnimationFrame(measure);
  };

  const onScroll = () => {
    scrollTop = window.scrollY;
    if (still && !stillRaf) stillRaf = requestAnimationFrame(stillFrame);
  };

  readColors();
  measure();

  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(host);
  const main = document.querySelector("main");
  if (main) resizeObserver.observe(main);
  ScrollTrigger.addEventListener("refresh", scheduleMeasure);
  window.addEventListener("resize", scheduleMeasure);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.fonts?.ready.then(scheduleMeasure);

  const themeObserver = new MutationObserver(() => {
    readColors();
    refresh();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return view;
}

// The box the element's words cover, viewport px: a block heading spans its
// whole container, but only its words need the wave out of the way, so the
// air beside a short heading keeps the wave. Left and right come from the
// text, top and bottom from the element: a reveal holds a heading's words
// translated below their box until it plays, and no observer sees a
// transform end, so the element's own box is the steadier vertical. Falls
// back to the element's box when it holds no text. Icons count as words.
function inkBox(el: HTMLElement): Rect | null {
  const own = el.getBoundingClientRect();
  if (!own.width || !own.height) return null;
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
  el.querySelectorAll("svg, img").forEach((icon) => {
    const r = icon.getBoundingClientRect();
    if (!r.width) return;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  });
  if (left > right) return { left: own.left, right: own.right, top: own.top, bottom: own.bottom };
  return { left: Math.max(left, own.left), right: Math.min(right, own.right), top: own.top, bottom: own.bottom };
}
