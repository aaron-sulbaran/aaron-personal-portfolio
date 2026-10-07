import { describe, expect, it } from "vitest";
import raw from "./data/contributions-6mo.json";
import { snapshotSeries } from "./snapshot";

describe("the committed snapshot", () => {
  it("comes out of the window maths with the lab script's own figures, stamped stale", () => {
    const s = snapshotSeries();
    expect(s).toMatchObject({ kind: "github", window: "6mo", stale: true, range: { from: "2026-04-05", to: "2026-10-06" } });
    expect([s.total, s.activeDays]).toEqual([2501, 94]);
    expect(s.total).toBe(raw.total);
    expect(s.streak).toEqual(raw.streaks.current);
    expect(s.streak).toEqual({ days: 60, start: "2026-08-08", end: "2026-10-06" });
  });
});
