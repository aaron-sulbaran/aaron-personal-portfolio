import { z } from "zod";
import { isStage, isTerminal, LANES, STAGES, type Application, type Stage } from "./types";

// Manual edits from the dashboard. The site never writes the ledger: each edit
// becomes a GitHub issue (label ledger-edit) on the private vault repo, and
// `talos-ledger apply-edits` on Aaron's machine turns it into one upsert at the
// next hourly watcher run, before any model call. Until then the page overlays
// open edits on the export so the change shows immediately, marked pending.
// The JSON block in the issue body is the contract with the vault; its Python
// validator (parse_edit in talos-ledger) mirrors this schema.

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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
// A note lands inside a fenced block in the issue body; a fence in the text
// would end the block early.
const note = z
  .string()
  .trim()
  .max(500)
  .refine((s) => !s.includes("```"), "No triple backticks");

const updateEdit = z.object({
  v: z.literal(1),
  op: z.literal("update"),
  id: z.string().min(1).max(120),
  status: z.enum(EDIT_STATUSES).optional(),
  date: isoDate,
  note: note.default(""),
});

const createEdit = z.object({
  v: z.literal(1),
  op: z.literal("create"),
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(200),
  lane: z.enum(LANES),
  season: z.string().regex(/^\d{4}-\d{2}$/),
  tier: z.enum(["target", "opportunistic"]).default("target"),
  status: z.enum(EDIT_STATUSES),
  date: isoDate,
  note: note.default(""),
});

export const ledgerEditSchema = z
  .discriminatedUnion("op", [updateEdit, createEdit])
  .refine((e) => e.status !== undefined || e.note.length > 0, "Set a status or write a note");

export type LedgerEdit = z.infer<typeof ledgerEditSchema>;

export interface PendingEdit {
  number: number;
  edit: LedgerEdit;
}

export interface FailedEdit {
  number: number;
  title: string;
  url: string;
}

export function editTitle(edit: LedgerEdit, company: string): string {
  return `${company}: ${edit.status ?? "note"}`;
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

function applyUpdate(app: Application, edit: Extract<LedgerEdit, { op: "update" }>): Application {
  const status = edit.status ?? app.status;
  return {
    ...app,
    status,
    applied: app.applied ?? (setsApplied(edit.status) ? edit.date : null),
    furthest_stage: furthest(app.furthest_stage, edit.status),
    outcome: isTerminal(status) ? status : null,
    active: edit.status === undefined ? app.active : IN_FLIGHT.has(status),
    events: [...app.events, { date: edit.date, kind: edit.status ?? "note", note: edit.note }],
    pending: true,
  };
}

function fromCreate(number: number, edit: Extract<LedgerEdit, { op: "create" }>): Application {
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

// Oldest edit first, the order the applier uses. An update for a row the
// export does not have is dropped here; the applier will refuse it too.
export function applyPendingEdits(apps: ReadonlyArray<Application>, pending: ReadonlyArray<PendingEdit>): Application[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const created: Application[] = [];
  for (const { number, edit } of [...pending].sort((a, b) => a.number - b.number)) {
    if (edit.op === "create") {
      created.push(fromCreate(number, edit));
      continue;
    }
    const app = byId.get(edit.id);
    if (app) byId.set(edit.id, applyUpdate(app, edit));
  }
  return [...Array.from(byId.values()), ...created];
}
