import { describe, expect, it } from "vitest";
import { applyPendingEdits, editBody, ledgerEditSchema, parseEditBody, type LedgerEdit } from "./edits";
import type { Application } from "./types";

function app(overrides: Partial<Application> & { id: string }): Application {
  return {
    season: "2026-27",
    company: "Jane Street",
    role: "PM",
    lane: "internship",
    resume: "dec-2027",
    tier: "target",
    channel: "direct",
    status: "applied",
    applied: "2026-09-01",
    furthest_stage: "applied",
    active: false,
    outcome: null,
    first_response_days: null,
    events: [{ date: "2026-09-01", kind: "applied", note: "" }],
    next: null,
    people: [],
    ...overrides,
  };
}

const reject: LedgerEdit = { v: 1, op: "update", id: "js", status: "rejected", date: "2026-09-23", note: "Mail this morning" };

describe("ledgerEditSchema", () => {
  it("accepts an update and a create", () => {
    expect(ledgerEditSchema.safeParse(reject).success).toBe(true);
    const create = { v: 1, op: "create", company: "Mastercard", role: "APS", lane: "full-time", season: "2026-27", status: "applied", date: "2026-09-23" };
    const parsed = ledgerEditSchema.safeParse(create);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.op === "create" && parsed.data.tier).toBe("target");
  });
  it("refuses an empty edit, a bad status, a bad date, and a fence in the note", () => {
    expect(ledgerEditSchema.safeParse({ v: 1, op: "update", id: "js", date: "2026-09-23", note: "" }).success).toBe(false);
    expect(ledgerEditSchema.safeParse({ ...reject, status: "ignored" }).success).toBe(false);
    expect(ledgerEditSchema.safeParse({ ...reject, date: "9/23/2026" }).success).toBe(false);
    expect(ledgerEditSchema.safeParse({ ...reject, note: "a ``` b" }).success).toBe(false);
  });
  it("allows a note with no status change", () => {
    expect(ledgerEditSchema.safeParse({ v: 1, op: "update", id: "js", date: "2026-09-23", note: "Recruiter called" }).success).toBe(true);
  });
});

describe("issue body round trip", () => {
  it("parses what it writes, even with braces in the note", () => {
    const edit = { ...reject, note: "they said {no} } twice" };
    expect(parseEditBody(editBody(edit))).toEqual(edit);
  });
  it("returns null for a body with no valid edit", () => {
    expect(parseEditBody("just words")).toBeNull();
    expect(parseEditBody("```json\n{\"v\":2}\n```")).toBeNull();
  });
});

describe("applyPendingEdits", () => {
  const rows = [app({ id: "js" }), app({ id: "planned", status: "planned", applied: null, furthest_stage: null, events: [] })];

  it("shows a rejection at once, marked pending", () => {
    const [js] = applyPendingEdits(rows, [{ number: 7, edit: reject }]);
    expect(js).toMatchObject({ status: "rejected", outcome: "rejected", active: false, pending: true });
    expect(js.events.at(-1)).toEqual({ date: "2026-09-23", kind: "rejected", note: "Mail this morning" });
  });

  it("advances the furthest stage and the applied date like the ledger does", () => {
    const out = applyPendingEdits(rows, [
      { number: 1, edit: { v: 1, op: "update", id: "planned", status: "interview", date: "2026-09-20", note: "" } },
    ]);
    const row = out.find((a) => a.id === "planned");
    expect(row).toMatchObject({ furthest_stage: "interview", applied: "2026-09-20", active: true });
  });

  it("adds a created application as a pending row", () => {
    const create: LedgerEdit = {
      v: 1, op: "create", company: "Mastercard", role: "APS", lane: "full-time", season: "2026-27",
      tier: "target", status: "applied", date: "2026-09-23", note: "",
    };
    const out = applyPendingEdits(rows, [{ number: 12, edit: create }]);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ id: "pending-12", furthest_stage: "applied", applied: "2026-09-23", pending: true });
  });

  it("ignores an edit for a row the export does not have, and leaves inputs untouched", () => {
    const out = applyPendingEdits(rows, [{ number: 3, edit: { ...reject, id: "gone" } }]);
    expect(out).toEqual(rows);
    expect(rows[0].status).toBe("applied");
  });
});
