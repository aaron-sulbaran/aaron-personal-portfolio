import { describe, expect, it } from "vitest";
import {
  columnChain,
  filterApplications,
  computeFunnel,
  computeStats,
  exitFor,
  exitNodeId,
  median,
  pathFor,
  stageBars,
  stagesReached,
} from "./funnel";
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
const stillInOa = app({ id: "b", lane: "co-op", furthest_stage: "oa", status: "oa", first_response_days: 1 });
const ghosted = app({ id: "c", lane: "internship", season: "2025-26", outcome: "ghosted", status: "ghosted" });
const stale = app({ id: "d", lane: "internship", outcome: "stale", status: "stale" });
const planned = app({ id: "e", furthest_stage: null, status: "planned", applied: null });
const outreach = app({ id: "f", tier: "outreach-ignored", furthest_stage: null, outcome: "ignored", status: "ignored" });
const offTrackAccepted = app({
  id: "g",
  role: "Boutique Associate",
  tier: "off-track",
  furthest_stage: "accepted",
  outcome: "accepted",
  status: "accepted",
});
const accepted = app({ id: "h", furthest_stage: "accepted", outcome: "accepted", status: "accepted" });

const all = [rejectedAfterInterview, stillInOa, ghosted, stale, planned, outreach, offTrackAccepted, accepted];
const both = { seasons: ["2025-26", "2026-27"], lanes: null, includeOutreach: false };

describe("stagesReached", () => {
  it("walks every stage the row touched, in order", () => {
    expect(stagesReached(rejectedAfterInterview)).toEqual(["applied", "screen", "interview"]);
  });
  it("is empty for a planned row", () => {
    expect(stagesReached(planned)).toEqual([]);
  });
});

describe("exitFor", () => {
  it("folds stale into no reply and keeps in-play rows open", () => {
    expect(exitFor(ghosted)).toBe("noreply");
    expect(exitFor(stale)).toBe("noreply");
    expect(exitFor(stillInOa)).toBe("open");
    expect(exitFor(rejectedAfterInterview)).toBe("rejected");
    expect(exitFor(accepted)).toBeNull();
    expect(exitFor(app({ id: "x", furthest_stage: "accepted", status: "accepted", outcome: null }))).toBeNull();
  });
});

describe("pathFor", () => {
  it("starts at the lane, walks the stages, exits next to the last stage", () => {
    expect(pathFor(rejectedAfterInterview).map((s) => s.id)).toEqual([
      "lane:full-time",
      "stage:applied",
      "stage:screen",
      "stage:interview",
      exitNodeId("rejected", "interview"),
    ]);
  });
  it("gives each exit its own node per stage (sankeymatic job-search shape)", () => {
    const early = pathFor(ghosted).at(-1)?.id;
    const late = pathFor(rejectedAfterInterview).at(-1)?.id;
    expect(early).toBe("exit:noreply@applied");
    expect(late).toBe("exit:rejected@interview");
  });
  it("ends an accepted offer on the Accepted stage", () => {
    expect(pathFor(accepted).at(-1)?.id).toBe("stage:accepted");
  });
});

