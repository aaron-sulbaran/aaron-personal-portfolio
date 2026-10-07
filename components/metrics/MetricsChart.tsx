"use client";

import { useRef } from "react";
import type { Series } from "@/lib/metrics/series";
import { ContributionSkyline } from "./ContributionSkyline";
import { useScrollMorph } from "./useScrollMorph";

export function MetricsChart({ series }: { series: Series }) {
  const block = useRef<HTMLDivElement>(null);
  const { view, choose } = useScrollMorph(block);
  return (
    <div ref={block} data-metrics-block="">
      <ContributionSkyline series={series} view={view} onViewChange={choose} />
    </div>
  );
}
