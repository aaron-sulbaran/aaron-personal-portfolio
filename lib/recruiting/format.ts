import { siteContent } from "@/lib/content";
import { STAGES, isStage, type Application, type Lane } from "./types";

// Presentation helpers shared by the recruiting components. Pure, no DOM.

const copy = siteContent.recruiting;

export type LaneTone = "lane-1" | "lane-2" | "lane-3" | "node";
export type StatusTone = "progress" | "warm" | "cool" | "muted";

// Color follows the lane, never its position in a filtered list.
export function laneTone(lane: Lane): LaneTone {
  switch (lane) {
    case "full-time":
      return "lane-1";
    case "internship":
      return "lane-2";
    case "co-op":
      return "lane-3";
    default:
      return "node";
  }
}

export function laneLabel(lane: Lane): string {
  return copy.lanes[lane] ?? lane;
}

export function statusTone(status: string): StatusTone {
  if (status === "offer" || status === "accepted") return "warm";
  if (["rejected", "ghosted", "withdrawn", "stale"].includes(status)) return "cool";
  if (isStage(status)) return "progress";
  return "muted";
}

export function statusLabel(status: string): string {
  const table = copy.table.statuses as Record<string, string>;
  return table[status] ?? status;
}

export function stageRank(status: string): number {
  const i = (STAGES as readonly string[]).indexOf(status);
  return i === -1 ? -1 : i;
}

export function lastEventDate(app: Application): string | null {
  let latest: string | null = null;
  for (const event of app.events) {
    if (latest === null || event.date > latest) latest = event.date;
  }
  return latest;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function formatPercent(value: number | null): string {
  return value === null ? copy.tiles.none : `${Math.round(value * 100)}%`;
}

export function formatDays(value: number | null): string {
  if (value === null) return copy.tiles.none;
  return Number.isInteger(value) ? `${value}d` : `${value.toFixed(1)}d`;
}

const CSV_COLUMNS: Array<[string, (app: Application) => string]> = [
  ["company", (a) => a.company],
  ["role", (a) => a.role],
  ["lane", (a) => a.lane],
  ["season", (a) => a.season],
  ["tier", (a) => a.tier],
  ["channel", (a) => a.channel ?? ""],
  ["resume", (a) => a.resume ?? ""],
  ["status", (a) => a.status],
  ["active", (a) => (a.active ? "yes" : "no")],
  ["applied", (a) => a.applied ?? ""],
  ["furthest_stage", (a) => a.furthest_stage ?? ""],
  ["outcome", (a) => a.outcome ?? ""],
  ["first_response_days", (a) => (a.first_response_days === null ? "" : String(a.first_response_days))],
  ["last_event", (a) => lastEventDate(a) ?? ""],
  ["next", (a) => a.next?.what ?? ""],
  ["next_due", (a) => a.next?.due ?? ""],
  ["people", (a) => a.people.join("; ")],
];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(apps: ReadonlyArray<Application>): string {
  const header = CSV_COLUMNS.map(([name]) => name).join(",");
  const rows = apps.map((app) => CSV_COLUMNS.map(([, pick]) => csvCell(pick(app))).join(","));
  return [header, ...rows].join("\r\n") + "\r\n";
}
