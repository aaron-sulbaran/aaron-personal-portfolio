import { quickCopy, quickYears, type QuickEntry } from "@/lib/content/quick";

// The lane's rows: one per year, newest first, each card filed under its start
// year (by month, then title). Each row is one checkpoint, keyed for the
// checkpoint layer and the trip bar; "Next" stands above them as the first
// checkpoint, and the closing row below them the last. Pure.

export interface YearLine { year: string; line: string }

export interface YearRow extends YearLine {
  key: string;
  entries: QuickEntry[];
}

export interface TripStop { key: string; label: string }

export const NEXT_KEY = "next";

// The closing row (booking and links): the last checkpoint, where the line ends.
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

// The trip, top of the page to its foot: what's next (when it is shown), then every year (the closing row has no stop).
export function tripStops(rows: readonly YearRow[], withNext = true): TripStop[] {
  const years = rows.map((row) => ({ key: row.key, label: row.year }));
  return withNext ? [{ key: NEXT_KEY, label: quickCopy.next.label }, ...years] : years;
}
