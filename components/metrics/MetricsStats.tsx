import { siteContent } from "@/lib/content";
import { seriesStats, shortDate, slotStats, type Stat } from "@/lib/metrics/format";
import type { GithubSeries } from "@/lib/metrics/series";

const LIST = "grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-1";

function StatRows({ stats }: { stats: Stat[] }) {
  return stats.map((s) => (
    <div key={s.key} data-stat={s.key} className="flex min-w-0 flex-col-reverse gap-1.5">
      <dt className="font-label text-label-sm text-muted">
        {s.label}
        {s.sub && <span className="block">{s.sub}</span>}
      </dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="font-display text-section tabular-nums text-foreground">{s.value}</span>
        {s.unit && <span className="font-label text-label text-muted">{s.unit}</span>}
      </dd>
    </div>
  ));
}

// Server-rendered beside the chart: the figures are in the HTML before any script.
export function MetricsStats({ series }: { series: GithubSeries }) {
  const { metrics } = siteContent;
  return (
    <div>
      <dl role="group" aria-label={metrics.statsLabel} className={LIST}>
        <StatRows stats={seriesStats(series)} />
      </dl>
      {series.stale && (
        <p data-metrics-stale="" className="mt-6 font-label text-label-sm text-muted">
          {metrics.asOf} {shortDate(series.range.to)}
        </p>
      )}
    </div>
  );
}

// My own figures (the LinkedIn line) in a list of their own, outside the
// GitHub group, so assistive tech never files them under GitHub. Each figure's
// label names it; nothing else does.
export function MetricsSlots() {
  const stats = slotStats();
  if (stats.length === 0) return null;
  return (
    <dl className={LIST}>
      <StatRows stats={stats} />
    </dl>
  );
}
