import { describe, expect, it } from "vitest";
import { determineRecovery, FAST_START_THRESHOLD_FRAC } from "@/lib/home/recovery";

const base = { hash: "", savedY: null, currentY: 0, viewportHeight: 900 };

describe("determineRecovery", () => {
  it("treats a plain top load as a normal arrival", () => {
    expect(determineRecovery(base)).toEqual({ deep: false, target: null });
    expect(determineRecovery({ ...base, hash: "#main" })).toEqual({ deep: false, target: null });
    expect(determineRecovery({ ...base, hash: "#" })).toEqual({ deep: false, target: null });
  });

  it("takes the fast start for any section hash, keeping the saved position as a fallback", () => {
    expect(determineRecovery({ ...base, hash: "#about", savedY: 40 })).toEqual({
      deep: true,
      target: { hash: "#about", y: 40 },
    });
  });

  it("takes the fast start only past half a viewport, preferring the saved position", () => {
    const threshold = base.viewportHeight * FAST_START_THRESHOLD_FRAC;
    expect(determineRecovery({ ...base, savedY: threshold }).deep).toBe(false);
    expect(determineRecovery({ ...base, savedY: threshold + 1 })).toEqual({
      deep: true,
      target: { hash: null, y: threshold + 1 },
    });
    expect(determineRecovery({ ...base, savedY: 0, currentY: 5000 }).deep).toBe(false);
    expect(determineRecovery({ ...base, savedY: null, currentY: 5000 }).deep).toBe(true);
  });
});
