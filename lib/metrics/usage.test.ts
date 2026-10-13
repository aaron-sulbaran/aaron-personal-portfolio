import { describe, expect, it } from "vitest";
import snapshot from "./data/usage-6mo.json";
import { seriesStats } from "./format";
import { dayValues } from "./series";
import { loadUsage } from "./usage";

describe("loadUsage", () => {
  it("counts Claude and Codex input and output, and leaves cache out", () => {
    const series = loadUsage();
    const inWindow = snapshot.days.filter((d) => d.d >= series.range.from && d.d <= series.range.to);
    const work = inWindow.reduce((sum, d) => sum + d.claude.in + d.claude.out + d.codex.in + d.codex.out, 0);
    const withCache = inWindow.reduce(
      (sum, d) => sum + d.claude.in + d.claude.out + d.claude.cr + d.claude.cw + d.codex.in + d.codex.out + d.codex.cr + d.codex.cw,
      0,
    );
    expect(series.kind).toBe("usage");
    expect(series.stale).toBe(true);
    expect(series.total).toBe(work);
    expect(withCache).toBeGreaterThan(work);
    expect(dayValues(series)).toBe(series.days);
    expect(seriesStats(series).find((s) => s.key === "total")?.label).toBe("tokens in the last 6 months");
  });
});
