import { z } from "zod";
import { isStage, isTerminal, LANES, STAGES, type Application, type Stage, type Tier } from "./types";

// Manual edits from the dashboard. The site never writes the ledger: each edit
// becomes a GitHub issue (label ledger-edit) on the private vault repo, and
// `talos-ledger apply-edits` on Aaron's machine turns it into one upsert at the
// next hourly watcher run, before any model call. Until then the page overlays
// open edits on the export so the change shows immediately, marked pending.
// The JSON block in the issue body is the contract with the vault; its Python
// validator (parse_edit in talos-ledger) mirrors this schema.
//
// Three ops. create adds an application. update changes any field the table
// shows (company, role, lane, season, priority, applied date, next step,
// status) and can carry a note. remove takes a row off the dashboard: the
// ledger keeps it as off-track so a later email about it cannot recreate it.

export const EDIT_LABEL = "ledger-edit";
export const EDIT_FAILED_LABEL = "ledger-edit-failed";

// Statuses Aaron can set by hand. "ignored" is outreach triage, not his call here.
export const EDIT_STATUSES = [
  "planned",
  ...STAGES,
  "rejected",
  "withdrawn",
  "ghosted",
  "stale",
] as const;
export type EditStatus = (typeof EDIT_STATUSES)[number];

export const EDIT_TIERS = ["target", "opportunistic", "outreach-ignored"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const season = z.string().regex(/^\d{4}-\d{2}$/);
// Text lands inside a fenced JSON block in the issue body; a fence in it would
// end the block early.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !s.includes("```"), "No triple backticks");
const name = (max: number) => text(max).pipe(z.string().min(1, "Cannot be empty"));

const nextStep = z.object({ what: name(200), due: isoDate.optional() });

const createEdit = z.object({
  v: z.literal(1),
  op: z.literal("create"),
  company: name(120),
  role: name(200),
  lane: z.enum(LANES),
  season,
  tier: z.enum(["target", "opportunistic"]).default("target"),
  status: z.enum(EDIT_STATUSES),
  date: isoDate,
  note: text(500).default(""),
});

// Every field optional: only what changed is sent. next: null clears it.
const updateEdit = z.object({
  v: z.literal(1),
  op: z.literal("update"),
  id: z.string().min(1).max(120),
  company: name(120).optional(),
  role: name(200).optional(),
  lane: z.enum(LANES).optional(),
  season: season.optional(),
  tier: z.enum(EDIT_TIERS).optional(),
  applied: isoDate.optional(),
  next: nextStep.nullable().optional(),
  status: z.enum(EDIT_STATUSES).optional(),
  date: isoDate,
  note: text(500).default(""),
});

const removeEdit = z.object({
  v: z.literal(1),
  op: z.literal("remove"),
  id: z.string().min(1).max(120),
  date: isoDate,
  note: text(500).default(""),
});

const FIELDS = ["company", "role", "lane", "season", "tier", "applied", "next", "status"] as const;

export const ledgerEditSchema = z
  .discriminatedUnion("op", [createEdit, updateEdit, removeEdit])
  .refine(
    (e) => e.op !== "update" || e.note.length > 0 || FIELDS.some((f) => e[f] !== undefined),
    "Nothing changed",
  );

export type LedgerEdit = z.infer<typeof ledgerEditSchema>;
type UpdateEdit = Extract<LedgerEdit, { op: "update" }>;
type CreateEdit = Extract<LedgerEdit, { op: "create" }>;

export interface PendingEdit {
  number: number;
  edit: LedgerEdit;
}

export interface FailedEdit {
  number: number;
  title: string;
  url: string;
}

// The fields an update changes, for the issue title and the ledger's note.
export function changedFields(edit: UpdateEdit): string[] {
  return FIELDS.filter((f) => edit[f] !== undefined);
}

export function editTitle(edit: LedgerEdit, company: string): string {
  if (edit.op === "remove") return `${company}: remove`;
  if (edit.op === "create") return `${company}: add (${edit.status})`;
  const changed = changedFields(edit);
  return `${company}: ${changed.length ? changed.join(", ") : "note"}`;
}

export function editBody(edit: LedgerEdit): string {
  return [
    "Filed from aaronsulbaran.com/recruiting. The hourly watcher applies it with `talos-ledger apply-edits` and closes this issue.",
    "",
    "```json",
    JSON.stringify(edit, null, 2),
    "```",
    "",
  ].join("\n");
}

// The edit inside an issue body, or null when the body is not a valid edit.
export function parseEditBody(body: string | null | undefined): LedgerEdit | null {
  const match = /```json\s*(\{[\s\S]*?\})\s*```/.exec(body ?? "");
  if (!match) return null;
  try {
    const parsed = ledgerEditSchema.safeParse(JSON.parse(match[1]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const IN_FLIGHT: ReadonlySet<string> = new Set(["oa", "screen", "interview", "final", "offer"]);

function furthest(current: Stage | null, status: string | undefined): Stage | null {
  if (!isStage(status)) return current;
  if (current === null) return status;
  return STAGES.indexOf(status) > STAGES.indexOf(current) ? status : current;
}

// Mirrors talos-ledger's upsert for the fields the page reads, so a pending
// edit looks the way the applied one will.
function setsApplied(status: string | undefined): boolean {
  return status !== undefined && !["planned", "withdrawn", "ignored"].includes(status);
}

function applyUpdate(app: Application, edit: UpdateEdit): Application {
  const status = edit.status ?? app.status;
  const changed = changedFields(edit).filter((f) => f !== "status");
  const note = edit.note || (edit.status ? "" : `Edited ${changed.join(", ")}`);
  return {
    ...app,
    company: edit.company ?? app.company,
    role: edit.role ?? app.role,
    lane: edit.lane ?? app.lane,
    season: edit.season ?? app.season,
    tier: (edit.tier as Tier | undefined) ?? app.tier,
    next: edit.next === undefined ? app.next : edit.next,
    status,
    applied: edit.applied ?? app.applied ?? (setsApplied(edit.status) ? edit.date : null),
    furthest_stage: furthest(app.furthest_stage, edit.status),
    outcome: isTerminal(status) ? status : null,
    active: edit.status === undefined ? app.active : IN_FLIGHT.has(status),
    events: [...app.events, { date: edit.date, kind: edit.status ?? "note", note }],
    pending: true,
  };
}

function fromCreate(number: number, edit: CreateEdit): Application {
  return {
    id: `pending-${number}`,
    season: edit.season,
    company: edit.company,
    role: edit.role,
    lane: edit.lane,
    resume: null,
    tier: edit.tier,
    channel: null,
    status: edit.status,
    applied: setsApplied(edit.status) ? edit.date : null,
    furthest_stage: furthest(null, edit.status),
    active: IN_FLIGHT.has(edit.status),
    outcome: isTerminal(edit.status) ? edit.status : null,
    first_response_days: null,
    events: [{ date: edit.date, kind: edit.status, note: edit.note }],
    next: null,
    people: [],
    pending: true,
  };
}

// Oldest edit first, the order the applier uses. An edit for a row the export
// does not have is dropped here; the applier will refuse it too. A removed row
// leaves the page at once.
export function applyPendingEdits(apps: ReadonlyArray<Application>, pending: ReadonlyArray<PendingEdit>): Application[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const created: Application[] = [];
  for (const { number, edit } of [...pending].sort((a, b) => a.number - b.number)) {
    if (edit.op === "create") {
      created.push(fromCreate(number, edit));
      continue;
    }
    const app = byId.get(edit.id);
    if (!app) continue;
    if (edit.op === "remove") byId.delete(edit.id);
    else byId.set(edit.id, applyUpdate(app, edit));
  }
  return [...Array.from(byId.values()), ...created];
}
