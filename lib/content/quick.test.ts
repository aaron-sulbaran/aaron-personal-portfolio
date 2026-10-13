import { describe, expect, it } from "vitest";
import { cards } from "./cards";
import { quickEntries, quickSorted } from "./quick";

describe("quick entries", () => {
  it("covers every card once, with a month and a first-person line", () => {
    const ids = quickEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(cards).sort());
    for (const entry of quickEntries) {
      expect(entry.start).toMatch(/^\d{4}-\d{2}$/);
      if (entry.end) expect(entry.end >= entry.start).toBe(true);
      expect(entry.line.startsWith("Aaron")).toBe(false);
      expect(entry.outcomes.length).toBeGreaterThan(0);
      expect(entry.outcomes.length).toBeLessThanOrEqual(3);
    }
  });

  it("sorts newest first", () => {
    const sorted = quickSorted();
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i - 1].start >= sorted[i].start).toBe(true);
    }
  });
});
