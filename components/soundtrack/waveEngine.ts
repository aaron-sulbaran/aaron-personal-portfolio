import { getSoundtrackPlayer } from "@/lib/audio";
import { getSoundtrackState, subscribeSoundtrack } from "@/lib/soundtrack";
import { FLOOR, createField, regimeOf, stepField, type Field } from "@/lib/waveform/field";
import { buildDots, carveTargets, reachOf, type Cursor } from "@/lib/waveform/dots";
import { DPR_CAP, PHONE_MAX_PX, bandLayout } from "@/lib/waveform/layout";
import { columnWeights, type Rect } from "@/lib/waveform/weights";

// The imperative side of the band's waveform: sizing, weights, colors, the
// cursor and the loop. The math lives in lib/waveform; this file only feeds it
// and paints the dots.
//
// The canvas fills its parent and is sized by a ResizeObserver, never the
// viewport. The loop runs only while the band is in view (the caller's
// IntersectionObserver), the tab is visible and the wave is not frozen; it
// caps at 60fps and eases by elapsed time, so a 120Hz display neither burns
// twice the frames nor runs the transitions faster. Once the still regime
// ("Maybe later") settles, the loop stops until the music, the cursor or the
// band wakes it. `still` (reduced motion) draws one flat line and never loops.

const MIN_FRAME_MS = 1000 / 60 - 2;
const MAX_STEP_S = 0.1;
const AVOID_PAD = 6; // px of air kept between the copy and the nearest dot
const FEATHER = 48;

export interface WaveEngine {
  setActive(active: boolean): void;
  setFrozen(frozen: boolean): void;
  destroy(): void;
}

export function createWaveEngine(canvas: HTMLCanvasElement, still: boolean): WaveEngine | null {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  if (!ctx || !host) return null;
  const band = canvas.closest("section") ?? host;
  const player = getSoundtrackPlayer();

  let layout = bandLayout(0, 0);
  let field: Field = createField(0, regimeOf(getSoundtrackState()));
  let weights: Float32Array = new Float32Array(0);
  let carve: Float32Array = new Float32Array(0);
  const muted: number[] = [];
  const accent: number[] = [];
  const colors = { muted: "rgb(136,136,136)", accent: "rgb(127,168,201)" };
  const cursor: Cursor = { x: -1e4, y: -1e4, on: false };
  const pointer = { x: -1e4, y: -1e4, on: false };
  let width = 0;
  let height = 0;
  let active = false;
  let frozen = false;
  let raf = 0;
  let measureRaf = 0;
  let last = 0;
  let lastTime = 0;

  const readColors = () => {
    const style = getComputedStyle(document.documentElement);
    const toRgb = (hex: string, fallback: string) => {
      if (!hex.startsWith("#")) return fallback;
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
    };
    colors.muted = toRgb(style.getPropertyValue("--color-muted").trim(), colors.muted);
    colors.accent = toRgb(style.getPropertyValue("--color-accent").trim(), colors.accent);
  };

  const fill = (dots: number[], color: string, alpha: number) => {
    if (!dots.length) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < dots.length; k += 3) {
      // moveTo the circle's right edge first so the batched path never joins
      // consecutive dots with a stray chord.
      ctx.moveTo(dots[k] + dots[k + 2], dots[k + 1]);
      ctx.arc(dots[k], dots[k + 1], dots[k + 2], 0, Math.PI * 2);
    }
    ctx.fill();
  };

  const paint = (time: number) => {
    ctx.clearRect(0, 0, width, height);
    buildDots(field, layout, time, weights, cursor, muted, accent);
    fill(muted, colors.muted, 0.55);
    fill(accent, colors.accent, 0.9);
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

  // One step of the field; returns true once it has come to rest.
  const step = (t: number, dt: number): boolean => {
    const time = t / 1000; // the rAF clock is ms; every wave sine runs in seconds
    lastTime = time;
    syncCursor();
    carveTargets(layout, cursor, carve);
    const frame = player.sample(t, layout.columns);
    const { settled } = stepField(field, {
      time,
      dt,
      regime: regimeOf(getSoundtrackState()),
      bands: frame.bands,
      audioLevel: frame.level,
      weights,
      carve,
    });
    paint(time);
    return settled && !cursor.on;
  };

  const running = () => active && !frozen && !still && !document.hidden;

  const tick = (t: number) => {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(tick);
    if (last && t - last < MIN_FRAME_MS) return;
    const dt = last ? Math.min((t - last) / 1000, MAX_STEP_S) : 1 / 60;
    last = t;
    if (step(t, dt)) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const wake = () => {
    if (raf || !running()) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  const measure = () => {
    measureRaf = 0;
    width = host.clientWidth;
    height = host.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    layout = bandLayout(width, height);
    const previous = field;
    field = createField(layout.columns);
    field.levels = previous.levels;
    field.mag.set(previous.mag.subarray(0, Math.min(previous.mag.length, layout.columns)));
    if (still) field.mag.fill(FLOOR);
    carve = new Float32Array(layout.columns);

    const origin = canvas.getBoundingClientRect();
    const rects: Rect[] = [];
    band.querySelectorAll<HTMLElement>("[data-wave-avoid]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rects.push({
        left: r.left - origin.left - AVOID_PAD,
        right: r.right - origin.left + AVOID_PAD,
        top: r.top - origin.top - AVOID_PAD,
        bottom: r.bottom - origin.top + AVOID_PAD,
      });
    });
    weights = columnWeights({
      ...layout,
      reach: reachOf(layout.maxAmp),
      feather: FEATHER,
      edgeTaper: width <= PHONE_MAX_PX ? 24 : 96,
      rects,
    });
    // Repaint at once so a resize never leaves the canvas blank while paused.
    paint(lastTime);
  };

  const scheduleMeasure = () => {
    if (!measureRaf) measureRaf = requestAnimationFrame(measure);
  };

  readColors();
  measure();

  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(host);
  band.querySelectorAll("[data-wave-avoid]").forEach((el) => resizeObserver.observe(el));

  const themeObserver = new MutationObserver(() => {
    readColors();
    if (!raf) paint(lastTime);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const fine = !still && window.matchMedia("(pointer: fine)").matches;
  const onPointerMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.on = true;
    wake();
  };
  const onPointerLeave = () => {
    pointer.on = false;
  };
  if (fine) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave);
  }
  document.addEventListener("visibilitychange", wake);
  const unsubscribe = subscribeSoundtrack(wake);

  return {
    setActive(next) {
      active = next;
      wake();
    },
    setFrozen(next) {
      frozen = next;
      wake();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      if (measureRaf) cancelAnimationFrame(measureRaf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      unsubscribe();
      if (fine) {
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("mouseleave", onPointerLeave);
      }
      document.removeEventListener("visibilitychange", wake);
    },
  };
}
