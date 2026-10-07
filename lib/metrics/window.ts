import type { DayValue, Streak } from "./series";

export type SeriesWindow = "6mo" | "12mo" | "year";
export const DAY_MS = 86_400_000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const utc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

// Six months back, then to that week's Sunday, so the grid's first column is
// whole (scripts/fetch-contributions.mjs computes the same).
export function windowStart(today: string, window: SeriesWindow): string {
  const [y, m, d] = today.split("-").map(Number);
  if (window === "year") return `${y}-01-01`;
  if (window === "12mo") return isoDay(Date.UTC(y - 1, m - 1, d + 1));
  const sixBack = Date.UTC(y, m - 7, d);
  return isoDay(sixBack - new Date(sixBack).getUTCDay() * DAY_MS);
}

export function fillDays(days: readonly DayValue[], from: string, to: string): DayValue[] {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const out: DayValue[] = [];
  for (let ms = utc(from), end = utc(to); ms <= end; ms += DAY_MS) {
    const date = isoDay(ms);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

// The run that reaches today, or yesterday: today is not over.
export function currentStreak(days: readonly DayValue[]): Streak {
  let end = days.length - 1;
  if (end >= 0 && days[end].count === 0) end -= 1;
  let start = end;
  while (start >= 0 && days[start].count > 0) start -= 1;
  const n = end - start;
  return n > 0 ? { days: n, start: days[start + 1].date, end: days[end].date } : { days: 0, start: null, end: null };
}

export function summarize(raw: readonly DayValue[], from: string, to: string) {
  const days = fillDays(raw, from, to);
  return {
    days,
    total: days.reduce((sum, d) => sum + d.count, 0),
    activeDays: days.filter((d) => d.count > 0).length,
    streak: currentStreak(days),
  };
}
