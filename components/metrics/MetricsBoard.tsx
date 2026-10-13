"use client";

import { useState } from "react";
import type { GithubSeries, UsageSeries } from "@/lib/metrics/series";
import type { SeriesChoice } from "@/lib/metrics/settings";
import { MetricsChart } from "./MetricsChart";
import { MetricsStats } from "./MetricsStats";
import { SeriesToggle } from "./skyline/parts";
import { useTokensSettings } from "./tokensSettings";

// Commits (GitHub) or Tokens (Claude Code and Codex): one chart, one canvas.
// The choice is a press, not a route; the chart never remounts, so the bars
// move to the new series in place and the seen rule and the morph carry on.
// The figures swap with a fade once a choice has been made.
export function MetricsBoard({ github, usage }: { github: GithubSeries; usage: UsageSeries }) {
  const { first } = useTokensSettings();
  const [choice, setChoice] = useState<SeriesChoice>(first);
  const [switched, setSwitched] = useState(false);
  const series = choice === "commits" ? github : usage;
  const choose = (next: SeriesChoice) => {
    if (next === choice) return;
    setChoice(next);
    setSwitched(true);
  };
  return (
    <div role="group" aria-labelledby="metrics-title metrics-label" className="grid gap-10 md:col-span-12 md:grid-cols-12">
      <div className="min-w-0 md:col-span-9">
        <MetricsChart series={series} toolbar={<SeriesToggle value={choice} onChange={choose} />} />
      </div>
      <div className="md:col-span-3 md:pt-12">
        <div key={series.kind} data-metrics-figures={series.kind} className={switched ? "metrics-swap" : undefined}>
          <MetricsStats series={series} />
        </div>
      </div>
    </div>
  );
}
