import { STAGES, type Application } from "./types";

// Table order: one or two rules ("sort by status, then by applied date"). The
// default is by status, the way the old Sheet worked: offers first, then
// processes in flight (furthest stage first), then plain applications, then
// planned ones, and everything that closed at the bottom, however recent.
// After the rules, ties fall to: a pending next step (soonest due), the latest
// activity, then company name.

export type SortKey = "status" | "applied" | "lastEvent" | "company" | "role" | "lane" | "season" | "next";
export type SortDir = "asc" | "desc";
export interface SortRule {
  key: SortKey;
  dir: SortDir;
}
export const DEFAULT_SORT: SortRule[] = [{ key: "status", dir: "asc" }];

// Lower is higher on the page.
const STATUS_GROUP: Record<string, number> = {
  offer: 0,
  accepted: 0,
  final: 1,
  interview: 1,
  screen: 1,
  oa: 1,
  applied: 2,
  planned: 3,
  stale: 4,
  ghosted: 4,
  withdrawn: 5,
  rejected: 6,
  ignored: 7,
};

// The direction a key starts in when first chosen: status in priority order,
// applied from the earliest, last event from the newest.
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  status: "asc",
  applied: "asc",
  lastEvent: "desc",
  company: "asc",
  role: "asc",
  lane: "asc",
  season: "desc",
  next: "asc",
};

export function lastEventDate(app: Application): string | null {
  let latest: string | null = null;
  for (const event of app.events) {
    if (latest === null || event.date > latest) latest = event.date;
  }
  return latest;
}

function stage(app: Application): number {
  return app.furthest_stage ? STAGES.indexOf(app.furthest_stage) : -1;
}

function byString(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "");
}

function byStatus(a: Application, b: Application): number {
  return (STATUS_GROUP[a.status] ?? 8) - (STATUS_GROUP[b.status] ?? 8) || stage(b) - stage(a);
}

// Fixed tiebreak after the chosen rules.
function tiebreak(a: Application, b: Application): number {
  return (
    byString(a.next?.due ?? (a.next ? "9998" : "9999"), b.next?.due ?? (b.next ? "9998" : "9999")) ||
    byString(lastEventDate(b), lastEventDate(a)) ||
    a.company.localeCompare(b.company)
  );
}

function compare(a: Application, b: Application, key: SortKey): number {
  switch (key) {
    case "status":
      return byStatus(a, b);
    case "applied":
      return byString(a.applied, b.applied);
    case "lastEvent":
      return byString(lastEventDate(a), lastEventDate(b));
    case "company":
      return a.company.toLowerCase().localeCompare(b.company.toLowerCase());
    case "role":
      return a.role.toLowerCase().localeCompare(b.role.toLowerCase());
    case "lane":
      return a.lane.localeCompare(b.lane);
    case "season":
      return a.season.localeCompare(b.season);
    case "next":
      return byString(a.next?.due ?? "9999", b.next?.due ?? "9999");
  }
}

// Rows missing the sorted value (no applied date yet) always sink to the end,
// whichever way the column points.
function missing(app: Application, key: SortKey): boolean {
  if (key === "applied") return !app.applied;
  if (key === "lastEvent") return lastEventDate(app) === null;
  return false;
}

export function sortApplications(rows: ReadonlyArray<Application>, rules: ReadonlyArray<SortRule>): Application[] {
  return [...rows].sort((a, b) => {
    for (const { key, dir } of rules) {
      const ma = missing(a, key);
      const mb = missing(b, key);
      if (ma !== mb) return ma ? 1 : -1;
      const c = (dir === "asc" ? 1 : -1) * compare(a, b, key);
      if (c) return c;
    }
    return tiebreak(a, b);
  });
}
