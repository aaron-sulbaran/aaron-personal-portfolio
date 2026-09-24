"use client";

import { X } from "lucide-react";
import { siteContent } from "@/lib/content";
import { laneLabel } from "@/lib/recruiting/format";
import type { Season } from "@/lib/recruiting/types";
import { FilterMenu, type FilterCounts, type FilterValue } from "./FilterMenu";

export type SeasonChoice = Season | "both";

export interface ControlState {
  season: SeasonChoice;
  filter: FilterValue;
}

interface ControlsProps {
  seasons: ReadonlyArray<Season>;
  state: ControlState;
  onChange: (next: ControlState) => void;
  counts: FilterCounts;
  resultCount: (filter: FilterValue) => number;
}

const copy = siteContent.recruiting.controls;
const filterCopy = siteContent.recruiting.filter;

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium uppercase tracking-caps text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-cursor-hover
              onClick={() => onChange(option.value)}
              className={`min-h-[36px] rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 ${
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-glass text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Controls({ seasons, state, onChange, counts, resultCount }: ControlsProps) {
  const seasonOptions: Array<{ value: SeasonChoice; label: string }> = [
    ...seasons.map((s) => ({ value: s as SeasonChoice, label: s })),
    ...(seasons.length > 1 ? [{ value: "both" as SeasonChoice, label: copy.seasonBoth }] : []),
  ];
  const { filter } = state;
  const setFilter = (next: FilterValue) => onChange({ ...state, filter: next });

  // One removable chip per active dimension, Stripe-style, so what is
  // filtered stays visible without opening the panel.
  const chips: Array<{ key: string; label: string; value: string; clear: () => void }> = [];
  if (filter.lanes.length)
    chips.push({
      key: "lane",
      label: filterCopy.lane,
      value: filter.lanes.map((l) => laneLabel(l)).join(", "),
      clear: () => setFilter({ ...filter, lanes: [] }),
    });
  if (filter.statuses.length)
    chips.push({
      key: "status",
      label: filterCopy.status,
      value: filter.statuses.map((g) => filterCopy.statuses[g]).join(", "),
      clear: () => setFilter({ ...filter, statuses: [] }),
    });
  if (filter.includeOutreach)
    chips.push({
      key: "outreach",
      label: filterCopy.outreachChip,
      value: "",
      clear: () => setFilter({ ...filter, includeOutreach: false }),
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segment
          label={copy.season}
          value={state.season}
          options={seasonOptions}
          onChange={(season) => onChange({ ...state, season })}
        />
        <FilterMenu value={filter} counts={counts} resultCount={resultCount} onApply={setFilter} />
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label={filterCopy.active}>
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.clear}
                aria-label={filterCopy.removeChip(chip.label)}
                data-cursor-hover
                className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-border bg-glass px-3 text-[13px] text-foreground transition-colors duration-200 hover:border-accent"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                <span className="text-muted">{chip.label}</span>
                {chip.value && (
                  <>
                    <span aria-hidden="true" className="h-3 w-px bg-border" />
                    <span className="font-medium">{chip.value}</span>
                  </>
                )}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setFilter({ lanes: [], statuses: [], includeOutreach: false })}
              data-cursor-hover
              className="min-h-[30px] px-1 text-[13px] font-medium text-muted underline decoration-border underline-offset-4 hover:text-accent"
            >
              {filterCopy.clearFilters}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
