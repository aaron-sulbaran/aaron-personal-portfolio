import { describe, expect, it } from "vitest";
import snapshot from "./data/usage-6mo.json";
import { toolTotal, usageSnapshotSchema, type UsageSnapshot } from "./usageSchema";

const day: UsageSnapshot["days"][number] = {
  d: "2026-10-01",
  claude: { in: 10, out: 5, cr: 1000, cw: 2, msgs: 1 },
  codex: { in: 3, out: 1, cr: 0, cw: 0, msgs: 1 },
  cursor: { req: 4 },
};
const head = { generated: "t", tz: "UTC", tools: { claude: { unit: "tokens" }, codex: { unit: "tokens" }, cursor: { unit: "requests" } }, toolkit: { customSkills: 1, installedSkills: 2, plugins: 3, mcpServers: 4 } };

describe("usage snapshot", () => {
  it("parses a well-formed file, and rejects one without the toolkit's counts", () => {
    expect(usageSnapshotSchema.safeParse({ ...head, days: [day] }).success).toBe(true);
    const { toolkit: _toolkit, ...noToolkit } = head;
    expect(usageSnapshotSchema.safeParse({ ...noToolkit, days: [day] }).success).toBe(false);
  });

  it("rejects a file that smuggles a string into a day", () => {
    const bad = { ...head, days: [{ ...day, note: "secret" }] };
    expect(usageSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a fractional or negative count", () => {
    const frac = { ...day, claude: { ...day.claude, in: 1.5 } };
    const neg = { ...day, codex: { ...day.codex, out: -1 } };
    for (const d of [frac, neg]) {
      expect(usageSnapshotSchema.safeParse({ ...head, days: [d] }).success).toBe(false);
    }
  });

  it("totals a tool as input, output, cache reads and cache writes", () => {
    expect(toolTotal(day.claude)).toBe(1017);
    expect(toolTotal(day.codex)).toBe(4);
  });

  it("parses the committed snapshot: daily integers and nothing else", () => {
    expect(usageSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});
