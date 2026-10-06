// Adapted from "Contribution Skyline" on 21st.dev (https://21st.dev/).
// The pure half: dates, grid, stats, levels, camera and colour maths. No DOM.

export type ContributionDay = { date: string; count: number };
// "day" is a real day in range; "outside" pads the first week before the
// range starts (never drawn); "future" is a day after today, drawn as a slab.
export type CellKind = "day" | "outside" | "future";
export type Cell = { date: string; count: number; level: number; week: number; day: number; kind: CellKind };
export type Streak = { days: number; start: string | null; end: string | null };
export type ContributionStats = {
  total: number;
  active: number;
  days: number; // real days in range
  first: string | null;
  last: string | null;
  busiest: { count: number; date: string | null };
  longest: Streak;
  current: Streak;
};
export type RGB = [number, number, number];
export type HeightCurve = "power" | "sqrt" | "log";
// How a day's share of a busy day maps to the four colour steps.
export type LevelCurve = "linear" | "sqrt";

export const DAY_MS = 86400000;

export const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeInOutCubic = (x: number): number => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// UTC midnight to "YYYY-MM-DD".
export const toKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Any date-ish value to UTC midnight of its calendar day. "YYYY-MM-DD" strings
// are read literally (no timezone drift), Date objects by their local day,
// numbers as UTC timestamps.
export const dayMs = (v: string | number | Date): number => {
  if (typeof v === "number") return Math.floor(v / DAY_MS) * DAY_MS;
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    v = new Date(v);
  }
  return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
};

// mulberry32: small, fast, deterministic.
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// A believable year for comparison only: quiet weekends, a few busy seasons,
// a mood that drifts week to week, and the odd enormous day.
export const generateContributions = (endMs: number, seed = 7, days = 371): ContributionDay[] => {
  const r = rng(seed);
  const bursts = Array.from({ length: 4 }, () => ({ at: r(), width: 0.035 + r() * 0.07, gain: 0.6 + r() * 1.1 }));
  const out: ContributionDay[] = [];
  let mood = 0.5;
  for (let i = 0; i < days; i++) {
    const ms = endMs - (days - 1 - i) * DAY_MS;
    const x = i / Math.max(1, days - 1);
    const dow = new Date(ms).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    let heat = 0.2;
    for (const b of bursts) heat += b.gain * Math.exp(-((x - b.at) ** 2) / (2 * b.width ** 2));
    mood = mood * 0.85 + r() * 0.15;
    heat *= 0.55 + mood * 0.9;
    const pActive = Math.min(0.94, (weekend ? 0.22 : 0.5) + heat * 0.4);
    let count = 0;
    if (r() < pActive) count = 1 + Math.floor(-Math.log(1 - r()) * (1.2 + heat * 7) * (weekend ? 0.5 : 1));
    if (r() < 0.01) count += 18 + Math.floor(r() * 24);
    out.push({ date: toKey(ms), count });
  }
  return out;
};

// 0 for an empty day, else 1 to 4 by quarters of `busy` ("linear"), or by
// quarters of the square root of the share ("sqrt": steps at 1/16, 1/4 and
// 9/16 of `busy`, so a skewed year spreads over all four). Anything at or
// past `busy` is 4.
export const levelOf = (count: number, busy: number, curve: LevelCurve = "linear"): number => {
  if (count <= 0) return 0;
  if (busy <= 0) return 4;
  const share = Math.min(1, count / busy);
  return 1 + Math.min(3, Math.floor((curve === "sqrt" ? Math.sqrt(share) : share) * 4));
};

// The value at quantile q of an ascending list.
export const quantile = (sorted: number[], q: number): number =>
  sorted.length ? sorted[Math.floor(Math.max(0, Math.min(1, q)) * (sorted.length - 1))] : 0;

// The grid: columns are weeks, rows are weekdays (row 0 = `weekStart`).
// Without a range it is the original trailing year: it ends on `endMs` and
// starts on the week containing the day one year earlier. With `range.from`
// it starts on the week containing that day, the days before it padded as
// "outside"; with `range.through` past `endMs` the days after today are
// "future" slabs. Levels split the real days by their share of a busy day,
// the 95th percentile, so one freak day cannot wash every other day out.
// `max`, what the tallest bar stands for, is the busiest day unless
// `heightCap` names a lower quantile; days past it stand at full height.
export type GridRange = { from?: number; through?: number };
export type GridScale = { levelCurve?: LevelCurve; heightCap?: number };

