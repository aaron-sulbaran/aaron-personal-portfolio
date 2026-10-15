import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { snapshotSeries } from "./snapshot";
import { compactScale, formatCompact, peakDay, seriesStats, shortDate, slotStats, tokenTip } from "./format";
import type { UsageSeries } from "./series";

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
    const built =
      m.chart.label("1", "a", "b", true) + m.chart.label("1", "a", "b", false) + m.chart.highlight("X") + m.tokens.label("1", "a", "b", true) + m.tokens.tip("1", "a", "b") + m.tokens.toolkitSub("1", "2", "3", "4");
    expect(built).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("compact numbers", () => {
  it("writes K, M and B with one decimal under a hundred, dropping a trailing zero", () => {
    expect([0, 7, 950, 1_200, 75_000_000, 3_480_000_000, 7_000_000_000, 45_920_000_000, 120_400_000].map((n) => formatCompact(n))).toEqual([
      "0",
      "7",
      "950",
      "1.2K",
      "75M",
      "3.5B",
      "7B",
      "45.9B",
      "120M",
    ]);
  });
  it("rounds up into the next unit rather than writing 1000K", () => {
    expect(formatCompact(999_600)).toBe("1M");
    expect(formatCompact(999)).toBe("999");
    expect(compactScale(999_999_000).suffix).toBe("B");
  });
  it("writes a number in a given unit", () => {
    expect(formatCompact(120_000_000, compactScale(3_500_000_000))).toBe("0.1B");
  });
});

describe("the token tooltip", () => {
  const day = (date: string, claude: number, codex: number) => ({ date, claude, codex, count: claude + codex });
  it("names the day, the total and each tool's share in the total's unit", () => {
    expect(tokenTip(day("2026-09-28", 3_400_000_000, 120_000_000))).toBe("3.5B tokens on Monday, September 28: Claude 3.4B, Codex 0.1B");
  });
  it("writes a share too small for the total's unit in its own, and leaves out a tool with nothing", () => {
    expect(tokenTip(day("2026-09-28", 7_391_000_000, 74_600_000))).toBe("7.5B tokens on Monday, September 28: Claude 7.4B, Codex 74.6M");
    expect(tokenTip(day("2026-10-04", 821_000_000, 0))).toBe("821M tokens on Sunday, October 4: Claude 821M");
    expect(tokenTip(day("2026-10-05", 0, 0))).toBe("No tokens on Monday, October 5");
  });
});

describe("the token figures", () => {
  const series: UsageSeries = {
    kind: "usage",
    window: "6mo",
    range: { from: "2026-10-01", to: "2026-10-04" },
    days: [
      { date: "2026-10-01", claude: 0, codex: 0, count: 0 },
      { date: "2026-10-02", claude: 2_000_000_000, codex: 100_000_000, count: 2_100_000_000 },
      { date: "2026-10-03", claude: 900_000, codex: 0, count: 900_000 },
      { date: "2026-10-04", claude: 2_100_000_000, codex: 0, count: 2_100_000_000 },
    ],
    total: 4_200_900_000,
    activeDays: 3,
    streak: { days: 3, start: "2026-10-02", end: "2026-10-04" },
    stale: true,
    toolkit: { customSkills: 18, installedSkills: 16, plugins: 7, mcpServers: 9, named: [] },
  };
  const rows = (fourth?: "skills" | "toolkit" | "streak") => seriesStats(series, fourth).map((s) => [s.key, s.value, s.unit, s.label, s.sub]);
  const lead = [
    ["total", "4.2B", undefined, m.tokens.totalLabel, undefined],
    ["active", "3", undefined, m.tokens.activeLabel, undefined],
    ["peak", "2.1B", undefined, m.tokens.peakLabel, "Oct 2"],
  ];
  it("leads with the total, then the active days and the biggest day, then the custom skills by default", () => {
    expect(rows()).toEqual([...lead, ["skills", "18", undefined, m.tokens.skillsLabel, undefined]]);
    expect(rows("skills")).toEqual(rows());
  });
  it("shows the whole agent setup with its split under it, from the snapshot's counts", () => {
    expect(rows("toolkit")).toEqual([...lead, ["toolkit", "50", undefined, m.tokens.toolkitLabel, "18 custom skills, 16 installed skills, 7 plugins, 9 MCP servers"]]);
  });
  it("keeps the old current streak for the lab", () => {
    expect(rows("streak")).toEqual([...lead, ["streak", "3", m.days, m.tokens.streakLabel, `${m.since} Oct 2`]]);
  });
  it("words the fourth figure in tokens and agents, never a tool's name", () => {
    expect([m.tokens.skillsLabel, m.tokens.toolkitLabel]).toEqual(["custom skills I've written for my agents", "tools in my agent setup"]);
  });
  it("finds the busiest day, the earliest of a tie, and none when every day is empty", () => {
    expect(peakDay(series.days)?.date).toBe("2026-10-02");
    expect(peakDay([{ date: "2026-10-01", count: 0 }])).toBeNull();
  });
});
