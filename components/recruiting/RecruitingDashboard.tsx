"use client";

import { useMemo, useState } from "react";
import { siteContent } from "@/lib/content";
import { computeFunnel, computeStats, filterApplications } from "@/lib/recruiting/funnel";
import type { RecruitingExport, Season } from "@/lib/recruiting/types";
import { ApplicationsTable } from "./ApplicationsTable";
import { Controls, type ControlState } from "./Controls";
import { FunnelSankey } from "./FunnelSankey";
import { StatTiles } from "./StatTiles";

// Client shell: one control row drives the tiles, the funnel and the table.
// Seasons come from the export so a new season appears without a deploy; the
// default is the latest one with rows, falling back to the latest listed.

function defaultSeason(data: RecruitingExport): Season {
  const withRows = new Set(data.applications.map((a) => a.season));
  const listed = [...data.seasons].sort();
  for (let i = listed.length - 1; i >= 0; i -= 1) {
    if (withRows.has(listed[i])) return listed[i];
  }
  return listed[listed.length - 1] ?? "";
}

export function RecruitingDashboard({ data }: { data: RecruitingExport }) {
  const seasons = useMemo(() => [...data.seasons].sort(), [data.seasons]);
  const [state, setState] = useState<ControlState>(() => ({
    season: defaultSeason(data),
    lane: "all",
    includeOutreach: false,
  }));

  const filter = useMemo(
    () => ({
      seasons: state.season === "both" ? seasons : [state.season],
      lanes: state.lane === "all" ? null : [state.lane],
      includeOutreach: state.includeOutreach,
    }),
    [state, seasons],
  );

  const funnel = useMemo(() => computeFunnel(data.applications, filter), [data.applications, filter]);
  const stats = useMemo(() => computeStats(data.applications, filter), [data.applications, filter]);
  const rows = useMemo(() => filterApplications(data.applications, filter), [data.applications, filter]);
  const copy = siteContent.recruiting;

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <Controls seasons={seasons} state={state} onChange={setState} />

      <StatTiles stats={stats} />

      <section aria-labelledby="funnel-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id="funnel-heading" className="font-serif text-3xl italic leading-none text-foreground md:text-4xl">
            {copy.funnel.heading}
            <span className="ml-3 font-sans text-sm not-italic text-muted">{funnel.counted}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted">
            <LaneLegend />
            {funnel.planned > 0 && <span>{copy.funnel.plannedNote(funnel.planned)}</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-glass px-4 py-3 md:px-6 md:py-4">
          <FunnelSankey funnel={funnel} />
        </div>
      </section>

      <ApplicationsTable rows={rows} />
    </div>
  );
}

const LEGEND: Array<{ lane: keyof typeof siteContent.recruiting.lanes; dot: string }> = [
  { lane: "full-time", dot: "bg-viz-lane-1" },
  { lane: "internship", dot: "bg-viz-lane-2" },
  { lane: "co-op", dot: "bg-viz-lane-3" },
];

function LaneLegend() {
  return (
    <ul className="flex items-center gap-4" aria-label={siteContent.recruiting.controls.lane}>
      {LEGEND.map((item) => (
        <li key={item.lane} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.dot}`} />
          {siteContent.recruiting.lanes[item.lane]}
        </li>
      ))}
    </ul>
  );
}
