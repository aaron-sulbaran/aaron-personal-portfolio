import { barHeight, camera, dayMs, type Cell, type RGB } from "@/lib/metrics/skyline/maths";
import { newCssCache } from "@/lib/metrics/skyline/cssCache";
import { OUTLINE_LEN, SILHOUETTE_LEN } from "@/lib/metrics/skyline/prism";
import { NO_DEPTH, type Scene } from "./draw";
import type { Model } from "./engine";
import { CELL_SLOTS, newAlphaCss } from "./paint";

// The scene at rest, a model into its typed arrays, and the switch's starting
// point: what each bar showed when the series changed, matched by date.

export const newScene = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stage: HTMLDivElement,
  tip: HTMLDivElement,
  fallback: RGB,
  font: string,
): Scene => ({
  ctx,
  canvas,
  stage,
  tip,
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
  font,
  col: new Float32Array(18),
  col2: new Float32Array(12),
  fg: fallback,
  bg: fallback,
  bgCss: "",
  muted: fallback,
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
  gap: 0,
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
  hi: fallback,
  hiA: 0,
  shade: fallback,
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
});

const grow = (s: Scene, n: number) => {
  if (s.wk.length === n) return;
  s.wk = new Float32Array(n);
  s.dy = new Float32Array(n);
  s.lv = new Uint8Array(n);
  s.skip = new Uint8Array(n);
  s.hFrom = new Float32Array(n);
  s.hTo = new Float32Array(n);
  s.hgt = new Float32Array(n);
  s.shFrom = new Float32Array(n);
  s.shTo = new Float32Array(n);
  s.shr = new Float32Array(n);
  s.cFrom = new Float32Array(n * 6);
  s.low = new Float32Array(n * 3);
  s.up = new Float32Array(n * 3);
  s.zs = new Float32Array(n);
  s.hover = new Float32Array(n);
  s.dim = new Float32Array(n);
  s.polys = new Float32Array(n * 24);
  s.faces = new Uint8Array(n);
  s.order = Array.from({ length: n }, (_, i) => i);
  s.sortKey = new Float64Array(n);
  s.cellCss = newCssCache(n * CELL_SLOTS);
};

export function loadModel(s: Scene, m: Model, heightScale: number, locale: string) {
  const n = m.cells.length;
  grow(s, n);
  s.n = n;
  s.weeks = m.weeks;
  s.sortCs = NaN;
  for (let i = 0; i < n; i++) {
    const c = m.cells[i];
    s.wk[i] = c.week;
    s.dy[i] = c.day;
    s.lv[i] = c.kind === "future" ? 5 : c.level;
    s.skip[i] = c.kind === "outside" ? 1 : 0;
    s.hTo[i] = barHeight(c.count, m.max, heightScale, m.curve);
    s.shTo[i] = m.stack ? m.stack[i] : 1;
  }
  s.months = m.months;
  const wf = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  s.weekdayRows = [];
  for (let d = 0; d < 7 && d < n; d++) {
    const dow = new Date(dayMs(m.cells[d].date)).getUTCDay();
    if (dow === 1 || dow === 3 || dow === 5) s.weekdayRows.push({ day: d, label: wf.format(dayMs(m.cells[d].date)) });
  }
}

// What the bars show this frame, by date, copied out before a new model
// reallocates the arrays.
export type Shown = { at: Map<string, number>; h: Float32Array; sh: Float32Array; low: Float32Array; up: Float32Array };

export const capture = (s: Scene, cells: Cell[]): Shown => ({
  at: new Map(cells.map((c, i) => [c.date, i])),
  h: s.hgt.slice(0, s.n),
  sh: s.shr.slice(0, s.n),
  low: s.low.slice(0, s.n * 3),
  up: s.up.slice(0, s.n * 3),
});

// The switch starts from what was shown; a day the last model did not have
// grows from nothing in the empty colour. With nothing shown, there is no
// switch: every bar starts where it ends.
export function startFrom(s: Scene, cells: Cell[], shown: Shown | null) {
  for (let i = 0; i < s.n; i++) {
    const j = shown ? shown.at.get(cells[i].date) : undefined;
    const o = i * 6;
    if (shown && j !== undefined) {
      s.hFrom[i] = shown.h[j];
      s.shFrom[i] = shown.sh[j];
      for (let ch = 0; ch < 3; ch++) {
        s.cFrom[o + ch] = shown.low[j * 3 + ch];
        s.cFrom[o + 3 + ch] = shown.up[j * 3 + ch];
      }
    } else {
      s.hFrom[i] = shown ? 0 : s.hTo[i];
      s.shFrom[i] = shown ? 1 : s.shTo[i];
      for (let ch = 0; ch < 3; ch++) {
        s.cFrom[o + ch] = s.col[ch];
        s.cFrom[o + 3 + ch] = s.col[ch];
      }
    }
  }
}
