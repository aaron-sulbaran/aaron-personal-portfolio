"use client";

import { siteContent } from "@/lib/content";
import { laneLabel } from "@/lib/recruiting/format";
import { LANES, type Lane, type Season } from "@/lib/recruiting/types";

export type SeasonChoice = Season | "both";

export interface ControlState {
  season: SeasonChoice;
  lane: Lane | "all";
  includeOutreach: boolean;
}

interface ControlsProps {
  seasons: ReadonlyArray<Season>;
  state: ControlState;
  onChange: (next: ControlState) => void;
}

const copy = siteContent.recruiting.controls;

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

export function Controls({ seasons, state, onChange }: ControlsProps) {
  const seasonOptions: Array<{ value: SeasonChoice; label: string }> = [
    ...seasons.map((s) => ({ value: s as SeasonChoice, label: s })),
    ...(seasons.length > 1 ? [{ value: "both" as SeasonChoice, label: copy.seasonBoth }] : []),
  ];
  const laneOptions: Array<{ value: Lane | "all"; label: string }> = [
    { value: "all", label: copy.laneAll },
    ...LANES.map((lane) => ({ value: lane, label: laneLabel(lane) })),
  ];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-x-10">
      <Segment
        label={copy.season}
        value={state.season}
        options={seasonOptions}
        onChange={(season) => onChange({ ...state, season })}
      />
      <Segment
        label={copy.lane}
        value={state.lane}
        options={laneOptions}
        onChange={(lane) => onChange({ ...state, lane })}
      />
      <label
        data-cursor-hover
        className="inline-flex min-h-[36px] cursor-pointer items-center gap-2.5 text-sm text-foreground"
      >
        <input
          type="checkbox"
          checked={state.includeOutreach}
          onChange={(e) => onChange({ ...state, includeOutreach: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        {copy.outreach}
      </label>
    </div>
  );
}
