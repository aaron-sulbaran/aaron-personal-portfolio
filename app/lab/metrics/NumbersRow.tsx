"use client";

import { useContributions } from "./context";
import { activeDays, currentStreak, formatCount, isRolling, rangeTotal, sinceDate, STREAK_LABEL, windowName } from "./derive";
import type { Lead } from "./settings";

// Three real figures from the GitHub data, the lead first, and two slots
// Aaron fills. The placeholders read as placeholders: muted, dashed, and
// labelled so.

type Figure = { value: string; label: string; sub?: string; placeholder?: boolean };

const ORDER: readonly Lead[] = ["streak", "total", "days"];

export function NumbersRow({ lead }: { lead: Lead }) {
  const d = useContributions();
  const streak = currentStreak(d);
  const rolling = isRolling(d);
  const real: Record<Lead, Figure> = {
    streak: { value: formatCount(streak.days), label: STREAK_LABEL, sub: streak.start ? sinceDate(streak.start) : undefined },
    total: {
      value: formatCount(rangeTotal(d)),
      label: "contributions in " + windowName(d),
      sub: rolling ? "on GitHub, private work included" : "so far, private work included",
    },
    days: {
      value: formatCount(activeDays(d)),
      label: "days I shipped something",
      sub: rolling ? "in " + windowName(d) : "since January 1",
    },
  };
  const figures: Figure[] = [
    real[lead],
    ...ORDER.filter((k) => k !== lead).map((k) => real[k]),
    { value: "00", label: "Placeholder: a LinkedIn figure", sub: "Aaron supplies", placeholder: true },
    { value: "00", label: "Placeholder: a figure of yours", sub: "e.g. hackathons", placeholder: true },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-5">
      {figures.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col-reverse gap-2">
          <dt className="m-label-sm text-muted">
            <span className={f.placeholder ? "m-placeholder" : undefined}>{f.label}</span>
            {f.sub && <span className="block opacity-80">{f.sub}</span>}
          </dt>
          <dd className={"font-display text-section tabular-nums " + (f.placeholder ? "m-placeholder text-muted" : "text-foreground")}>
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
