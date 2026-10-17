import type { Toolkit } from "./usageSchema";
import type { SeriesWindow } from "./window";

// One series the skyline can draw: GitHub contributions, or AI tokens per day
// stacked by tool. Both share the window maths, the stats and the skyline;
// dayValues is the one place a cell's height and level are read from.
export type DayValue = { date: string; count: number };
export type Streak = { days: number; start: string | null; end: string | null };

export type GithubSeries = {
  kind: "github";
  window: SeriesWindow;
  range: { from: string; to: string };
  days: DayValue[];
  total: number;
  activeDays: number;
  streak: Streak;
  stale: boolean;
};

// A token day: each tool's total (input, output, cache reads and cache
// writes) and their sum in `count`.
export type UsageDay = DayValue & { claude: number; codex: number };

export type UsageSeries = {
  kind: "usage";
  window: SeriesWindow;
  range: { from: string; to: string };
  days: UsageDay[];
  total: number;
  activeDays: number;
  streak: Streak;
  stale: boolean;
  // The day (YYYY-MM-DD) the daily feed was made, when the series came from it.
  // The stale stamp reads it; the committed snapshot has none, so the stamp
  // falls back to the last day in range.
  updatedAt?: string;
  // The agent setup behind the tokens, for the fourth figure.
  toolkit: Toolkit;
};

export type Series = GithubSeries | UsageSeries;

// The selector the skyline reads a cell's height and colour through: the
// contribution count, or the day's tokens from both tools together.
export function dayValues(series: Series): DayValue[] {
  switch (series.kind) {
    case "github":
    case "usage":
      return series.days;
  }
}
