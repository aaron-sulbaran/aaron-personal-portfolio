import { describe, expect, it } from "vitest";
import { computeFunnel, computeStats, median, pathFor, stagesReached } from "./funnel";
import type { Application } from "./types";

function app(overrides: Partial<Application> & { id: string }): Application {
  return {
    season: "2026-27",
    company: overrides.id,
    role: "PM",
    lane: "full-time",
    resume: "may-2027",
    tier: "target",
    channel: "direct",
    status: "applied",
    applied: "2026-09-01",
    furthest_stage: "applied",
    active: true,
    outcome: null,
    first_response_days: null,
    events: [],
    next: null,
    people: [],
    ...overrides,
  };
}

const rejectedAfterInterview = app({
  id: "a",
  furthest_stage: "interview",
  outcome: "rejected",
  status: "rejected",
  first_response_days: 5,
  events: [
    { date: "2026-09-01", kind: "applied", note: "" },
    { date: "2026-09-06", kind: "screen", note: "" },
    { date: "2026-09-10", kind: "interview", note: "" },
    { date: "2026-09-12", kind: "rejected", note: "" },
  ],
});
const stillInOa = app({
  id: "b",
  lane: "internship",
  furthest_stage: "oa",
  status: "oa",
  first_response_days: 3,
  events: [
    { date: "2026-09-01", kind: "applied", note: "" },
    { date: "2026-09-04", kind: "oa", note: "" },
  ],
});
const justApplied = app({ id: "c", lane: "co-op" });
const referralNoAppliedEvent = app({
  id: "d",
  lane: "co-op",
  applied: null,
  furthest_stage: "interview",
  status: "interview",
  events: [
    { date: "2026-09-09", kind: "screen", note: "" },
    { date: "2026-09-10", kind: "interview", note: "" },
  ],
});
const outreach = app({
  id: "e",
  tier: "outreach-ignored",
  status: "ignored",
  applied: null,
  furthest_stage: null,
  outcome: "ignored",
  events: [{ date: "2026-09-07", kind: "outreach", note: "" }],
});
const planned = app({ id: "f", status: "planned", applied: null, furthest_stage: null });
const lastSeason = app({
  id: "g",
  season: "2025-26",
  furthest_stage: "final",
  outcome: "ghosted",
  status: "ghosted",
  first_response_days: 11,
  events: [
    { date: "2025-10-01", kind: "applied", note: "" },
    { date: "2025-10-08", kind: "oa", note: "" },
    { date: "2025-10-20", kind: "interview", note: "" },
    { date: "2025-11-02", kind: "final", note: "" },
  ],
});
const offer = app({
  id: "h",
  season: "2025-26",
  lane: "internship",
  furthest_stage: "offer",
  status: "offer",
  first_response_days: 2,
  events: [
    { date: "2025-10-01", kind: "applied", note: "" },
    { date: "2025-10-08", kind: "screen", note: "" },
    { date: "2025-10-20", kind: "interview", note: "" },
    { date: "2025-11-02", kind: "offer", note: "" },
  ],
});

const ALL = [rejectedAfterInterview, stillInOa, justApplied, referralNoAppliedEvent, outreach, planned, lastSeason, offer];
const THIS_SEASON = { seasons: ["2026-27"], lanes: null, includeOutreach: false };

describe("stagesReached / pathFor", () => {
  it("walks the stages actually hit, in order, then the terminal outcome", () => {
    expect(stagesReached(rejectedAfterInterview)).toEqual(["applied", "screen", "interview"]);
    expect(pathFor(rejectedAfterInterview)).toEqual(["applied", "screen", "interview", "rejected"]);
  });

  it("implies Applied when a referral skipped the applied event", () => {
    expect(pathFor(referralNoAppliedEvent)).toEqual(["applied", "screen", "interview"]);
  });

  it("ends at the furthest stage for a row still in play", () => {
    expect(pathFor(stillInOa)).toEqual(["applied", "oa"]);
    expect(pathFor(justApplied)).toEqual(["applied"]);
  });

  it("ignores stage events past furthest_stage (the ledger field wins)", () => {
    const capped = app({
      id: "z",
      furthest_stage: "oa",
      events: [
        { date: "2026-09-01", kind: "applied", note: "" },
        { date: "2026-09-04", kind: "oa", note: "" },
        { date: "2026-09-05", kind: "interview", note: "" },
      ],
    });
    expect(pathFor(capped)).toEqual(["applied", "oa"]);
  });

  it("routes ignored outreach through its own pair and planned rows nowhere", () => {
    expect(pathFor(outreach)).toEqual(["outreach", "ignored"]);
    expect(pathFor(planned)).toEqual([]);
  });
});

