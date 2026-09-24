"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { HOLDING_MODE } from "@/lib/holding";
import { applyPendingEdits, type FailedEdit, type PendingEdit } from "@/lib/recruiting/edits";
import {
  computeFunnel,
  computeStats,
  filterApplications,
  statusGroup,
  type FunnelFilter,
} from "@/lib/recruiting/funnel";
import type { RecruitingExport, Season } from "@/lib/recruiting/types";
import { ApplicationsTable } from "./ApplicationsTable";
import { Controls, type ControlState } from "./Controls";
import { EditDialog, type EditTarget } from "./EditDialog";
import type { FilterCounts, FilterValue } from "./FilterMenu";
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

interface RecruitingDashboardProps {
  data: RecruitingExport;
  pending: PendingEdit[];
  failed: FailedEdit[];
  editsError: string | null;
  canEdit: boolean;
}

export function RecruitingDashboard({ data, pending, failed, editsError, canEdit }: RecruitingDashboardProps) {
  const seasons = useMemo(() => [...data.seasons].sort(), [data.seasons]);
  // Edits filed in this visit show at once; the server list catches up on the
  // next render and the two are merged by issue number.
  const [filed, setFiled] = useState<PendingEdit[]>([]);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const applications = useMemo(() => {
    const known = new Set(pending.map((p) => p.number));
    return applyPendingEdits(data.applications, [...pending, ...filed.filter((f) => !known.has(f.number))]);
  }, [data.applications, pending, filed]);
  const [state, setState] = useState<ControlState>(() => ({
    season: defaultSeason(data),
    filter: { lanes: [], statuses: [], includeOutreach: false },
  }));

  const seasonList = useMemo(() => (state.season === "both" ? seasons : [state.season]), [state.season, seasons]);
  const toFunnelFilter = useMemo(
    () =>
      (f: FilterValue): FunnelFilter => ({
        seasons: seasonList,
        lanes: f.lanes,
        statuses: f.statuses,
        includeOutreach: f.includeOutreach,
      }),
    [seasonList],
  );
  const filter = useMemo(() => toFunnelFilter(state.filter), [toFunnelFilter, state.filter]);

  const funnel = useMemo(() => computeFunnel(applications, filter), [applications, filter]);
  const stats = useMemo(() => computeStats(applications, filter), [applications, filter]);
  const rows = useMemo(() => filterApplications(applications, filter), [applications, filter]);
  const copy = siteContent.recruiting;

  // Counts shown next to each filter option: this season, before lane and
  // status filtering, so every option says how much it would bring in.
  const counts = useMemo<FilterCounts>(() => {
    const inSeason = filterApplications(applications, { seasons: seasonList, lanes: null, includeOutreach: true });
    const out: FilterCounts = { lanes: {}, statuses: {}, outreach: 0, total: 0 };
    for (const app of inSeason) {
      if (app.tier === "outreach-ignored" || app.outcome === "ignored") {
        out.outreach += 1;
        continue;
      }
      out.total += 1;
      out.lanes[app.lane] = (out.lanes[app.lane] ?? 0) + 1;
      const group = statusGroup(app);
      out.statuses[group] = (out.statuses[group] ?? 0) + 1;
    }
    return out;
  }, [applications, seasonList]);
  const resultCount = (f: FilterValue) => filterApplications(applications, toFunnelFilter(f)).length;

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <StickyBar>
        <Controls seasons={seasons} state={state} onChange={setState} counts={counts} resultCount={resultCount} />
      </StickyBar>

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

      {(failed.length > 0 || editsError) && <EditsNotice failed={failed} error={editsError} />}

      <ApplicationsTable
        rows={rows}
        note={copy.tableNote({ counted: funnel.counted, planned: funnel.planned, outreach: funnel.outreach, unapplied: funnel.unapplied })}
        onEdit={canEdit ? (app) => setEditing({ kind: "update", app }) : undefined}
        onAdd={canEdit ? () => setEditing({ kind: "create" }) : undefined}
      />

      {editing && (
        <EditDialog
          target={editing}
          seasons={seasons}
          defaultSeason={defaultSeason(data)}
          onClose={() => setEditing(null)}
          onFiled={(edit) => setFiled((prev) => [...prev, edit])}
        />
      )}
    </div>
  );
}

function EditsNotice({ failed, error }: { failed: FailedEdit[]; error: string | null }) {
  const copy = siteContent.recruiting.edit;
  return (
    <div role="status" className="rounded-2xl border border-border bg-glass px-4 py-3 text-[13px] leading-relaxed text-foreground">
      {error && (
        <p>
          <span className="text-muted">{copy.loadError}</span> {error}
        </p>
      )}
      {failed.length > 0 && (
        <p>
          {copy.failedHeading(failed.length)}:{" "}
          {failed.map((f, i) => (
            <span key={f.number}>
              {i > 0 && ", "}
              <a href={f.url} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-2 hover:text-accent">
                {f.title}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// Season, Filter and the active chips scope the whole page, so they stay in
// reach while reading the table: the bar pins to the top of the viewport and
// only takes a surface (background, border, shadow) once it is stuck. Sits at
// z-20, under the site nav (z-30). In full-site mode the fixed nav (about
// 53-57px) owns the top edge, so the bar pins just below it; in holding mode
// there is no nav and it pins near the top.
function StickyBar({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="-mb-10 h-px md:-mb-12" />
      <div
        className={`sticky ${HOLDING_MODE ? "top-2" : "top-16"} z-20 -mx-3 rounded-2xl border px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-200 ${
          stuck
            ? "border-border bg-background shadow-[0_12px_32px_-18px_rgba(10,10,10,0.35)]"
            : "border-transparent"
        }`}
      >
        {children}
      </div>
    </>
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
