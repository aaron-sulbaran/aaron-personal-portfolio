"use client";

import { siteContent } from "@/lib/content";
import { seriesStats, staleStamp } from "@/lib/metrics/format";
import type { GithubSeries, UsageSeries } from "@/lib/metrics/series";
import { MetricsChart } from "./MetricsChart";
import { FigureColumn, type FigureSlot } from "./MetricsStats";
import { SeriesToggle } from "./skyline/parts";
import { ToolkitBand } from "./ToolkitBand";
import { useTokensSettings } from "./tokensSettings";
import { FIGURE_COUNT, useWave } from "./useWave";

const { metrics } = siteContent;

// Commits (GitHub) or Tokens (Claude Code and Codex): one chart, one canvas.
// The choice is a press, not a route; the chart never remounts, so the bars
// move to the new series in place and the seen rule and the morph carry on.
// The switch is one wave across the strip (useWave): the bars, each figure
// masked out and in, and under Tokens the toolkit band masked in.
export function MetricsBoard({ github, usage }: { github: GithubSeries; usage: UsageSeries }) {
  const { first, labels, waveGapMs, waveOffsetMs, maskMs } = useTokensSettings();
  const { choice, view, choose, board, register, registerBand } = useWave(first, { gapMs: waveGapMs, offsetMs: waveOffsetMs, maskMs });
  const seriesOf = (kind: "commits" | "tokens") => (kind === "commits" ? github : usage);
  const slots: FigureSlot[] = Array.from({ length: FIGURE_COUNT }, (_, index) => {
    const series = seriesOf(view.slots[index]);
    return { stat: seriesStats(series, labels)[index], stamp: index === 0 ? staleStamp(series, labels) : null };
  });
  return (
    <div
      ref={board}
      role="group"
      aria-labelledby="metrics-title metrics-label"
      data-wave-state="idle"
      data-wave-dir={first === "tokens" ? "ltr" : "rtl"}
      className="grid gap-10 md:col-span-12 md:grid-cols-12"
    >
      <div className="min-w-0 md:col-span-9">
        <MetricsChart series={seriesOf(view.bars)} switchReverse={view.reverse} toolbar={<SeriesToggle value={choice} onChange={choose} />} />
      </div>
      <div className="md:col-span-3 md:pt-6">
        <FigureColumn slots={slots} label={choice === "tokens" ? metrics.tokens.statsLabel : metrics.statsLabel} kind={seriesOf(choice).kind} register={register} />
      </div>
      {view.band && <ToolkitBand ref={registerBand} toolkit={usage.toolkit} labels={labels} />}
    </div>
  );
}
