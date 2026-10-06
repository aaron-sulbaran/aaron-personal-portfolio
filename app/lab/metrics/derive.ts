import type { ContributionData } from "./data";
import { dayMs, type Streak } from "./skyline/maths";

// Figures and phrases derived from the loaded data, pure, for the numbers row and copy.

export const accountMonths = (d: ContributionData) => {
  const a = new Date(d.since);
  const b = new Date(d.fetched + "T00:00:00Z");
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
};

export const sinceLabel = (d: ContributionData) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(d.since));

export const yearOf = (d: ContributionData) => d.range.from.slice(0, 4);

export const activeDays = (d: ContributionData) => d.days.filter((x) => x.count > 0).length;

export const rangeTotal = (d: ContributionData) => d.days.reduce((sum, x) => sum + x.count, 0);

const numberFormat = new Intl.NumberFormat("en-US");
export const formatCount = (n: number) => numberFormat.format(n);

// A rolling window (six or twelve months back to today) rather than the calendar year.
export const isRolling = (d: ContributionData) => d.window !== "year";

// "the last 6 months", "the last 12 months" or "2026": the window as a phrase, and with "in" for captions.
export const windowName = (d: ContributionData) =>
  d.window === "6mo" ? "the last 6 months" : d.window === "12mo" ? "the last 12 months" : yearOf(d);
export const windowPeriod = (d: ContributionData) => "in " + windowName(d);

const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

// "August 8 to October 6"; both ends carry the year when they fall in different years or `withYear` asks.
export const dateSpan = (from: string, to: string, withYear = false) => {
  const f = withYear || from.slice(0, 4) !== to.slice(0, 4) ? monthDayYear : monthDay;
  return from === to ? f.format(dayMs(from)) : f.format(dayMs(from)) + " to " + f.format(dayMs(to));
};

export const sinceDate = (date: string) => "since " + monthDay.format(dayMs(date));

// The streak shown: the current one only (Aaron contributes daily, so the
// longest is the same number twice). On a day with no contribution yet the
// fetch script's `current` is the run that ended yesterday; the longest is
// kept in the fixture and never rendered.
export const currentStreak = (d: ContributionData): Streak => d.streaks.current;

export const STREAK_LABEL = "current streak of contributions";
