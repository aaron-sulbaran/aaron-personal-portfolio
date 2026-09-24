import { describe, expect, it } from "vitest";
import { sortApplications } from "./sort";
import type { Application } from "./types";

function app(overrides: Partial<Application> & { id: string }): Application {
  return {
    season: "2026-27",
    company: overrides.id,
    role: "PM",
    lane: "internship",
    resume: "dec-2027",
    tier: "target",
    channel: "direct",
    status: "applied",
    applied: "2026-09-10",
    furthest_stage: "applied",
    active: false,
    outcome: null,
    first_response_days: null,
    events: [{ date: overrides.applied ?? "2026-09-10", kind: "applied", note: "" }],
    next: null,
    people: [],
    ...overrides,
  };
}

const capitalOne = app({ id: "capital-one", status: "oa", furthest_stage: "oa", applied: "2026-09-01" });
const google = app({ id: "google", applied: "2026-09-22", events: [{ date: "2026-09-23", kind: "note", note: "" }] });
const stripe = app({ id: "stripe", applied: "2026-09-16" });
const roblox = app({ id: "roblox", status: "planned", applied: null, furthest_stage: null, events: [] });
const jane = app({
  id: "jane",
  status: "rejected",
  outcome: "rejected",
  applied: "2026-09-24",
  events: [{ date: "2026-09-24", kind: "rejected", note: "" }],
});
const offer = app({ id: "offer-co", status: "offer", furthest_stage: "offer", applied: "2025-09-01" });
const rows = [jane, roblox, stripe, google, capitalOne, offer];

describe("sortApplications by status", () => {
  it("puts offers and live processes first and rejections last, however recent", () => {
    expect(sortApplications(rows, [{ key: "status", dir: "asc" }]).map((a) => a.id)).toEqual([
      "offer-co",
      "capital-one",
      "google",
      "stripe",
      "roblox",
      "jane",
    ]);
  });

  it("puts a row with a due next step first inside its group", () => {
    const due = app({ id: "zeta", next: { what: "send thank-you", due: "2026-09-25" } });
    expect(sortApplications([google, due], [{ key: "status", dir: "asc" }]).map((a) => a.id)).toEqual(["zeta", "google"]);
  });
});

describe("sortApplications by date", () => {
  it("orders applied dates from the earliest, rows never applied last either way", () => {
    expect(sortApplications(rows, [{ key: "applied", dir: "asc" }]).map((a) => a.id)).toEqual([
      "offer-co",
      "capital-one",
      "stripe",
      "google",
      "jane",
      "roblox",
    ]);
    expect(sortApplications(rows, [{ key: "applied", dir: "desc" }]).at(-1)?.id).toBe("roblox");
  });

  it("orders last event newest first", () => {
    expect(sortApplications([stripe, jane, google], [{ key: "lastEvent", dir: "desc" }]).map((a) => a.id)).toEqual(["jane", "google", "stripe"]);
  });
});

describe("sortApplications with a second rule", () => {
  it("sorts by status, then by the earliest applied inside each group", () => {
    const order = sortApplications(rows, [
      { key: "status", dir: "asc" },
      { key: "applied", dir: "asc" },
    ]).map((a) => a.id);
    expect(order).toEqual(["offer-co", "capital-one", "stripe", "google", "roblox", "jane"]);
  });
});
