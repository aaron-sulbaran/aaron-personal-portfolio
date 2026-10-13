import { camera, cameraInto, luminance, mixRGB, type Cell, type HeightCurve, type RGB } from "@/lib/metrics/skyline/maths";
import { draw, extent, NO_DEPTH, type DepthSpec, type Scene } from "./draw";
import { newCssCache } from "@/lib/metrics/skyline/cssCache";
import { newAlphaCss, resolveColor, resolveRGBA, rgbString } from "./paint";
import { attachInput, type Ctl } from "./input";
import { capture, loadModel, startFrom } from "./load";
import { OUTLINE_LEN, SILHOUETTE_LEN } from "@/lib/metrics/skyline/prism";

// The imperative half: one scene per mount, a rAF loop that only runs while
// something moves, pointer and keyboard input. React hands it a config ref
// it re-reads every frame, so the loop never closes over stale props.

// `curve` maps a count to a bar's height; `stack`, when the series has two
// tools, is each cell's lower share (lib/metrics/skyline/stack.ts).
export type Model = {
  cells: Cell[];
  weeks: number;
  max: number;
  months: { week: number; label: string }[];
  curve: HeightCurve;
  stack: number[] | null;
};

// The legend's colours: the empty day and the lower tool's four steps, and
// for a stacked series each tool's strongest step for the key.
export type ThemeReadout = { dark: boolean; swatches: string[]; key: string[] };

export type EngineConfig = {
  model: Model;
  duration: number;
  heightScale: number;
  orbit: boolean;
  palette: string[];
  palette2: string[] | null;
  switchMs: number;
  switchStagger: number;
  legendLevel: number;
  target: 0 | 1;
  depth: DepthSpec;
  locale: string;
  setActive: (i: number) => void;
  setTheme: (update: (prev: ThemeReadout) => ThemeReadout) => void;
  setAnnounce: (text: string) => void;
  describe: (i: number) => string;
};

export type Engine = {
  kick: () => void;
  // The model changed: every bar moves from what it shows now to the new one.
  load: () => void;
  retheme: () => void;
  tipWidth: (w: number) => void;
  destroy: () => void;
};

export type EngineElements = {
  stage: HTMLDivElement;
  canvas: HTMLCanvasElement;
  tip: HTMLDivElement;
  probe: HTMLElement; // resolves token colours
  labelProbe: HTMLElement; // carries the label face, so its computed family names the canvas font
};

const FALLBACK: RGB = [128, 128, 128];
const LABEL_PX = 12.72; // the label face's label-sm step

