import { describe, expect, it } from "vitest";
import { dayTotal, dominantTool, usageSnapshotSchema, type UsageSnapshot } from "./usageSchema";

const day: UsageSnapshot["days"][number] = {
  d: "2026-10-01",
  claude: { in: 10, out: 5, cr: 1000, cw: 2, msgs: 1 },
  codex: { in: 3, out: 1, cr: 0, cw: 0, msgs: 1 },
  cursor: { req: 4 },
};

describe("usage snapshot", () => {
  it("rejects a file that smuggles a string into a day", () => {
    const bad = { generated: "t", tz: "UTC", tools: { claude: { unit: "tokens" }, codex: { unit: "tokens" }, cursor: { unit: "requests" } }, days: [{ ...day, note: "secret" }] };
    expect(usageSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it("keeps cache reads out of the work total", () => {
    expect(dayTotal(day, "work")).toBe(19);
    expect(dayTotal(day, "all")).toBe(1021);
    expect(dayTotal(day, "cursor")).toBe(4);
    expect(dominantTool(day)).toBe("claude");
  });
});
