import { createDotPainter } from "@/components/soundtrack/viewParts";
import { createConveyor, feedScroll, stepConveyor } from "@/lib/waveform/conveyor";
import { easeToward } from "@/lib/waveform/field";
import { buildLabDots, type DotGeometry } from "./labDots";
import { sampleLoop, stillTime, type LoopInput, type LoopOut } from "./loops";
import type { Placement, ThemeName, WaveSettings } from "./settings";
import { bandAt, createSpectrum, stepSpectrum } from "./spectrum";

// The lab's one loop. Canvases attach as surfaces (one for a fixed placement,
// one per slot for the in-flow ones); every frame steps the clock, the eased
// music level, the simulated spectrum and the conveyor once, then paints each
// surface in view. Layout reads happen only on resize or a settings change;
// the frame writes into arrays sized there and allocates nothing. Colors come
// from the tokens once per theme (viewParts' painter). The loop stops while
// the tab is hidden, under reduced motion (one still frame instead), and when
// no surface is in view.

const DPR_CAP = 2;
const FRAME_MS = 1000 / 60 - 2;
const MAX_STEP_S = 0.1;
// Each in-flow slot runs its loop this far (in periods) behind the one above,
// so a page of seams never pulses in lockstep.
const SLOT_STAGGER = 0.29;

type Painter = ReturnType<typeof createDotPainter>;

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  painter: Painter;
  host: HTMLElement;
  kind: Placement;
  index: number;
  visible: boolean;
  width: number;
  height: number;
  length: number;
  columns: number;
  weights: Float32Array;
  out: LoopOut;
  input: LoopInput;
  geo: DotGeometry;
  io: IntersectionObserver | null;
}

export interface WaveEngine {
  start(): void;
  update(settings: WaveSettings, reduced: boolean): void;
  attach(canvas: HTMLCanvasElement, kind: Placement, index: number): () => void;
  stop(): void; // restartable: React's dev double effect runs stop, then start again
  hold(seconds: number | null): void; // pin the clock (a still at a known phase); null runs it again
}

const isVisible = (s: Surface) => s.visible;

const themeNow = (): ThemeName => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

const smooth = (v: number) => {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};

