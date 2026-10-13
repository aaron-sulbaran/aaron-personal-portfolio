"use client";

import { useState } from "react";
import { siteContent } from "@/lib/content";
import type { GithubSeries, UsageSeries } from "@/lib/metrics/series";
import { MetricsChart } from "./MetricsChart";
import { MetricsStats } from "./MetricsStats";

// GitHub is the first paint. Claude and Codex is the same skyline with token
// counts (input plus output only). The choice is a press, not a route.
export function MetricsBoard({ github, usage }: { github: GithubSeries; usage: UsageSeries }) {
  const [source, setSource] = useState<"github" | "usage">("github");
  const series = source === "github" ? github : usage;
  const words = siteContent.metrics.usage;
  return (
    <div role="group" aria-labelledby="metrics-title metrics-label" className="grid gap-10 md:col-span-12 md:grid-cols-12">
      <div className="min-w-0 md:col-span-9">
        <div role="group" aria-label={words.toggleLabel} className="mb-4 flex flex-wrap gap-2">
          {(["github", "usage"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={source === key}
              onClick={() => setSource(key)}
              className={`rounded-full border border-border px-3 py-1 font-label text-label ${source === key ? "text-accent" : "text-muted"}`}
            >
              {key === "github" ? words.github : words.claude}
            </button>
          ))}
        </div>
        <MetricsChart key={series.kind} series={series} />
      </div>
      <div className="md:col-span-3 md:pt-12">
        <MetricsStats series={series} />
      </div>
    </div>
  );
}
