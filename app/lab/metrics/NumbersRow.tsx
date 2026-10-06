"use client";

import { useContributions } from "./context";
import { accountMonths, rangeTotal, sinceLabel, yearOf } from "./derive";

// Three real figures from the GitHub data and two slots Aaron fills. The
// placeholders read as placeholders: muted, dashed, and labelled so.

type Figure = { value: string; label: string; sub?: string; placeholder?: boolean };

export function NumbersRow() {
  const d = useContributions();
  const figures: Figure[] = [
    { value: String(rangeTotal(d)), label: "contributions in " + yearOf(d), sub: "so far, on GitHub" },
    { value: String(d.publicRepos), label: "public repositories", sub: "and counting" },
    { value: String(accountMonths(d)), label: "months on GitHub", sub: "since " + sinceLabel(d) },
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
