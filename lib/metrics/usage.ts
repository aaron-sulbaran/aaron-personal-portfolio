import snapshot from "./data/usage-6mo.json";
import type { UsageSeries } from "./series";
import { usageSnapshotSchema } from "./usageSchema";
import { summarize, windowStart } from "./window";

// The committed snapshot from scripts/usage-snapshot.mjs. Height is input plus
// output tokens from Claude and Codex. Cache reads stay out (they inflate the
// total by an order of magnitude) and Cursor stays out until it has a real
// request log. Always stale: it moves when the script is rerun and committed.
export function loadUsage(now = new Date()): UsageSeries {
  void now;
  const parsed = usageSnapshotSchema.parse(snapshot);
  const last = parsed.days.at(-1)?.d ?? parsed.generated.slice(0, 10);
  const from = windowStart(last, "6mo");
  const days = parsed.days.map((d) => ({
    date: d.d,
    count: d.claude.in + d.claude.out + d.codex.in + d.codex.out,
  }));
  return { kind: "usage", window: "6mo", range: { from, to: last }, ...summarize(days, from, last), stale: true };
}