describe("computeFunnel", () => {
  const funnel = computeFunnel(all, both);

  it("counts applications, planned and outreach separately", () => {
    expect(funnel.counted).toBe(5);
    expect(funnel.planned).toBe(1);
    expect(funnel.outreach).toBe(0);
  });

  it("never lets an off-track row into the chart", () => {
    const ids = funnel.nodes.map((n) => n.id);
    expect(funnel.nodes.find((n) => n.id === "stage:accepted")?.count).toBe(1);
    expect(ids).toContain("stage:accepted");
  });

  it("colors lane->applied flows by lane and later flows by what happened", () => {
    const tone = (s: string, t: string) => funnel.links.find((l) => l.source === s && l.target === t)?.tone;
    expect(tone("lane:co-op", "stage:applied")).toBe("lane-3");
    expect(tone("stage:applied", "stage:screen")).toBe("forward");
    expect(tone("stage:interview", "exit:rejected@interview")).toBe("rejected");
    expect(tone("stage:applied", "exit:noreply@applied")).toBe("noreply");
    expect(tone("stage:oa", "exit:open@oa")).toBe("open");
    expect(tone("stage:final", "stage:offer") ?? "offer").toBe("offer");
  });

  it("aggregates one ribbon per source and target with a lane split", () => {
    const toApplied = funnel.links.filter((l) => l.target === "stage:applied");
    expect(toApplied.reduce((sum, l) => sum + l.value, 0)).toBe(5);
    const noReply = funnel.links.find((l) => l.target === "exit:noreply@applied");
    expect(noReply?.value).toBe(2);
    expect(noReply?.byLane).toEqual({ internship: 2 });
  });

  it("carries the companies behind every flow and node", () => {
    const noReply = funnel.links.find((l) => l.target === "exit:noreply@applied");
    expect(noReply?.companies.sort()).toEqual(["c", "d"]);
    expect(funnel.nodes.find((n) => n.id === "stage:applied")?.companies).toHaveLength(5);
  });

  it("conserves flow: every node's inflow matches its count", () => {
    for (const node of funnel.nodes) {
      if (node.kind === "lane") continue;
      const inflow = funnel.links.filter((l) => l.target === node.id).reduce((s, l) => s + l.value, 0);
      expect(inflow).toBe(node.count);
    }
  });

  it("shows outreach only when the toggle is on", () => {
    const withOutreach = computeFunnel(all, { ...both, includeOutreach: true });
    expect(withOutreach.outreach).toBe(1);
    expect(withOutreach.nodes.map((n) => n.id)).toContain("exit:ignored@outreach");
  });

  it("filters by any combination of lanes and status groups", () => {
    expect(computeFunnel(all, { ...both, lanes: ["internship", "co-op"] }).counted).toBe(3);
    expect(computeFunnel(all, { ...both, statuses: ["inProcess"] }).counted).toBe(1);
    expect(computeFunnel(all, { ...both, lanes: [], statuses: [] }).counted).toBe(5);
    expect(filterApplications(all, { ...both, statuses: ["planned"] }).map((a) => a.id)).toEqual(["e"]);
  });

  it("filters by lane and season", () => {
    expect(computeFunnel(all, { ...both, lanes: ["co-op"] }).counted).toBe(1);
    expect(computeFunnel(all, { ...both, seasons: ["2025-26"] }).counted).toBe(1);
    expect(computeFunnel(all, { ...both, seasons: ["2027-28"] }).counted).toBe(0);
  });
});

describe("stageBars", () => {
  it("splits each stage by what happened next", () => {
    const bars = stageBars(computeFunnel(all, both));
    const applied = bars.find((b) => b.stage === "applied");
    expect(applied?.count).toBe(5);
    expect(applied?.segments.reduce((s, x) => s + x.value, 0)).toBe(5);
    expect(applied?.segments[0].tone).toBe("forward");
  });
});

describe("computeStats", () => {
  const stats = computeStats(all, both);
  it("excludes planned, outreach and off-track rows", () => {
    expect(stats.applications).toBe(5);
  });
  it("counts only on-track offers", () => {
    expect(stats.offers).toBe(1);
  });
  it("computes interview rate and median first reply", () => {
    expect(stats.interviewRate).toBeCloseTo(2 / 5);
    expect(stats.medianResponseDays).toBe(3);
  });
});

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([1, 2, 9])).toBe(2);
    expect(median([1, 3])).toBe(2);
  });
});

describe("columnChain", () => {
  it("chains present stages in order with invisible zero links", () => {
    const skipper = app({ id: "s", furthest_stage: "offer", status: "offer" });
    const funnel = computeFunnel([skipper, stillInOa], both);
    const chain = columnChain(funnel);
    expect(chain.every((l) => l.value === 0)).toBe(true);
    expect(chain.map((l) => `${l.source}>${l.target}`)).toContain("stage:oa>stage:offer");
  });
});

describe("unapplied", () => {
  it("counts rows that closed before ever applying", () => {
    const withdrewEarly = app({ id: "w", furthest_stage: null, outcome: "withdrawn", status: "withdrawn" });
    expect(computeFunnel([withdrewEarly, stillInOa], both).unapplied).toBe(1);
  });
});
