"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ListFilter, X } from "lucide-react";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { STATUS_GROUPS, type StatusGroup } from "@/lib/recruiting/funnel";
import { laneLabel } from "@/lib/recruiting/format";
import { LANES, type Lane } from "@/lib/recruiting/types";

// The dashboard's filter: a funnel-icon button that opens a checkbox panel
// (lanes, status groups, ignored outreach) in any combination. After Stripe's
// Payments filter and Goldman Sachs' filter sheet (docs/research/inspiration/
// 2026-09-24-filter-popover-and-sheet.md): choices are staged and committed
// with Apply, each option shows its count, the header states the result, and
// phones get a bottom sheet instead of a popover. Nothing ticked in a section
// means everything in it.

export interface FilterValue {
  lanes: Lane[];
  statuses: StatusGroup[];
  includeOutreach: boolean;
}

export interface FilterCounts {
  lanes: Partial<Record<Lane, number>>;
  statuses: Partial<Record<StatusGroup, number>>;
  outreach: number;
  total: number;
}

const copy = siteContent.recruiting.filter;

export function activeCount(value: FilterValue): number {
  return value.lanes.length + value.statuses.length + (value.includeOutreach ? 1 : 0);
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

interface FilterMenuProps {
  value: FilterValue;
  counts: FilterCounts;
  // How many applications a staged selection would show, for the header.
  resultCount: (draft: FilterValue) => number;
  onApply: (next: FilterValue) => void;
}

export function FilterMenu({ value, counts, resultCount, onApply }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const narrow = useNarrow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = activeCount(value);

  // Desktop popover closes on a click anywhere outside it.
  useEffect(() => {
    if (!open || narrow) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, narrow]);

  const panel = open && (
    <FilterPanel
      value={value}
      counts={counts}
      resultCount={resultCount}
      sheet={narrow}
      onClose={() => setOpen(false)}
      onApply={(next) => {
        onApply(next);
        setOpen(false);
      }}
    />
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-cursor-hover
        className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 ${
          active > 0
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-glass text-foreground hover:border-accent hover:text-accent"
        }`}
      >
        <ListFilter aria-hidden="true" className="h-4 w-4" />
        {copy.button}
        {active > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-semibold text-foreground tabular-nums">
            {active}
          </span>
        )}
      </button>
      {panel && (narrow ? <Portal>{panel}</Portal> : panel)}
    </div>
  );
}

interface PanelProps {
  value: FilterValue;
  counts: FilterCounts;
  resultCount: (draft: FilterValue) => number;
  sheet: boolean;
  onClose: () => void;
  onApply: (next: FilterValue) => void;
}

function FilterPanel({ value, counts, resultCount, sheet, onClose, onApply }: PanelProps) {
  const [draft, setDraft] = useState<FilterValue>(value);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEscapeKey(true, onClose);
  useFocusTrap(panelRef, mounted);
  useBodyScrollLock(sheet);

  // Ticking every option in a section is the same as ticking none: store none.
  const setLanes = (lanes: Lane[]) => setDraft((d) => ({ ...d, lanes: lanes.length === LANES.length ? [] : lanes }));
  const setStatuses = (statuses: StatusGroup[]) =>
    setDraft((d) => ({ ...d, statuses: statuses.length === STATUS_GROUPS.length ? [] : statuses }));

  const body = (
    <div
      ref={(el) => {
        panelRef.current = el;
        if (el && !mounted) setMounted(true);
      }}
      role="dialog"
      aria-modal={sheet}
      aria-label={copy.heading}
      className={
        sheet
          ? "relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl border border-border/60 bg-background shadow-[0_-20px_60px_-20px_rgba(10,10,10,0.45)]"
          : "absolute left-0 top-full z-40 mt-2 flex w-[300px] flex-col rounded-2xl border border-border bg-background shadow-[0_24px_60px_-20px_rgba(10,10,10,0.4)]"
      }
    >
      {sheet && <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border" />}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-3.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-xl italic leading-none">{copy.heading}</h2>
          <p className="text-[12px] tabular-nums text-muted">{copy.results(resultCount(draft), counts.total + (draft.includeOutreach ? counts.outreach : 0))}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDraft({ lanes: [], statuses: [], includeOutreach: false })}
            disabled={activeCount(draft) === 0}
            data-cursor-hover
            className="min-h-[32px] rounded-full px-2 text-[13px] font-medium text-accent transition-opacity duration-200 disabled:opacity-40"
          >
            {copy.clearAll}
          </button>
          {sheet && (
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3.5">
        <Section
          label={copy.lane}
          options={LANES.map((lane) => ({ key: lane, label: laneLabel(lane), count: counts.lanes[lane] ?? 0 }))}
          selected={draft.lanes}
          onChange={(keys) => setLanes(keys as Lane[])}
        />
        <Section
          label={copy.status}
          options={STATUS_GROUPS.map((group) => ({ key: group, label: copy.statuses[group], count: counts.statuses[group] ?? 0 }))}
          selected={draft.statuses}
          onChange={(keys) => setStatuses(keys as StatusGroup[])}
        />
        <label data-cursor-hover className="flex min-h-[36px] cursor-pointer items-center gap-3 border-t border-border pt-3 text-sm">
          <input
            type="checkbox"
            checked={draft.includeOutreach}
            onChange={(e) => setDraft((d) => ({ ...d, includeOutreach: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          <span className="flex-1 text-foreground">{copy.outreach}</span>
          <span className="text-[12px] tabular-nums text-muted">{counts.outreach}</span>
        </label>
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => onApply(draft)}
          data-cursor-hover
          className="min-h-[40px] w-full rounded-full border border-foreground bg-foreground text-sm font-medium text-background transition-opacity duration-200 hover:opacity-85"
        >
          {copy.apply}
        </button>
      </div>
    </div>
  );

  if (!sheet) return body;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-background/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {body}
    </div>
  );
}

interface Option {
  key: string;
  label: string;
  count: number;
}

// One section: a parent checkbox (all, some, none) and one row per option with
// its count. Nothing ticked means the section does not filter.
function Section({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const parentRef = useRef<HTMLInputElement>(null);
  const some = selected.length > 0 && selected.length < options.length;
  useEffect(() => {
    if (parentRef.current) parentRef.current.indeterminate = some;
  }, [some]);

  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="sr-only">{label}</legend>
      <Row>
        <input
          ref={parentRef}
          type="checkbox"
          checked={selected.length > 0 && !some}
          onChange={() => onChange(selected.length > 0 ? [] : options.map((o) => o.key))}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        <span className="flex-1 text-[11px] font-medium uppercase tracking-caps text-muted">{label}</span>
      </Row>
      {options.map((option) => (
        <Row key={option.key} indent>
          <input
            type="checkbox"
            checked={selected.includes(option.key)}
            onChange={() => onChange(toggle(selected, option.key))}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          <span className={`flex-1 text-sm ${option.count === 0 ? "text-muted" : "text-foreground"}`}>{option.label}</span>
          <span className="text-[12px] tabular-nums text-muted">{option.count}</span>
        </Row>
      ))}
    </fieldset>
  );
}

function Row({ children, indent = false }: { children: ReactNode; indent?: boolean }) {
  return (
    <label data-cursor-hover className={`flex min-h-[34px] cursor-pointer items-center gap-3 ${indent ? "pl-6" : ""}`}>
      {children}
    </label>
  );
}
