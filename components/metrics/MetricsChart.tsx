"use client";

import { useRef, type ReactNode } from "react";
import type { Series } from "@/lib/metrics/series";
import { ContributionSkyline } from "./ContributionSkyline";
import { useScrollMorph } from "./useScrollMorph";

export function MetricsChart({ series, switchReverse, toolbar }: { series: Series; switchReverse: boolean; toolbar?: ReactNode }) {
  const block = useRef<HTMLDivElement>(null);
  const { view, choose } = useScrollMorph(block);
  return (
    <div ref={block} data-metrics-block="">
      <ContributionSkyline series={series} switchReverse={switchReverse} view={view} onViewChange={choose} toolbar={toolbar} />
    </div>
  );
}
