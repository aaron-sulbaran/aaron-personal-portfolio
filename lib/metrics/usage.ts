import snapshot from "./data/usage-6mo.json";
import type { UsageDay, UsageSeries } from "./series";
import { toolTotal, usageSnapshotSchema } from "./usageSchema";
import { summarize, windowStart } from "./window";

type TotalsDay = { d: string; claude: number; codex: number };

// Every day from `from` to `to`, each tool's total tokens and their sum, from
// days already reduced to one total per tool.
export function totalsDays(days: readonly TotalsDay[], from: string, to: string) {
  const byDate = new Map(days.map((d) => [d.d, d]));
  const summary = summarize(
    [...byDate.values()].map((d) => ({ date: d.d, count: d.claude + d.codex })),
    from,
    to,
  );
  const filled: UsageDay[] = summary.days.map((d) => ({ ...d, claude: byDate.get(d.date)?.claude ?? 0, codex: byDate.get(d.date)?.codex ?? 0 }));
  return { ...summary, days: filled };
}

// The six-month series ending `last`. The committed snapshot and the daily
// feed (lib/metrics/usageFeed.ts) both end here.
export function usageSeries(
  days: readonly TotalsDay[],
  toolkit: UsageSeries["toolkit"],
  last: string,
  { stale, updatedAt }: { stale: boolean; updatedAt?: string },
): UsageSeries {
  const from = windowStart(last, "6mo");
  return { kind: "usage", window: "6mo", range: { from, to: last }, ...totalsDays(days, from, last), stale, ...(updatedAt ? { updatedAt } : {}), toolkit };
}

// The committed snapshot from scripts/usage-snapshot.mjs: total tokens, cache
// reads and writes included, as Claude Code's own "Total tokens" counts them.
// Cursor stays out until it has a real request log. Always stale: it moves
// when the script is rerun and committed. It is the fallback behind the daily
// feed, which keeps the figures fresh without a commit.
export function loadUsage(): UsageSeries {
  const parsed = usageSnapshotSchema.parse(snapshot);
  const last = parsed.days.at(-1)?.d ?? parsed.generated.slice(0, 10);
  return usageSeries(parsed.days.map((d) => ({ d: d.d, claude: toolTotal(d.claude), codex: toolTotal(d.codex) })), parsed.toolkit, last, { stale: true });
}