export const buildGrid = (
  data: ContributionDay[],
  endMs: number,
  weekStart = 0,
  range: GridRange = {},
  { levelCurve = "linear", heightCap = 1 }: GridScale = {},
) => {
  const counts = new Map<string, number>();
  for (const d of data) {
    if (!d || typeof d.date !== "string") continue;
    const ms = dayMs(d.date);
    const c = Number(d.count);
    if (!Number.isFinite(ms) || !(c > 0) || !Number.isFinite(c)) continue;
    const k = toKey(ms);
    counts.set(k, (counts.get(k) ?? 0) + c);
  }
  const first = range.from ?? endMs - 364 * DAY_MS;
  const start = first - ((new Date(first).getUTCDay() - weekStart + 7) % 7) * DAY_MS;
  const last = Math.max(endMs, range.through ?? endMs);
  const cells: Cell[] = [];
  for (let ms = start, i = 0; ms <= last; ms += DAY_MS, i++) {
    const date = toKey(ms);
    const kind: CellKind = range.from !== undefined && ms < first ? "outside" : ms > endMs ? "future" : "day";
    const count = kind === "day" ? counts.get(date) ?? 0 : 0;
    cells.push({ date, count, level: 0, week: Math.floor(i / 7), day: i % 7, kind });
  }
  const nz = cells
    .map((c) => c.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const busy = quantile(nz, 0.95);
  for (const c of cells) c.level = levelOf(c.count, busy, levelCurve);
  return { cells, weeks: cells.length ? cells[cells.length - 1].week + 1 : 0, max: quantile(nz, heightCap) };
};

// Total, busiest day, longest run, and the run that reaches today (or yesterday; today is not over).
export const computeStats = (all: Cell[]): ContributionStats => {
  const cells = all.filter((c) => c.kind === "day");
  let total = 0;
  let active = 0;
  let best = 0;
  let bestDate: string | null = null;
  let run = 0;
  let runStart: string | null = null;
  let longest: Streak = { days: 0, start: null, end: null };
  for (const c of cells) {
    total += c.count;
    if (c.count > best) {
      best = c.count;
      bestDate = c.date;
    }
    if (c.count > 0) {
      active++;
      if (run === 0) runStart = c.date;
      run++;
      if (run > longest.days) longest = { days: run, start: runStart, end: c.date };
    } else run = 0;
  }
  let j = cells.length - 1;
  if (j >= 0 && cells[j].count === 0) j--;
  const endAt = j;
  while (j >= 0 && cells[j].count > 0) j--;
  const days = endAt - j;
  const current: Streak =
    days > 0 ? { days, start: cells[j + 1].date, end: cells[endAt].date } : { days: 0, start: null, end: null };
  return {
    total,
    active,
    days: cells.length,
    first: cells.length ? cells[0].date : null,
    last: cells.length ? cells[cells.length - 1].date : null,
    busiest: { count: best, date: bestDate },
    longest,
    current,
  };
};

// A label on each week whose first drawn day starts a new month; a cramped first label is dropped.
export const monthLabels = (cells: Cell[], weeks: number, locale = "en-US") => {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const out: { week: number; label: string }[] = [];
  let prev = -1;
  for (let w = 0; w < weeks; w++) {
    const c = cells.slice(w * 7, w * 7 + 7).find((x) => x.kind !== "outside");
    if (!c) break;
    const m = +c.date.slice(5, 7);
    if (m !== prev) out.push({ week: w, label: fmt.format(dayMs(c.date)) });
    prev = m;
  }
  if (out.length > 1 && out[1].week - out[0].week < 3) out.shift();
  return out;
};

// The share of the tallest bar a day reaches. "power" is the original's 0.85
// curve; "sqrt" and "log" lift the small days so one huge day does not flatten
// the rest of a sparse year into slabs.
export const heightShare = (count: number, max: number, curve: HeightCurve): number => {
  if (count <= 0 || max <= 0) return 0;
  const c = Math.min(count, max);
  if (curve === "log") return Math.log1p(c) / Math.log1p(max);
  return Math.pow(c / max, curve === "sqrt" ? 0.5 : 0.85);
};

// Box height in grid units. Empty days are thin slabs; the busiest day is about 7.6 cells tall.
export const barHeight = (count: number, max: number, scale = 1, curve: HeightCurve = "power"): number =>
  count > 0 && max > 0 ? 0.4 + heightShare(count, max, curve) * 7.2 * scale : 0.2;

// Share of the morph each bar spends waiting: the wave sweeps oldest week to newest.
export const WAVE = 0.42;

// 0 to 1 as a bar rises during the morph. Every bar is flat at t=0 and fully up at t=1.
export const riseAt = (t: number, week: number, weeks: number, day: number): number => {
  const d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06;
  return easeOutCubic((t - d) / (1 - WAVE));
};

export const YAW_3D = Math.PI / 4;
export const ELEV_3D = (34 * Math.PI) / 180;
export const YAW_RANGE: [number, number] = [(8 * Math.PI) / 180, (82 * Math.PI) / 180];
export const ELEV_RANGE: [number, number] = [(18 * Math.PI) / 180, (62 * Math.PI) / 180];

export type Cam = { cs: number; sn: number; se: number; ce: number };

// e=0 looks straight down (yaw 0, elevation 90 degrees): x across, y down,
// height invisible, a plain heat map. e=1 is the isometric corner view. Orbit
// offsets only apply in proportion to e, so the flat view never tilts.
export const camera = (e: number, dYaw = 0, dElev = 0): Cam => {
  const yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + dYaw, e)));
  const elev = lerp(Math.PI / 2, Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + dElev)), e);
  return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
};

// World (x = week, y = weekday, z = up) to screen, before scale and offset.
export const project = (c: Cam, x: number, y: number, z: number): [number, number] => [
  x * c.cs - y * c.sn,
  (x * c.sn + y * c.cs) * c.se - z * c.ce,
];

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const luminance = (c: RGB): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

// Four steps of the accent mixed toward the page, lightest share first. The
// strings are CSS, so the DOM legend uses them as they are and the canvas
// resolves them through a probe element (a canvas cannot read var()).
export const accentRamp = (lightestShare: number): string[] => {
  const s = Math.max(0, Math.min(100, lightestShare));
  return [0, 1, 2, 3].map((k) => {
    const share = Math.round(s + ((100 - s) * k) / 3);
    return share >= 100
      ? "var(--color-accent)"
      : `color-mix(in srgb, var(--color-accent) ${share}%, var(--color-background))`;
  });
};

// Weekly totals of the real days, oldest first, one per grid column, for the
// ribbon. A week wholly in the future has total null.
export const weeklyTotals = (cells: Cell[], weeks: number) =>
  Array.from({ length: weeks }, (_, w) => {
    const week = cells.slice(w * 7, w * 7 + 7);
    const days = week.filter((c) => c.kind === "day");
    return {
      start: (days[0] ?? week[0]).date,
      total: days.length ? days.reduce((sum, c) => sum + c.count, 0) : null,
    };
  });