describe("computeFunnel", () => {
  it("aggregates lane-colored links with counts and excludes outreach by default", () => {
    const f = computeFunnel(ALL, THIS_SEASON);
    expect(f.counted).toBe(4);
    expect(f.planned).toBe(1);
    expect(f.nodes.map((n) => n.id)).toEqual([
      "applied", "oa", "screen", "interview", "final", "offer", "accepted", "rejected",
    ]);
    expect(f.links).toEqual([
      { source: "applied", target: "oa", lane: "internship", value: 1 },
      { source: "applied", target: "screen", lane: "full-time", value: 1 },
      { source: "applied", target: "screen", lane: "co-op", value: 1 },
      { source: "screen", target: "interview", lane: "full-time", value: 1 },
      { source: "screen", target: "interview", lane: "co-op", value: 1 },
      { source: "interview", target: "rejected", lane: "full-time", value: 1 },
    ]);
  });

  it("adds the outreach pair when the toggle is on", () => {
    const f = computeFunnel(ALL, { ...THIS_SEASON, includeOutreach: true });
    expect(f.counted).toBe(5);
    expect(f.nodes[0]).toEqual({ id: "outreach", kind: "source", order: -1 });
    expect(f.nodes.at(-1)?.id).toBe("ignored");
    expect(f.links[0]).toEqual({ source: "outreach", target: "ignored", lane: "full-time", value: 1 });
  });

  it("filters by lane and season, and merges rows of one lane on one edge", () => {
    const f = computeFunnel(ALL, { seasons: ["2026-27"], lanes: ["co-op"], includeOutreach: false });
    expect(f.counted).toBe(2);
    expect(f.links).toEqual([
      { source: "applied", target: "screen", lane: "co-op", value: 1 },
      { source: "screen", target: "interview", lane: "co-op", value: 1 },
    ]);

    const both = computeFunnel(ALL, { seasons: ["2025-26", "2026-27"], lanes: null, includeOutreach: false });
    expect(both.counted).toBe(6);
    expect(both.nodes.filter((n) => n.kind === "terminal").map((n) => n.id)).toEqual(["rejected", "ghosted"]);
    expect(both.links).toContainEqual({ source: "final", target: "ghosted", lane: "full-time", value: 1 });
    expect(both.links).toContainEqual({ source: "interview", target: "offer", lane: "internship", value: 1 });
  });

  it("handles an empty season without throwing", () => {
    const f = computeFunnel(ALL, { seasons: ["2024-25"], lanes: null, includeOutreach: true });
    expect(f.counted).toBe(0);
    expect(f.links).toEqual([]);
    expect(f.nodes.map((n) => n.kind)).toEqual(Array(7).fill("stage"));
    expect(computeStats(ALL, { seasons: ["2024-25"], lanes: null, includeOutreach: false })).toEqual({
      applications: 0,
      responseRate: null,
      interviewRate: null,
      offers: 0,
      medianResponseDays: null,
    });
  });
});

describe("computeStats", () => {
  it("counts applications, rates, offers and the median first response", () => {
    const s = computeStats(ALL, { seasons: ["2025-26", "2026-27"], lanes: null, includeOutreach: true });
    expect(s.applications).toBe(6);
    expect(s.responseRate).toBeCloseTo(5 / 6);
    expect(s.interviewRate).toBeCloseTo(4 / 6);
    expect(s.offers).toBe(1);
    expect(s.medianResponseDays).toBe(4);
  });

  it("median handles odd and even lengths", () => {
    expect(median([])).toBeNull();
    expect(median([7])).toBe(7);
    expect(median([1, 3])).toBe(2);
    expect(median([1, 2, 10])).toBe(2);
  });
});
