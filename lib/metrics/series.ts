import type { SeriesWindow } from "./window";

// One series the skyline can draw. GitHub contributions today; a second kind
// (AI tokens per day, stacked by tool) joins this union with its own loader
// branch and its own case in dayValues, and nothing downstream changes.
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

// Tokens per day from Claude and Codex (input plus output only). Same shape
// as the GitHub series so the skyline, the stats and the window math are shared.
export type UsageSeries = {
  kind: "usage";
  window: SeriesWindow;
  range: { from: string; to: string };
  days: DayValue[];
  total: number;
  activeDays: number;
  streak: Streak;
  stale: boolean;
};

export type Series = GithubSeries | UsageSeries;

// The selector the skyline reads a cell's height and colour through.
export function dayValues(series: Series): DayValue[] {
  switch (series.kind) {
    case "github":
    case "usage":
      return series.days;
  }
}
