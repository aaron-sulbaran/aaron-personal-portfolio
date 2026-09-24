"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Pencil, Plus } from "lucide-react";
import { siteContent } from "@/lib/content";
import {
  formatDate,
  laneLabel,
  laneTone,
  lastEventDate,
  statusLabel,
  statusTone,
  toCsv,
} from "@/lib/recruiting/format";
import { DEFAULT_SORT, sortApplications, type SortKey, type SortRule } from "@/lib/recruiting/sort";
import type { Application } from "@/lib/recruiting/types";
import { SortMenu } from "./SortMenu";

// The Sheet replacement: one row per application, sortable, status as a
// chip, CSV download of the current selection. Below md the same rows render
// as cards; the table never squeezes onto a phone.


const copy = siteContent.recruiting.table;
const editCopy = siteContent.recruiting.edit;

const STATUS_CHIP: Record<ReturnType<typeof statusTone>, string> = {
  progress: "chip-progress",
  warm: "chip-warm",
  cool: "chip-cool",
  muted: "chip-muted",
};

const LANE_DOT: Partial<Record<ReturnType<typeof laneTone>, string>> = {
  "lane-1": "bg-viz-lane-1",
  "lane-2": "bg-viz-lane-2",
  "lane-3": "bg-viz-lane-3",
  node: "bg-viz-node",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-caps ${STATUS_CHIP[statusTone(status)]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function PendingChip() {
  return (
    <span
      title={editCopy.pendingTitle}
      className="ml-1.5 inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-caps text-muted"
    >
      {editCopy.pending}
    </span>
  );
}

function EditButton({ app, onEdit }: { app: Application; onEdit: (app: Application) => void }) {
  // A row added from the dashboard has no ledger id until the sync applies it.
  if (app.id.startsWith("pending-")) return null;
  return (
    <button
      type="button"
      onClick={() => onEdit(app)}
      aria-label={editCopy.editRow(app.company)}
      title={editCopy.editRow(app.company)}
      data-cursor-hover
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-glass hover:text-accent"
    >
      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

function LaneCell({ app }: { app: Application }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${LANE_DOT[laneTone(app.lane)]}`} />
      {laneLabel(app.lane)}
    </span>
  );
}

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span
      role="img"
      aria-label={active ? copy.active : ""}
      title={active ? copy.active : undefined}
      className={`inline-block h-2 w-2 rounded-full ${active ? "bg-accent" : "bg-border"}`}
    />
  );
}

function download(rows: Application[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recruiting-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ApplicationsTableProps {
  rows: Application[];
  note?: string;
  // Absent when this deployment cannot file edits; the controls then hide.
  onEdit?: (app: Application) => void;
  onAdd?: () => void;
}

export function ApplicationsTable({ rows, note, onEdit, onAdd }: ApplicationsTableProps) {
  // Status first, the Sheet's order: live processes up top, closed ones last.
  // The Sort menu is the only control; column headers just show the result.
  const [rules, setRules] = useState<SortRule[]>(DEFAULT_SORT);
  const sorted = useMemo(() => sortApplications(rows, rules), [rows, rules]);
  const sortKey = rules[0].key;
  const sortDir = rules[0].dir;

  const columns: Array<{ key: SortKey | "role"; label: string; className?: string }> = [
    { key: "company", label: copy.columns.company },
    { key: "role", label: copy.columns.role, className: "w-[34%]" },
    { key: "lane", label: copy.columns.lane },
    { key: "season", label: copy.columns.season },
    { key: "status", label: copy.columns.status },
    { key: "applied", label: copy.columns.applied },
    { key: "lastEvent", label: copy.columns.lastEvent },
    { key: "next", label: copy.columns.next, className: "w-[16%]" },
  ];

  return (
    <section aria-labelledby="applications-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="applications-heading" className="font-serif text-3xl italic leading-none text-foreground md:text-4xl">
          {copy.heading}
          <span className="ml-3 font-sans text-sm not-italic text-muted">{rows.length}</span>
          {note && <span className="mt-2 block font-sans text-[12px] not-italic leading-snug text-muted">{note}</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
        <SortMenu rules={rules} onChange={setRules} />
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            data-cursor-hover
            className="inline-flex min-h-[36px] items-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-foreground px-3.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-85"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {editCopy.add}
          </button>
        )}
        <button
          type="button"
          onClick={() => download(sorted)}
          disabled={rows.length === 0}
          data-cursor-hover
          className="inline-flex min-h-[36px] items-center gap-2 whitespace-nowrap rounded-full border border-border bg-glass px-3.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          {copy.download}
        </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">{copy.empty}</p>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="w-6 py-2 pr-2" aria-label={copy.active} />
                  {columns.map((col) => {
                    const on = col.key === sortKey;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className={`py-2 pr-4 font-medium ${col.className ?? ""}`}
                        aria-sort={on ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-caps ${on ? "text-foreground" : "text-muted"}`}
                        >
                          {col.label}
                          {on &&
                            (sortDir === "asc" ? (
                              <ArrowUp aria-hidden="true" className="h-3 w-3" />
                            ) : (
                              <ArrowDown aria-hidden="true" className="h-3 w-3" />
                            ))}
                        </span>
                      </th>
                    );
                  })}
                  {onEdit && <th scope="col" className="w-8 py-2" aria-label={editCopy.updateHeading} />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((app) => (
                  <tr key={app.id} className="border-b border-border align-top transition-colors duration-150 hover:bg-glass">
                    <td className="py-3 pr-2"><ActiveDot active={app.active} /></td>
                    <td className="py-3 pr-4 font-medium text-foreground">{app.company}</td>
                    <td className="py-3 pr-4 text-foreground/85">{app.role}</td>
                    <td className="py-3 pr-4 whitespace-nowrap"><LaneCell app={app} /></td>
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums text-muted">{app.season}</td>
                    <td className="py-3 pr-4 whitespace-nowrap"><StatusChip status={app.status} />{app.pending && <PendingChip />}</td>
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums text-muted">{formatDate(app.applied)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums text-muted">{formatDate(lastEventDate(app))}</td>
                    <td className="py-3 pr-0 text-foreground/85">
                      {app.next?.what}
                      {app.next?.due && <span className="ml-1.5 whitespace-nowrap tabular-nums text-muted">{formatDate(app.next.due)}</span>}
                    </td>
                    {onEdit && <td className="py-2 pl-2"><EditButton app={app} onEdit={onEdit} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {sorted.map((app) => (
              <li key={app.id} className="rounded-2xl border border-border bg-glass px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ActiveDot active={app.active} />
                    <span className="font-medium text-foreground">{app.company}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusChip status={app.status} />
                    {app.pending && <PendingChip />}
                    {onEdit && <EditButton app={app} onEdit={onEdit} />}
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-foreground/85">{app.role}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <LaneCell app={app} />
                  <span className="tabular-nums">{app.season}</span>
                  {app.applied && <span className="tabular-nums">{copy.columns.applied} {formatDate(app.applied)}</span>}
                  {lastEventDate(app) && <span className="tabular-nums">{copy.columns.lastEvent} {formatDate(lastEventDate(app))}</span>}
                </div>
                {app.next?.what && (
                  <p className="mt-2 text-[13px] text-foreground/85">
                    <span className="text-muted">{copy.columns.next}: </span>
                    {app.next.what}
                    {app.next.due && <span className="ml-1.5 tabular-nums text-muted">{formatDate(app.next.due)}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

