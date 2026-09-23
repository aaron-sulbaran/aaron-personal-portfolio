// Shape of wiki/roles/recruiting-export.json, written by `talos-ledger export`
// in the vault. Contacts and thread ids are stripped before export; people are
// names only. Read-only on this side: the ledger is the source of truth.

export const STAGES = [
  "applied",
  "oa",
  "screen",
  "interview",
  "final",
  "offer",
  "accepted",
] as const;
export type Stage = (typeof STAGES)[number];

export const TERMINALS = ["rejected", "ghosted", "withdrawn", "stale", "ignored"] as const;
export type Terminal = (typeof TERMINALS)[number];

export const LANES = ["full-time", "internship", "co-op", "?"] as const;
export type Lane = (typeof LANES)[number];

export type Season = string;

// off-track (2026-09-23): a row outside the search (a retail job that landed in
// the recruiting label). Kept on the ledger, never in the funnel, tiles or table.
export type Tier = "target" | "opportunistic" | "outreach-ignored" | "off-track";

export interface LedgerEvent {
  date: string;
  kind: string;
  note: string;
}

export interface Application {
  id: string;
  season: Season;
  company: string;
  role: string;
  lane: Lane;
  resume: string | null;
  tier: Tier;
  channel: string | null;
  status: string;
  applied: string | null;
  furthest_stage: Stage | null;
  active: boolean;
  outcome: string | null;
  first_response_days: number | null;
  events: LedgerEvent[];
  next: { what: string; due?: string } | null;
  people: string[];
}

export interface RecruitingExport {
  generated: string;
  seasons: Season[];
  lanes: string[];
  stages: string[];
  terminal: string[];
  applications: Application[];
}

export function isStage(value: string | null | undefined): value is Stage {
  return value != null && (STAGES as readonly string[]).includes(value);
}

export function isTerminal(value: string | null | undefined): value is Terminal {
  return value != null && (TERMINALS as readonly string[]).includes(value);
}

export function isOffTrack(app: Application): boolean {
  return app.tier === "off-track";
}

export function isOutreach(app: Application): boolean {
  return app.tier === "outreach-ignored" || app.outcome === "ignored";
}

// A row that exists on the ledger but never entered the funnel (intend to
// apply, no confirmation yet). It stays in the table and out of the chart.
export function isPlanned(app: Application): boolean {
  return !isOutreach(app) && app.furthest_stage === null && app.outcome === null;
}
