import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { snapshotSeries } from "./snapshot";
import { seriesStats, shortDate, slotStats } from "./format";

const m = siteContent.metrics;

describe("the stats", () => {
  it("reads the snapshot as the current streak, the total and the active days: GitHub's figures only", () => {
    expect(seriesStats(snapshotSeries()).map((s) => [s.key, s.value, s.unit, s.label, s.sub])).toEqual([
      ["streak", "60", m.days, m.streakLabel, `${m.since} Aug 8`],
      ["total", "2,501", undefined, m.totalLabel, undefined],
      ["active", "94", undefined, m.activeLabel, undefined],
    ]);
  });
  it("keeps my LinkedIn line apart from them, as its own figure; the empty fun slot renders nothing", () => {
    expect(slotStats()).toEqual([{ key: "linkedin", value: "450,000", label: "LinkedIn impressions in 3 months", sub: "2,500+ followers" }]);
  });
  it("writes dates as Aug 8, the copy sentence case and first person, no dashes", () => {
    expect(shortDate("2026-08-08")).toBe("Aug 8");
    expect([m.streakLabel, m.totalLabel, m.activeLabel]).toEqual(["Current streak of contributions", "contributions in the last 6 months", "days I shipped something"]);
    expect(JSON.stringify(m)).not.toMatch(/[\u2013\u2014]/);
    const built = m.chart.label("1", "a", "b", true) + m.chart.label("1", "a", "b", false) + m.chart.highlight("X");
    expect(built).not.toMatch(/[\u2013\u2014]/);
  });
});
