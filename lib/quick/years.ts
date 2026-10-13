import { quickClosing, quickYears, type QuickEntry } from "@/lib/content/quick";

// The Express lane's rows: one per year, oldest first, each card filed under its
// start year (by month, then title), then the closing row. Each row is one
// checkpoint, keyed for the checkpoint layer and the trip bar. Pure.

export interface YearLine { year: string; line: string }

export interface YearRow extends YearLine {
  key: string;
  entries: QuickEntry[];
}

export interface TripStop { key: string; label: string }

export const CLOSE_KEY = "close";

export const yearKey = (year: string) => `year-${year}`;

export function yearRows(entries: readonly QuickEntry[], years: readonly YearLine[] = quickYears): YearRow[] {
  return years.map(({ year, line }) => ({
    year,
    line,
    key: yearKey(year),
    entries: entries
      .filter((entry) => entry.start.slice(0, 4) === year)
      .sort((a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.title.localeCompare(b.title))),
  }));
}

// The cards no row holds: a start year outside the rows (a content mistake the test catches).
export function unfiled(entries: readonly QuickEntry[], rows: readonly YearRow[]): QuickEntry[] {
  const filed = new Set(rows.flatMap((row) => row.entries.map((entry) => entry.id)));
  return entries.filter((entry) => !filed.has(entry.id));
}

// The trip, start to finish: every year, then what's next.
export function tripStops(rows: readonly YearRow[]): TripStop[] {
  return [...rows.map((row) => ({ key: row.key, label: row.year })), { key: CLOSE_KEY, label: quickClosing.label }];
}
