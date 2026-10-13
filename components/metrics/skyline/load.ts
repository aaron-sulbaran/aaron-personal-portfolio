import { barHeight, dayMs, type Cell } from "@/lib/metrics/skyline/maths";
import { newCssCache } from "@/lib/metrics/skyline/cssCache";
import type { Scene } from "./draw";
import type { Model } from "./engine";
import { CELL_SLOTS } from "./paint";

// A model into the scene's typed arrays, and the switch's starting point:
// what each bar showed when the series changed, matched by date.

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
