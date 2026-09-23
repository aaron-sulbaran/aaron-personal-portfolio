import { siteContent } from "@/lib/content";
import type { FunnelStats } from "@/lib/recruiting/funnel";
import { formatDays, formatPercent } from "@/lib/recruiting/format";

// One small row of headline numbers above the funnel. Label under value,
// hairline dividers instead of cards so the row reads as one strip.
export function StatTiles({ stats }: { stats: FunnelStats }) {
  const copy = siteContent.recruiting.tiles;
  const tiles: Array<{ label: string; value: string }> = [
    { label: copy.applications, value: String(stats.applications) },
    { label: copy.responseRate, value: formatPercent(stats.responseRate) },
    { label: copy.interviewRate, value: formatPercent(stats.interviewRate) },
    { label: copy.offers, value: String(stats.offers) },
    { label: copy.medianResponse, value: formatDays(stats.medianResponseDays) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-5 sm:grid-cols-3 md:grid-cols-5 md:gap-x-0 md:gap-y-0">
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className={`flex flex-col gap-1 md:border-l md:border-border md:px-4 ${i === 0 ? "md:border-l-0 md:pl-0" : ""}`}
        >
          <dd className="order-1 text-3xl font-semibold leading-none tracking-tight text-foreground md:text-4xl">
            {tile.value}
          </dd>
          <dt className="order-2 text-[11px] font-medium uppercase tracking-caps text-muted">
            {tile.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
