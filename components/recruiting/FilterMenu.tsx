"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { siteContent } from "@/lib/content";
import { STATUS_GROUPS, type StatusGroup } from "@/lib/recruiting/funnel";
import { laneLabel } from "@/lib/recruiting/format";
import { LANES, type Lane } from "@/lib/recruiting/types";
import { Menu, MenuButton } from "./Popover";

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
  const active = activeCount(value);
  return (
    <Menu
      label={copy.heading}
      trigger={({ open, toggle: flip }) => (
        <MenuButton open={open} toggle={flip} active={active > 0}>
          <ListFilter aria-hidden="true" className="h-4 w-4" />
          {copy.button}
          {active > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-semibold text-foreground tabular-nums">
              {active}
            </span>
          )}
        </MenuButton>
      )}
    >
      {(close) => (
        <FilterBody
          value={value}
          counts={counts}
          resultCount={resultCount}
          onApply={(next) => {
            onApply(next);
            close();
          }}
        />
      )}
    </Menu>
  );
}

// Mounted fresh on every open, so the staged draft always starts from what is applied.
function FilterBody({
  value,
  counts,
  resultCount,
  onApply,
}: Omit<FilterMenuProps, "onApply"> & { onApply: (next: FilterValue) => void }) {
  const [draft, setDraft] = useState<FilterValue>(value);
  // Ticking every option in a section is the same as ticking none: store none.
  const setLanes = (lanes: Lane[]) => setDraft((d) => ({ ...d, lanes: lanes.length === LANES.length ? [] : lanes }));
  const setStatuses = (statuses: StatusGroup[]) =>
    setDraft((d) => ({ ...d, statuses: statuses.length === STATUS_GROUPS.length ? [] : statuses }));

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-3.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-serif text-xl italic leading-none">{copy.heading}</h2>
          <p className="text-[12px] tabular-nums text-muted">
            {copy.results(resultCount(draft), counts.total + (draft.includeOutreach ? counts.outreach : 0))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ lanes: [], statuses: [], includeOutreach: false })}
          disabled={activeCount(draft) === 0}
          data-cursor-hover
          className="min-h-[32px] rounded-full px-2 text-[13px] font-medium text-accent transition-opacity duration-200 disabled:opacity-40"
        >
          {copy.clearAll}
        </button>
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
    </>
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
