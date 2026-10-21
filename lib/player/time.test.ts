import { describe, expect, it } from "vitest";
import { formatClock, formatRemaining, progressPercent, SEEK_PAGE_S, SEEK_STEP_S, seekBy } from "./time";

describe("the player's clock", () => {
  it("reads elapsed time as m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9.9)).toBe("0:09");
    expect(formatClock(61)).toBe("1:01");
    expect(formatClock(754)).toBe("12:34");
  });

  it("never shows nonsense for a missing or negative time", () => {
    expect(formatClock(NaN)).toBe("0:00");
    expect(formatClock(-4)).toBe("0:00");
    expect(formatClock(Infinity)).toBe("0:00");
  });

  it("reads what is left as -m:ss", () => {
    expect(formatRemaining(200, 0)).toBe("-3:20");
    expect(formatRemaining(200, 49)).toBe("-2:31");
    expect(formatRemaining(200, 199.2)).toBe("-0:01");
    expect(formatRemaining(200, 200)).toBe("-0:00");
  });

  it("counts down a second at a time as the playhead moves", () => {
    expect(formatRemaining(200, 10.2)).toBe("-3:10");
    expect(formatRemaining(200, 10.8)).toBe("-3:10");
    expect(formatRemaining(200, 11)).toBe("-3:09");
  });

  it("stays at -0:00 before the length is known, and past the end", () => {
    expect(formatRemaining(0, 12)).toBe("-0:00");
    expect(formatRemaining(NaN, 12)).toBe("-0:00");
    expect(formatRemaining(200, 260)).toBe("-0:00");
  });

  it("fills the bar from the playhead, inside 0 to 100", () => {
    expect(progressPercent(200, 50)).toBe(25);
    expect(progressPercent(200, -5)).toBe(0);
    expect(progressPercent(200, 300)).toBe(100);
    expect(progressPercent(0, 50)).toBe(0);
  });

  it("steps the playhead by the keyboard and keeps it on the track", () => {
    expect(seekBy(200, 100, SEEK_STEP_S)).toBe(105);
    expect(seekBy(200, 100, -SEEK_PAGE_S)).toBe(85);
    expect(seekBy(200, 3, -SEEK_STEP_S)).toBe(0);
    expect(seekBy(200, 198, SEEK_PAGE_S)).toBe(200);
    expect(seekBy(0, 10, SEEK_STEP_S)).toBe(0);
  });
});
