import raw from "./data/contributions-6mo.json";
import type { GithubSeries } from "./series";
import { summarize } from "./window";

// The calendar as scripts/fetch-contributions.mjs last saw it. It serves when
// the token is unset or the fetch fails, always stamped stale, so the stats
// say "As of" their day rather than pretending to be live.
export function snapshotSeries(): GithubSeries {
  const { from, to } = raw.range;
  const days = raw.days.map((d) => ({ date: d.date, count: d.count }));
  return { kind: "github", window: "6mo", range: { from, to }, ...summarize(days, from, to), stale: true };
}
