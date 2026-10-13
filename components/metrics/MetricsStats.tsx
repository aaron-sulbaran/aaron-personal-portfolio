import { Fragment } from "react";
import { siteContent } from "@/lib/content";
import { seriesStats, shortDate, slotStats, type Stat } from "@/lib/metrics/format";
import type { GithubSeries } from "@/lib/metrics/series";

const LIST = "grid grid-cols-2 gap-x-6 md:grid-cols-1";

// The number sits above its label. dt and dd are direct children of the dl
// (a wrapper div fails the definition-list check). Placement is explicit so
// two columns on a phone still stack each figure.
const PAIR = [
  { dd: "col-start-1 row-start-1", dt: "col-start-1 row-start-2" },
  { dd: "col-start-2 row-start-1 md:col-start-1 md:row-start-3", dt: "col-start-2 row-start-2 md:col-start-1 md:row-start-4" },
  { dd: "col-start-1 row-start-3 md:row-start-5", dt: "col-start-1 row-start-4 md:row-start-6" },
  { dd: "col-start-2 row-start-3 md:col-start-1 md:row-start-7", dt: "col-start-2 row-start-4 md:col-start-1 md:row-start-8" },
];

function StatRows({ stats }: { stats: Stat[] }) {
  const lastRow = stats.length - (stats.length % 2 === 0 ? 2 : 1);
  return stats.map((s, i) => {
    const place = PAIR[i] ?? PAIR[0];
    const under = i < lastRow ? "mb-8" : "mb-0";
    const underDesktop = i < stats.length - 1 ? "md:mb-8" : "md:mb-0";
    return (
      <Fragment key={s.key}>
        <dt data-stat={s.key} className={`${place.dt} ${under} ${underDesktop} font-label text-label-sm text-muted`}>
          {s.label}
          {s.sub && <span className="block">{s.sub}</span>}
        </dt>
        <dd className={`${place.dd} mb-1.5 flex items-baseline gap-1.5`}>
          <span className="font-display text-section tabular-nums text-foreground">{s.value}</span>
          {s.unit && <span className="font-label text-label text-muted">{s.unit}</span>}
        </dd>
      </Fragment>
    );
  });
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
