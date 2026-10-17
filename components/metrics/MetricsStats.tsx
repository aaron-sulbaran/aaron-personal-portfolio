import type { Stat } from "@/lib/metrics/format";

const LIST = "grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-1";
// The stale stamp's seat over the first figure: one fixed line, so the figures
// beside it (two columns on a phone) start level whether or not it is shown.
const STAMP_SEAT = "mb-1.5 h-5";
const STAMP_OFFSET = "max-md:mt-[1.625rem]";

// The number sits above its label. dt and dd are direct children of the dl (a
// wrapper div fails the definition-list check), so the order is explicit:
// the dt comes first in the markup and the dd takes the top grid row.
export function StatRow({ stat }: { stat: Stat }) {
  return (
    <dl className="grid min-w-0 gap-y-1.5">
      <dt data-stat={stat.key} className="row-start-2 font-label text-label-sm text-muted">
        {stat.label}
        {stat.sub && <span className="block">{stat.sub}</span>}
      </dt>
      <dd className="row-start-1 flex items-baseline gap-1.5">
        <span className="font-display text-section tabular-nums text-foreground">{stat.value}</span>
        {stat.unit && <span className="font-label text-label text-muted">{stat.unit}</span>}
      </dd>
    </dl>
  );
}

export type FigureSlot = { stat: Stat; stamp: string | null };

// The figure column: three slots, each its own element so the wave can mask
// one at a time (components/metrics/useWave.ts). The stale stamp is part of
// the first slot, so it swaps with the first figure. Rendered in the HTML
// before any script.
export function FigureColumn({
  slots,
  label,
  kind,
  register,
}: {
  slots: FigureSlot[];
  label: string;
  kind: string;
  register: (index: number, el: HTMLDivElement | null) => void;
}) {
  return (
    <div role="group" aria-label={label} data-metrics-figures={kind} className={LIST}>
      {slots.map(({ stat, stamp }, index) => (
        <div key={index} ref={(el) => register(index, el)} data-figure-slot={index} className={`min-w-0 ${index === 1 ? STAMP_OFFSET : ""}`}>
          {index === 0 && (
            <div className={STAMP_SEAT}>
              {stamp && (
                <p data-metrics-stale="" className="font-label text-label-sm text-muted">
                  {stamp}
                </p>
              )}
            </div>
          )}
          <StatRow stat={stat} />
        </div>
      ))}
    </div>
  );
}

// My own figures in a list of their own, outside the chart's group, so
// assistive tech never files them under GitHub. Each figure's label names it;
// nothing else does. Empty today (no slot is set), and then nothing renders.
export function MetricsSlots({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className={LIST}>
      {stats.map((stat) => (
        <StatRow key={stat.key} stat={stat} />
      ))}
    </div>
  );
}
