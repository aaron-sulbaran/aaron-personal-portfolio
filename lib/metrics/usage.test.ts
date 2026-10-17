import { describe, expect, it } from "vitest";
import snapshot from "./data/usage-6mo.json";
import { seriesStats } from "./format";
import { dayValues } from "./series";
import { loadUsage } from "./usage";
import { toolTotal, usageSnapshotSchema } from "./usageSchema";

describe("loadUsage", () => {
  const series = loadUsage();
  const parsed = usageSnapshotSchema.parse(snapshot);
  const inWindow = parsed.days.filter((d) => d.d >= series.range.from && d.d <= series.range.to);

  it("counts every token from both tools, cache reads and writes included", () => {
    const all = inWindow.reduce((sum, d) => sum + toolTotal(d.claude) + toolTotal(d.codex), 0);
    expect(series.kind).toBe("usage");
    expect(series.stale).toBe(true);
    expect(series.total).toBe(all);
    expect(series.total).toBe(series.days.reduce((sum, d) => sum + d.claude + d.codex, 0));
  });

  it("carries each tool per day beside their sum, and the sum is what the skyline reads", () => {
    for (const d of series.days) expect(d.count).toBe(d.claude + d.codex);
    expect(dayValues(series)).toBe(series.days);
    const busiest = inWindow.reduce((best, d) => (toolTotal(d.claude) + toolTotal(d.codex) > toolTotal(best.claude) + toolTotal(best.codex) ? d : best));
    const day = series.days.find((d) => d.date === busiest.d)!;
    expect([day.claude, day.codex]).toEqual([toolTotal(busiest.claude), toolTotal(busiest.codex)]);
  });

  it("fills every day of the window, each day once, in order", () => {
    expect(series.days[0].date).toBe(series.range.from);
    expect(series.days.at(-1)?.date).toBe(series.range.to);
    const dates = series.days.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("reads the token figures as total, active days and biggest day, and carries the toolkit's counts", () => {
    expect(seriesStats(series).map((s) => s.key)).toEqual(["total", "active", "peak"]);
    expect(series.toolkit).toEqual(parsed.toolkit);
    expect(seriesStats(series)[0].value).toMatch(/^\d+(\.\d)?[KMB]$/);
  });
});
