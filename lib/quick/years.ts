import { quickYears, type QuickEntry } from "@/lib/content/quick";

// The lane's rows: one per year, newest first, each card filed under its start
// year (by month, then title). Each row is one checkpoint, keyed for the
// checkpoint layer and the trip bar. The rail is years only; What's next and the
// closing row sit below it, off the rail. Pure.

export interface YearLine { year: string; line: string }

export interface YearRow extends YearLine {
  key: string;
  entries: QuickEntry[];
}

export interface TripStop { key: string; label: string }

// The closing row (booking and links), the last thing on the page.
export const CLOSE_KEY = "close";

export const yearKey = (year: string) => `year-${year}`;

export function yearRows(entries: readonly QuickEntry[], years: readonly YearLine[] = quickYears): YearRow[] {
  return years
    .map(({ year, line }) => ({
      year,
      line,
      key: yearKey(year),
      entries: entries
        .filter((entry) => entry.start.slice(0, 4) === year)
        .sort((a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.title.localeCompare(b.title))),
    }))
    .reverse();
}

// The tiles no row holds: a start year outside the rows (a content mistake the test catches).
export function unfiled(entries: readonly QuickEntry[], rows: readonly YearRow[]): QuickEntry[] {
  const filed = new Set(rows.flatMap((row) => row.entries.map((entry) => entry.slot)));
  return entries.filter((entry) => !filed.has(entry.slot));
}

// The trip, top of the rail to its foot: every year, newest first.
export function tripStops(rows: readonly YearRow[]): TripStop[] {
  return rows.map((row) => ({ key: row.key, label: row.year }));
}
