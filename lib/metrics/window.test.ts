import { describe, expect, it } from "vitest";
import { currentStreak, fillDays, summarize, windowStart } from "./window";

const run = (counts: number[]) => counts.map((count, i) => ({ date: `2026-10-0${i + 1}`, count }));

describe("the window", () => {
  it("starts six months back on the Sunday on or before, as the lab script does", () => {
    expect(windowStart("2026-10-06", "6mo")).toBe("2026-04-05");
    expect(windowStart("2026-08-31", "6mo")).toBe("2026-03-01");
  });
  it("keeps the 12-month and year windows", () => {
    expect(windowStart("2026-10-06", "12mo")).toBe("2025-10-07");
    expect(windowStart("2026-10-06", "year")).toBe("2026-01-01");
  });
});

describe("the current streak", () => {
  it("runs to today", () => expect(currentStreak(run([0, 1, 1, 1]))).toEqual({ days: 3, start: "2026-10-02", end: "2026-10-04" }));
  it("runs to yesterday when today has nothing yet", () =>
    expect(currentStreak(run([1, 1, 1, 0]))).toEqual({ days: 3, start: "2026-10-01", end: "2026-10-03" }));
  it("is zero when yesterday was empty too", () => expect(currentStreak(run([1, 0, 0]))).toEqual({ days: 0, start: null, end: null }));
  it("never bridges a missing day", () => {
    const days = fillDays([{ date: "2026-10-01", count: 2 }, { date: "2026-10-03", count: 1 }], "2026-10-01", "2026-10-03");
    expect(days.map((d) => d.count)).toEqual([2, 0, 1]);
    expect(currentStreak(days).days).toBe(1);
  });
  it("summarizes only the window", () => {
    const s = summarize(run([5, 0, 3, 4]), "2026-10-02", "2026-10-04");
    expect([s.total, s.activeDays, s.streak.days, s.days.length]).toEqual([7, 2, 2, 3]);
  });
});