// No DOM access until start() or attach(): this is created during render.
export function createWaveEngine(initial: WaveSettings): WaveEngine {
  let settings = initial;
  let reduced = false;
  let started = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let music = 0;
  let held: number | null = null;
  let theme: ThemeName = "light";
  let lastScrollY = 0;
  const surfaces: Surface[] = [];
  const muted: number[] = [];
  const accent: number[] = [];
  const spectrum = createSpectrum();
  const conveyor = createConveyor();
  let resizeObserver: ResizeObserver | null = null;
  let themeObserver: MutationObserver | null = null;

  const layout = (s: Surface) => {
    const width = s.host.clientWidth;
    const height = s.host.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    s.canvas.width = Math.max(1, Math.round(width * dpr));
    s.canvas.height = Math.max(1, Math.round(height * dpr));
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.width = width;
    s.height = height;
    const vertical = s.kind === "rail";
    s.length = vertical ? height : width;
    const across = vertical ? width : height;
    const spacing = settings.spacing;
    const columns = Math.max(0, Math.floor(s.length / spacing));
    if (columns !== s.columns) {
      s.columns = columns;
      s.weights = new Float32Array(columns);
      s.out = {
        mag: new Float32Array(columns),
        disp: new Float32Array(columns),
        presence: new Float32Array(columns),
        tip: new Float32Array(columns),
      };
    }
    // The amplitude tapers toward the ends over the same span the CSS mask
    // fades, so the ends thin out as well as fade.
    const fadePx = settings.edgeFade * s.length;
    for (let i = 0; i < columns; i++) {
      const along = i * spacing + spacing / 2;
      const fromEdge = Math.min(along, s.length - along);
      s.weights[i] = fadePx > 0 ? 0.35 + 0.65 * smooth(fromEdge / fadePx) : 1;
    }
    const lift = s.kind === "horizon" ? settings.position.horizon : 0;
    s.geo = {
      columns,
      spacing,
      baseline: s.kind === "horizon" ? height - lift : across / 2,
      maxAmp: settings.amplitude,
      maxThick: settings.maxThick,
      dotScale: settings.dotScale,
      vertical,
      seed: s.index + 1,
    };
    s.input.columns = columns;
    s.input.spacing = spacing;
    s.input.length = s.length;
  };

  const paintSurface = (s: Surface, time: number) => {
    const { ctx } = s;
    ctx.clearRect(0, 0, s.width, s.height);
    if (!s.columns) return;
    const input = s.input;
    input.kind = settings.loop;
    input.period = settings.period;
    input.speed = settings.speed;
    input.time = time + s.index * SLOT_STAGGER * settings.period;
    input.shift = conveyor.phase * settings.spacing * settings.scrollInfluence;
    sampleLoop(input, s.out);

    // The music rides on top of the loop, as the reactive term does in
    // lib/waveform/field.ts: the spectrum thickens its columns, the level
    // swings the line. The bands stay bound to their columns.
    if (music > 1e-3) {
      const { mag, disp } = s.out;
      const n = s.columns;
      for (let i = 0; i < n; i++) {
        mag[i] += bandAt(spectrum, i / Math.max(1, n - 1));
        disp[i] += (Math.sin(i * 0.3 + time * 3) * 0.42 + Math.sin(i * 0.13 + time * 1.5) * 0.2) * spectrum.level;
      }
    }

    buildLabDots(s.geo, s.out.mag, s.out.disp, s.out.presence, s.out.tip, s.weights, time, muted, accent);
    const alphas = settings.alpha[theme];
    s.painter.fill(muted, s.painter.colors.muted, alphas.muted);
    s.painter.fill(accent, s.painter.colors.accent, alphas.accent);
    ctx.globalAlpha = 1;
  };

  const paintAll = (time: number) => {
    for (let k = 0; k < surfaces.length; k++) if (surfaces[k].visible) paintSurface(surfaces[k], time);
  };

  const paintStill = () => {
    const length = surfaces[0]?.length ?? 1200;
    paintAll(stillTime(settings.loop, settings.period, length, settings.speed));
  };

  const running = () => started && !reduced && !document.hidden && surfaces.some(isVisible);

  const tick = (t: number) => {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(tick);
    if (last && t - last < FRAME_MS) return;
    const dt = last ? Math.min((t - last) / 1000, MAX_STEP_S) : 1 / 60;
    last = t;
    clock = held ?? clock + dt;
    const target = settings.music ? 1 : 0;
    // The real field's reactive rates: springs up at 0.05, falls at 0.11.
    music = easeToward(music, target, target > music ? 0.05 : 0.11, dt);
    stepSpectrum(spectrum, clock, dt, music * settings.intensity, settings.beat);
    stepConveyor(conveyor, dt, false);
    paintAll(clock);
  };

  const wake = () => {
    if (raf || !running()) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  const refresh = () => {
    if (!started) return;
    if (running()) wake();
    else if (reduced) paintStill();
  };

  const onScroll = () => {
    const y = window.scrollY;
    if (settings.scrollInfluence > 0) feedScroll(conveyor, y - lastScrollY);
    lastScrollY = y;
  };

  const onResize = (entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      const s = surfaces.find((surface) => surface.host === entry.target);
      if (s) layout(s);
    }
    if (reduced) paintStill();
  };

  const readTheme = () => {
    theme = themeNow();
    for (const s of surfaces) s.painter.readColors();
    if (reduced) paintStill();
  };

  return {
    start() {
      if (started) return;
      started = true;
      theme = themeNow();
      lastScrollY = window.scrollY;
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", wake);
      themeObserver = new MutationObserver(readTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      for (const s of surfaces) s.painter.readColors();
      refresh();
    },
    update(next, nextReduced) {
      settings = next;
      reduced = nextReduced;
      for (const s of surfaces) layout(s);
      if (!running() && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      refresh();
    },
    attach(canvas, kind, index) {
      const ctx = canvas.getContext("2d");
      const host = canvas.parentElement;
      if (!ctx || !host) return () => {};
      const surface: Surface = {
        canvas,
        ctx,
        painter: createDotPainter(ctx),
        host,
        kind,
        index,
        visible: kind !== "seams" && kind !== "chapters",
        width: 0,
        height: 0,
        length: 0,
        columns: -1,
        weights: new Float32Array(0),
        out: { mag: new Float32Array(0), disp: new Float32Array(0), presence: new Float32Array(0), tip: new Float32Array(0) },
        input: { kind: settings.loop, columns: 0, spacing: settings.spacing, length: 0, shift: 0, time: 0, period: settings.period, speed: settings.speed },
        geo: { columns: 0, spacing: settings.spacing, baseline: 0, maxAmp: 0, maxThick: 0, dotScale: 1, vertical: false, seed: 0 },
        io: null,
      };
      surface.painter.readColors();
      surfaces.push(surface);
      layout(surface);
      if (!resizeObserver) resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(host);
      if (!surface.visible) {
        surface.io = new IntersectionObserver(
          ([entry]) => {
            surface.visible = entry.isIntersecting;
            if (!surface.visible) surface.ctx.clearRect(0, 0, surface.width, surface.height);
            refresh();
          },
          { rootMargin: "120px 0px" },
        );
        surface.io.observe(host);
      }
      refresh();
      return () => {
        const at = surfaces.indexOf(surface);
        if (at >= 0) surfaces.splice(at, 1);
        resizeObserver?.unobserve(host);
        surface.io?.disconnect();
      };
    },
    hold(seconds) {
      held = seconds;
    },
    stop() {
      if (!started) return;
      started = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", wake);
      themeObserver?.disconnect();
      themeObserver = null;
    },
  };
}
