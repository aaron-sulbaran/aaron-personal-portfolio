"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { accentRamp, buildGrid, dayMs, weeklyTotals, type ContributionDay } from "./skyline/maths";

// The divider: the year's weekly totals standing on the hairline above the
// next section, so the border itself carries the data. Flat, no chart chrome,
// one line of text that becomes a readout on hover. The weeks are the
// skyline's own columns, so the two always agree.

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type RibbonProps = {
  days: ContributionDay[];
  endDate: string;
  range: { from: string; through?: string };
  share: number;
  period: string;
  caption: string;
};

export function Ribbon({ days, endDate, range, share, period, caption }: RibbonProps) {
  const weeks = useMemo(() => {
    const grid = buildGrid(days, dayMs(endDate), 0, {
      from: dayMs(range.from),
      through: range.through ? dayMs(range.through) : undefined,
    });
    return weeklyTotals(grid.cells, grid.weeks);
  }, [days, endDate, range.from, range.through]);
  const total = weeks.reduce((sum, w) => sum + (w.total ?? 0), 0);
  const max = Math.max(1, ...weeks.map((w) => w.total ?? 0));
  const ramp = accentRamp(share);
  const [hover, setHover] = useState(-1);
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Under reduced motion the bars carry no transition, so they simply appear.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const w = hover >= 0 ? weeks[hover] : null;
  const readout = w
    ? "Week of " + fmt.format(dayMs(w.start)) + ": " + (w.total === null ? "not yet" : w.total === 1 ? "1 contribution" : w.total + " contributions")
    : total + " contributions " + period;

  return (
    <div ref={ref} className="pt-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="m-label-sm tabular-nums text-muted" aria-live="polite">
          {readout}
        </span>
        <span className="m-label-sm text-muted">{caption}</span>
      </div>
      <div
        role="img"
        aria-label={total + " contributions " + period + ", as weekly totals"}
        className="flex h-16 items-end gap-[2px] md:h-20"
        onMouseLeave={() => setHover(-1)}
      >
        {weeks.map((week, i) => {
          const t = week.total ?? 0;
          const share01 = Math.sqrt(t / max);
          const level = t === 0 ? -1 : Math.min(3, Math.floor(share01 * 4));
          return (
            <span key={week.start} onMouseEnter={() => setHover(i)} className="relative flex h-full flex-1 items-end">
              <span
                className="block w-full origin-bottom transition-transform duration-700 motion-reduce:transition-none"
                style={{
                  height: t === 0 ? 1 : Math.max(3, share01 * 100) + "%",
                  background: level < 0 ? "var(--color-border)" : ramp[level],
                  opacity: week.total === null ? 0.5 : hover >= 0 && hover !== i ? 0.45 : 1,
                  transform: shown ? "scaleY(1)" : "scaleY(0)",
                  transitionDelay: shown ? i * 12 + "ms" : "0ms",
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
