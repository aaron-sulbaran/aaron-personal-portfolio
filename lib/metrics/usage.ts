import snapshot from "./data/usage-6mo.json";
import type { UsageDay, UsageSeries } from "./series";
import { toolTotal, usageSnapshotSchema, type UsageSnapshot } from "./usageSchema";
import { summarize, windowStart } from "./window";

// Every day from `from` to `to`, each tool's total tokens and their sum.
export function usageDays(parsed: UsageSnapshot, from: string, to: string) {
  const byDate = new Map(parsed.days.map((d) => [d.d, { claude: toolTotal(d.claude), codex: toolTotal(d.codex) }]));
  const summary = summarize(
    [...byDate].map(([date, t]) => ({ date, count: t.claude + t.codex })),
    from,
    to,
  );
  const days: UsageDay[] = summary.days.map((d) => ({ ...d, claude: byDate.get(d.date)?.claude ?? 0, codex: byDate.get(d.date)?.codex ?? 0 }));
  return { ...summary, days };
}

// The committed snapshot from scripts/usage-snapshot.mjs: total tokens, cache
// reads and writes included, as Claude Code's own "Total tokens" counts them.
// Cursor stays out until it has a real request log. Always stale: it moves
// when the script is rerun and committed.
export function loadUsage(): UsageSeries {
  const parsed = usageSnapshotSchema.parse(snapshot);
  const last = parsed.days.at(-1)?.d ?? parsed.generated.slice(0, 10);
  const from = windowStart(last, "6mo");
  return { kind: "usage", window: "6mo", range: { from, to: last }, ...usageDays(parsed, from, last), stale: true, toolkit: parsed.toolkit };
}