export function createEngine(el: EngineElements, cfg: { current: EngineConfig }): Engine | null {
  const ctx = el.canvas.getContext("2d");
  if (!ctx) return null;
  const { stage, canvas } = el;

  const s: Scene = {
    ctx,
    canvas,
    stage,
    tip: el.tip,
    t: 0,
    yaw: 0,
    elev: 0,
    W: 0,
    H2: 0,
    H3: 0,
    Hmax: 0,
    lastH: -1,
    dpr: 1,
    gutter: 30,
    labelW: 30,
    font: "700 " + LABEL_PX + "px sans-serif",
    col: new Float32Array(18),
    col2: new Float32Array(12),
    fg: FALLBACK,
    bg: FALLBACK,
    muted: FALLBACK,
    n: 0,
    weeks: 0,
    wk: new Float32Array(0),
    dy: new Float32Array(0),
    lv: new Uint8Array(0),
    skip: new Uint8Array(0),
    hFrom: new Float32Array(0),
    hTo: new Float32Array(0),
    hgt: new Float32Array(0),
    shFrom: new Float32Array(0),
    shTo: new Float32Array(0),
    shr: new Float32Array(0),
    cFrom: new Float32Array(0),
    low: new Float32Array(0),
    up: new Float32Array(0),
    sw: 1,
    swStagger: 0,
    tone: new Float32Array(6),
    zs: new Float32Array(0),
    hover: new Float32Array(0),
    dim: new Float32Array(0),
    polys: new Float32Array(0),
    faces: new Uint8Array(0),
    outline: new Float32Array(OUTLINE_LEN * 2),
    sil: new Float32Array(SILHOUETTE_LEN * 2),
    order: [],
    sortKey: new Float64Array(0),
    sortCs: NaN,
    sortSn: NaN,
    months: [],
    weekdayRows: [],
    activeIdx: -1,
    tipW: 0,
    depth: NO_DEPTH,
    hi: FALLBACK,
    hiA: 0,
    shade: FALLBACK,
    cam: camera(0),
    ox: 0,
    oy: 0,
    sc: 1,
    ext: { minx: 0, maxx: 0, miny: 0, maxy: 0 },
    monthW: new Float64Array(0),
    shadeCss: "",
    outlineCss: newAlphaCss(),
    label2Css: newAlphaCss(),
    label3Css: newAlphaCss(),
    hiCss: newAlphaCss(),
    cellCss: newCssCache(0),
    tipAt: new Float64Array(3).fill(NaN),
  };

  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reduceMq.matches;
  const colGoal = new Float32Array(18);
  const col2Goal = new Float32Array(12);
  let colReady = false;
  const ctl: Ctl = { target: 0, yawGoal: 0, elevGoal: 0, hovered: -1, pinned: -1, firstDay: 0, lastDay: 0 };
  let raf = 0;
  let last = 0;
  let alive = true;
  let loaded: Cell[] = [];

  // A new model: the first one lands as it is; after that, every bar starts
  // from what it shows now and the switch clock runs (at once when reduced).
  const load = (switching: boolean) => {
    const shown = switching && s.n ? capture(s, loaded) : null;
    const m = cfg.current.model;
    loadModel(s, m, cfg.current.heightScale, cfg.current.locale);
    loaded = m.cells;
    ctl.firstDay = Math.max(0, m.cells.findIndex((c) => c.kind === "day"));
    ctl.lastDay = m.cells.reduce((at, c, i) => (c.kind === "day" ? i : at), 0);
    if (ctl.hovered >= s.n) ctl.hovered = -1;
    if (ctl.pinned >= s.n) ctl.pinned = -1;
    retheme(switching);
    startFrom(s, m.cells, shown);
    s.sw = shown && !reduced ? 0 : 1;
  };

  // `snap` lands the palettes at once: a series switch crossfades each bar
  // itself, so the palettes must not ease on top of it.
  const retheme = (snap = false) => {
    s.fg = resolveColor(el.probe, "var(--color-foreground)", FALLBACK);
    s.bg = resolveColor(el.probe, "var(--color-background)", FALLBACK);
    s.muted = resolveColor(el.probe, "var(--color-muted)", FALLBACK);
    const isDark = luminance(s.bg) < 0.45;
    s.font = "700 " + LABEL_PX + "px " + (getComputedStyle(el.labelProbe).fontFamily || "sans-serif");
    // An empty day is the site's hairline colour, so the bare grid reads as the
    // page's own rules; with flat depth it is paper, a few percent of ink off
    // the page, like the Coil's card body.
    const depth = cfg.current.depth;
    s.depth = depth;
    const empty =
      depth.mode === "none"
        ? resolveColor(el.probe, "var(--color-border)", mixRGB(s.bg, s.fg, isDark ? 0.11 : 0.075))
        : mixRGB(s.bg, s.fg, depth.paper / 100);
    [s.hi, s.hiA] = resolveRGBA(el.probe, "var(--card-hi)", [isDark ? s.fg : s.bg, isDark ? 0.09 : 0.75]);
    // Lift's shadow: the page's ink at about a tenth over paper; in dark, ink
    // would glow, so the shadow is the page at half its brightness instead.
    s.shade = isDark ? [s.bg[0] * 0.5, s.bg[1] * 0.5, s.bg[2] * 0.5] : mixRGB(s.bg, s.fg, 0.1);
    s.shadeCss = rgbString(s.shade[0], s.shade[1], s.shade[2]);
    const future = mixRGB(empty, s.bg, 0.55);
    const resolve = (list: string[]) => list.slice(0, 4).map((c) => resolveColor(el.probe, c, FALLBACK));
    const lower = resolve(cfg.current.palette);
    const upper = cfg.current.palette2 ? resolve(cfg.current.palette2) : lower;
    const all: RGB[] = [empty, ...lower, future];
    for (let k = 0; k < 6; k++) for (let ch = 0; ch < 3; ch++) colGoal[k * 3 + ch] = all[k][ch];
    for (let k = 0; k < 4; k++) for (let ch = 0; ch < 3; ch++) col2Goal[k * 3 + ch] = upper[k][ch];
    if (!colReady || reduced || snap) {
      s.col.set(colGoal);
      s.col2.set(col2Goal);
      colReady = true;
    }
    ctx.font = s.font;
    s.labelW = Math.ceil(Math.max(20, ...s.weekdayRows.map((r) => ctx.measureText(r.label).width))) + 8;
    if (s.monthW.length !== s.months.length) s.monthW = new Float64Array(s.months.length);
    for (let k = 0; k < s.months.length; k++) s.monthW[k] = ctx.measureText(s.months[k].label).width;
    const css = (c: RGB) => rgbString(c[0], c[1], c[2]);
    const sw = all.slice(0, 5).map(css);
    const key = cfg.current.palette2 ? [css(lower[3]), css(upper[3])] : [];
    cfg.current.setTheme((prev) =>
      prev.dark === isDark && prev.swatches.join() === sw.join() && prev.key.join() === key.join() ? prev : { dark: isDark, swatches: sw, key },
    );
    kick();
  };

  const relayout = () => {
    const w = Math.round(stage.clientWidth);
    if (!w || !s.n) return;
    s.W = w;
    // Narrow charts give the weekday names' column to the grid instead; rows get too tight to label.
    s.gutter = w < 520 ? 0 : s.labelW;
    s.dpr = Math.min(2, window.devicePixelRatio || 1);
    // extent() reuses one bounds object, so each result is read before the next call.
    const b2 = extent(s, cameraInto(s.cam, 0), 0, true);
    s.H2 = 20 + 4 + ((b2.maxy - b2.miny) / (b2.maxx - b2.minx)) * (w - s.gutter - 4);
    const b3 = extent(s, cameraInto(s.cam, 1), 1, true);
    const natural = ((b3.maxy - b3.miny) / (b3.maxx - b3.minx)) * (w - 40) + 40;
    s.H3 = Math.max(Math.min(natural, w * 0.72, 620), Math.min(natural, 240));
    s.Hmax = Math.ceil(Math.max(s.H2, s.H3));
    canvas.width = Math.round(w * s.dpr);
    canvas.height = Math.round(s.Hmax * s.dpr);
    canvas.style.width = w + "px";
    canvas.style.height = s.Hmax + "px";
    s.lastH = -1;
    s.depth = cfg.current.depth;
    draw(s);
    markState();
  };

  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    let moving = false;
    if (s.t !== ctl.target) {
      const step = reduced ? 1 : (dt * 1000) / Math.max(1, cfg.current.duration);
      s.t = ctl.target > s.t ? Math.min(ctl.target, s.t + step) : Math.max(ctl.target, s.t - step);
      moving = true;
    }
    s.swStagger = cfg.current.switchStagger;
    if (s.sw < 1) {
      s.sw = reduced ? 1 : Math.min(1, s.sw + (dt * 1000) / Math.max(1, cfg.current.switchMs));
      moving = true;
    }

    const ko = reduced ? 1 : 1 - Math.exp(-dt * 12);
    s.yaw += (ctl.yawGoal - s.yaw) * ko;
    s.elev += (ctl.elevGoal - s.elev) * ko;
    if (Math.abs(ctl.yawGoal - s.yaw) > 1e-4 || Math.abs(ctl.elevGoal - s.elev) > 1e-4) moving = true;
    else {
      s.yaw = ctl.yawGoal;
      s.elev = ctl.elevGoal;
    }

    const kc = reduced ? 1 : 1 - Math.exp(-dt * 7);
    for (let k = 0; k < 30; k++) {
      const into = k < 18 ? s.col : s.col2;
      const at = k < 18 ? k : k - 18;
      const goal = k < 18 ? colGoal[k] : col2Goal[at];
      const d = goal - into[at];
      if (Math.abs(d) > 0.4) {
        into[at] += d * kc;
        moving = true;
      } else into[at] = goal;
    }

    const kh = reduced ? 1 : 1 - Math.exp(-dt * 16);
    const kd = reduced ? 1 : 1 - Math.exp(-dt * 10);
    const leg = cfg.current.legendLevel;
    for (let i = 0; i < s.n; i++) {
      const hg = i === s.activeIdx ? 1 : 0;
      const dg = leg >= 0 && s.lv[i] !== leg ? 1 : 0;
      const h = s.hover[i];
      const d = s.dim[i];
      if (h !== hg) {
        s.hover[i] = Math.abs(hg - h) < 0.003 ? hg : h + (hg - h) * kh;
        moving = true;
      }
      if (d !== dg) {
        s.dim[i] = Math.abs(dg - d) < 0.003 ? dg : d + (dg - d) * kd;
        moving = true;
      }
    }

    s.depth = cfg.current.depth;
    draw(s);
    markState();
    if (moving) raf = requestAnimationFrame(tick);
  };

  function kick() {
    if (raf || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function markState() {
    const state = s.t <= 0 ? "flat" : s.t >= 1 ? "skyline" : "moving";
    if (stage.dataset.viewState !== state) stage.dataset.viewState = state;
    const switching = s.sw < 1 ? "moving" : "done";
    if (stage.dataset.switchState !== switching) stage.dataset.switchState = switching;
  }

  const orbitable = () => cfg.current.orbit && ctl.target === 1;

  // The active day is the hovered one, else the pinned one (tap, click or keyboard).
  const refreshActive = () => {
    const next = ctl.hovered >= 0 ? ctl.hovered : ctl.pinned;
    if (next === s.activeIdx) return;
    s.activeIdx = next;
    cfg.current.setActive(next);
    kick();
  };

  const setTarget = () => {
    const goal = cfg.current.target;
    if (goal !== ctl.target) {
      ctl.target = goal;
      if (goal === 0) {
        ctl.yawGoal = 0;
        ctl.elevGoal = 0;
      }
      canvas.style.cursor = orbitable() ? "grab" : "default";
    }
  };

  load(false);
  relayout();

  // The morph starts flat and moves toward the first target on the one clock.
  setTarget();
  kick();

  const ro = new ResizeObserver(() => {
    if (Math.round(stage.clientWidth) !== s.W) relayout();
  });
  ro.observe(stage);

  // The site's theme is data-theme on <html>, and only a change of it rethemes:
  // the inline style there is written by every ScrollTrigger refresh and
  // scroll lock. The label face may land after first paint (fonts.ready).
  let themeSeen = document.documentElement.dataset.theme;
  const mo = new MutationObserver(() => {
    const next = document.documentElement.dataset.theme;
    if (next === themeSeen) return;
    themeSeen = next;
    retheme();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.fonts?.ready.then(() => {
    if (!alive) return;
    retheme();
    relayout();
  });
  const onReduce = () => {
    reduced = reduceMq.matches;
    kick();
  };
  reduceMq.addEventListener("change", onReduce);
  const detachInput = attachInput({ s, ctl, cfg, kick, refreshActive, orbitable });

  return {
    kick: () => {
      setTarget();
      kick();
    },
    load: () => {
      load(true);
      relayout();
    },
    retheme: () => retheme(),
    tipWidth: (w: number) => {
      s.tipW = w;
      draw(s);
    },
    destroy: () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      reduceMq.removeEventListener("change", onReduce);
      detachInput();
    },
  };
}
