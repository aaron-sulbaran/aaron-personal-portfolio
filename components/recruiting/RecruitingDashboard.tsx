"use client";

import { useMemo, useState } from "react";
import { siteContent } from "@/lib/content";
import { computeFunnel, computeStats, filterApplications } from "@/lib/recruiting/funnel";
import type { RecruitingExport, Season } from "@/lib/recruiting/types";
import { ApplicationsTable } from "./ApplicationsTable";
import { Controls, type ControlState } from "./Controls";
import { FunnelSankey } from "./FunnelSankey";
import { StatTiles } from "./StatTiles";
import { OUTCOME_TONES, TONES } from "./tones";

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
            <span className="ml-3 font-sans text-sm not-italic text-muted">{copy.funnel.countLabel(funnel.counted)}</span>
          </h2>
          <div className="flex flex-col items-start gap-1.5 text-[12px] text-muted md:items-end">
            <OutcomeLegend />
            {funnel.planned > 0 && <span>{copy.funnel.plannedNote(funnel.planned)}</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-glass px-4 py-3 md:px-6 md:py-4">
          <FunnelSankey funnel={funnel} />
        </div>
      </section>

      <ApplicationsTable
        rows={rows}
        note={copy.tableNote({ counted: funnel.counted, planned: funnel.planned, outreach: funnel.outreach, unapplied: funnel.unapplied })}
      />
    </div>
  );
}

// Outcome legend: what a flow's color means. Lane colors are labeled on the
// chart's own source nodes, so they need no second legend here.
function OutcomeLegend() {
  const tones = siteContent.recruiting.funnel.tones;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={siteContent.recruiting.funnel.outcomesLabel}>
      {OUTCOME_TONES.map((tone) => {
        const style = TONES[tone];
        return (
          <li key={tone} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[3px]"
              style={
                style.hollow
                  ? { border: `1.5px dashed ${style.color}` }
                  : { background: style.color, opacity: Math.max(style.nodeOpacity, 0.55) }
              }
            />
            {tones[tone]}
          </li>
        );
      })}
    </ul>
  );
}
