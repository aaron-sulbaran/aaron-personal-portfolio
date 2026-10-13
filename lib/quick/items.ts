import type { QuickEntry, QuickGroup, QuickSign } from "@/lib/content/quick";

// The quick page's list: entries and dated signs in one order, filtered. Pure.

export type QuickOrder = "newest" | "oldest";
export type QuickFilter = "all" | QuickGroup;

export type QuickItem =
  | { kind: "entry"; key: string; at: string; year: string; entry: QuickEntry }
  | { kind: "sign"; key: string; at: string; year: string; sign: QuickSign };

export const QUICK_ORDERS: readonly QuickOrder[] = ["newest", "oldest"];
export const QUICK_FILTERS: readonly QuickFilter[] = ["all", "work", "people"];

// Oldest first, a sign before an entry of the same month (I start ECE, then join IEEE);
// newest first is that list reversed, so the two orders are mirror images.
function chronological(a: QuickItem, b: QuickItem): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === "sign" ? -1 : 1;
  return a.key.localeCompare(b.key);
}

export function quickItems(
  entries: readonly QuickEntry[],
  signs: readonly QuickSign[],
  { order, filter }: { order: QuickOrder; filter: QuickFilter },
): QuickItem[] {
  const shown = (group: QuickGroup) => filter === "all" || group === filter;
  const items: QuickItem[] = [
    ...entries.filter((entry) => shown(entry.group)).map((entry) => ({ kind: "entry" as const, key: entry.id, at: entry.start, year: entry.start.slice(0, 4), entry })),
    ...signs.filter((sign) => shown(sign.group)).map((sign) => ({ kind: "sign" as const, key: sign.key, at: sign.at, year: sign.at.slice(0, 4), sign })),
  ].sort(chronological);
  return order === "oldest" ? items : items.reverse();
}

// The first item of each run of one year, in the order shown: where a year sign stands.
export function yearMarks(items: readonly QuickItem[]): { year: string; key: string }[] {
  const marks: { year: string; key: string }[] = [];
  for (const item of items) {
    if (marks[marks.length - 1]?.year !== item.year) marks.push({ year: item.year, key: item.key });
  }
  return marks;
}
