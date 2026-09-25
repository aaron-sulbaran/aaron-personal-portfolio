import { describe, expect, it } from "vitest";
import { applyPendingEdits, completeNextEdit, editBody, editTitle, ledgerEditSchema, parseEditBody, type LedgerEdit } from "./edits";
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
  it("accepts field-only updates, a cleared next step, and a remove", () => {
    expect(ledgerEditSchema.safeParse({ v: 1, op: "update", id: "js", role: "Strategy & Product Intern", date: "2026-09-23" }).success).toBe(true);
    expect(ledgerEditSchema.safeParse({ v: 1, op: "update", id: "js", next: null, date: "2026-09-23" }).success).toBe(true);
    expect(ledgerEditSchema.safeParse({ v: 1, op: "remove", id: "colorstack", date: "2026-09-23" }).success).toBe(true);
    expect(ledgerEditSchema.safeParse({ v: 1, op: "update", id: "js", company: "  ", date: "2026-09-23" }).success).toBe(false);
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
      tier: "target", status: "applied", referral: true, date: "2026-09-23", note: "",
    };
    const out = applyPendingEdits(rows, [{ number: 12, edit: create }]);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ id: "pending-12", furthest_stage: "applied", applied: "2026-09-23", channel: "referral", pending: true });
  });

  it("marks and unmarks a referral through the channel, as the ledger does", () => {
    const marked = applyPendingEdits(rows, [
      { number: 30, edit: { v: 1, op: "update", id: "js", referral: true, date: "2026-09-25", note: "" } },
    ]).find((a) => a.id === "js");
    expect(marked?.channel).toBe("referral");
    expect(marked?.events.at(-1)?.note).toBe("Edited referral");
    const unmarked = applyPendingEdits([{ ...rows[0], channel: "referral" }], [
      { number: 31, edit: { v: 1, op: "update", id: rows[0].id, referral: false, date: "2026-09-25", note: "" } },
    ])[0];
    expect(unmarked.channel).toBe("direct");
  });

  it("accepts a create without the referral flag and defaults it to false", () => {
    const parsed = parseEditBody(editBody({
      v: 1, op: "create", company: "Adobe", role: "PM Intern", lane: "internship", season: "2026-27",
      tier: "target", status: "applied", referral: false, date: "2026-09-25", note: "",
    }).replace('"referral": false,', ""));
    expect(parsed).toMatchObject({ op: "create", referral: false });
  });

  it("renames, moves lanes and clears the next step without touching status", () => {
    const rows2 = [app({ id: "de", company: "D. E. Shaw", role: "(role not in the mail)", next: { what: "follow up", due: "2026-10-01" } })];
    const edit: LedgerEdit = {
      v: 1, op: "update", id: "de", role: "Fundamental Research Analyst Intern", lane: "full-time", next: null,
      date: "2026-09-23", note: "",
    };
    const [row] = applyPendingEdits(rows2, [{ number: 20, edit }]);
    expect(row).toMatchObject({ role: "Fundamental Research Analyst Intern", lane: "full-time", next: null, status: "applied", pending: true });
    expect(row.events.at(-1)?.note).toBe("Edited role, lane, next");
    expect(editTitle(edit, "D. E. Shaw")).toBe("D. E. Shaw: role, lane, next");
  });

  it("takes a removed row off the page at once", () => {
    const out = applyPendingEdits(rows, [{ number: 21, edit: { v: 1, op: "remove", id: "js", date: "2026-09-23", note: "" } }]);
    expect(out.map((a) => a.id)).toEqual(["planned"]);
  });

  it("ignores an edit for a row the export does not have, and leaves inputs untouched", () => {
    const out = applyPendingEdits(rows, [{ number: 3, edit: { ...reject, id: "gone" } }]);
    expect(out).toEqual(rows);
    expect(rows[0].status).toBe("applied");
  });

  it("marks a next step done in one click: clears it and keeps what it was as the note", () => {
    const row = app({ id: "adobe", company: "Adobe", next: { what: "verify candidate account email", due: "2026-09-25" } });
    const edit = completeNextEdit(row, "2026-09-25");
    expect(ledgerEditSchema.safeParse(edit).success).toBe(true);
    expect(editTitle(edit, "Adobe")).toBe("Adobe: next");
    const [out] = applyPendingEdits([row], [{ number: 40, edit }]);
    expect(out.next).toBeNull();
    expect(out.events.at(-1)).toEqual({ date: "2026-09-25", kind: "note", note: "Done: verify candidate account email" });
  });
});
