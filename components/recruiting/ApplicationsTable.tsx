"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { siteContent } from "@/lib/content";
import {
  formatDate,
  laneLabel,
  laneTone,
  lastEventDate,
  stageRank,
  statusLabel,
  statusTone,
  toCsv,
} from "@/lib/recruiting/format";
import type { Application } from "@/lib/recruiting/types";

// The Sheet replacement: one row per application, sortable, status as a
// chip, CSV download of the current selection. Below md the same rows render
// as cards; the table never squeezes onto a phone.

type SortKey = "company" | "role" | "lane" | "season" | "status" | "applied" | "lastEvent" | "next";
type SortDir = "asc" | "desc";

const copy = siteContent.recruiting.table;

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

function sortValue(app: Application, key: SortKey): string | number {
  switch (key) {
    case "company":
      return app.company.toLowerCase();
    case "role":
      return app.role.toLowerCase();
    case "lane":
      return app.lane;
    case "season":
      return app.season;
    case "status":
      return app.status === "planned" ? -2 : stageRank(app.status) === -1 ? -1 : stageRank(app.status);
    case "applied":
      return app.applied ?? "";
    case "lastEvent":
      return lastEventDate(app) ?? "";
    case "next":
      return app.next?.due ?? "9999";
  }
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-caps ${STATUS_CHIP[statusTone(status)]}`}
    >
      {statusLabel(status)}
    </span>
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

export function ApplicationsTable({ rows, note }: { rows: Application[]; note?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("lastEvent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.company.localeCompare(b.company);
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "company" || key === "role" ? "asc" : "desc");
    }
  };

  const columns: Array<{ key: SortKey; label: string; className?: string }> = [
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
      <div className="flex items-end justify-between gap-4">
        <h2 id="applications-heading" className="font-serif text-3xl italic leading-none text-foreground md:text-4xl">
          {copy.heading}
          <span className="ml-3 font-sans text-sm not-italic text-muted">{rows.length}</span>
          {note && <span className="mt-2 block font-sans text-[12px] not-italic leading-snug text-muted">{note}</span>}
        </h2>
        <button
          type="button"
          onClick={() => download(sorted)}
          disabled={rows.length === 0}
          data-cursor-hover
          className="inline-flex min-h-[36px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-glass px-3.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          {copy.download}
        </button>
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
                      <th key={col.key} scope="col" className={`py-2 pr-4 font-medium ${col.className ?? ""}`}
                        aria-sort={on ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          data-cursor-hover
                          className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-caps transition-colors duration-200 hover:text-accent ${on ? "text-foreground" : "text-muted"}`}
                        >
                          {col.label}
                          {on && (sortDir === "asc"
                            ? <ArrowUp aria-hidden="true" className="h-3 w-3" />
                            : <ArrowDown aria-hidden="true" className="h-3 w-3" />)}
                        </button>
                      </th>
                    );
                  })}
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
                    <td className="py-3 pr-4"><StatusChip status={app.status} /></td>
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums text-muted">{formatDate(app.applied)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums text-muted">{formatDate(lastEventDate(app))}</td>
                    <td className="py-3 pr-0 text-foreground/85">
                      {app.next?.what}
                      {app.next?.due && <span className="ml-1.5 whitespace-nowrap tabular-nums text-muted">{formatDate(app.next.due)}</span>}
                    </td>
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
                  <StatusChip status={app.status} />
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
