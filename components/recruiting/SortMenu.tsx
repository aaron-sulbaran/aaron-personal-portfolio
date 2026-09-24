"use client";

import { ArrowUpDown } from "lucide-react";
import { siteContent } from "@/lib/content";
import { DEFAULT_DIR, DEFAULT_SORT, type SortDir, type SortKey, type SortRule } from "@/lib/recruiting/sort";
import { Menu, MenuButton } from "./Popover";

// The table's one sort control: "Sort by" plus an optional "Then by", each with
// its direction in words that fit the field (earliest first, A to Z). Choices
// apply as they are made; sorting never hides a row, so there is nothing to
// stage. Sits in the Applications header, visually unlike the page's filter
// pills so the two cannot be mistaken for each other.

const copy = siteContent.recruiting.sort;
const KEYS: SortKey[] = ["status", "applied", "lastEvent", "company", "lane"];

function dirLabels(key: SortKey): Record<SortDir, string> {
  if (key === "status") return { asc: copy.dir.priority, desc: copy.dir.closedFirst };
  if (key === "applied" || key === "lastEvent") return { asc: copy.dir.earliest, desc: copy.dir.latest };
  return { asc: copy.dir.az, desc: copy.dir.za };
}

function isDefault(rules: SortRule[]): boolean {
  return rules.length === 1 && rules[0].key === DEFAULT_SORT[0].key && rules[0].dir === DEFAULT_SORT[0].dir;
}

export function SortMenu({ rules, onChange }: { rules: SortRule[]; onChange: (rules: SortRule[]) => void }) {
  const [primary, secondary] = rules;
  const summary = copy.keys[primary.key] + (secondary ? `, ${copy.keys[secondary.key]}` : "");

  const setPrimary = (key: SortKey) => {
    const next: SortRule = { key, dir: key === primary.key ? primary.dir : DEFAULT_DIR[key] };
    onChange(secondary && secondary.key !== key ? [next, secondary] : [next]);
  };
  const setSecondary = (key: SortKey | null) =>
    onChange(key ? [primary, { key, dir: secondary?.key === key ? secondary.dir : DEFAULT_DIR[key] }] : [primary]);

  return (
    <Menu
      label={copy.heading}
      align="right"
      width={280}
      trigger={({ open, toggle }) => (
        <MenuButton open={open} toggle={toggle} active={false}>
          <ArrowUpDown aria-hidden="true" className="h-4 w-4" />
          <span>
            {copy.button}
            <span className="font-normal text-muted">: {summary}</span>
          </span>
        </MenuButton>
      )}
    >
      {() => (
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3.5">
            <h2 className="font-serif text-xl italic leading-none">{copy.heading}</h2>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_SORT)}
              disabled={isDefault(rules)}
              data-cursor-hover
              className="min-h-[32px] rounded-full px-2 text-[13px] font-medium text-accent disabled:opacity-40"
            >
              {copy.reset}
            </button>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3.5">
            <RuleGroup
              name="sort-by"
              label={copy.by}
              keys={KEYS}
              value={primary.key}
              onPick={(k) => setPrimary(k as SortKey)}
              dir={primary.dir}
              onDir={(dir) => onChange([{ ...primary, dir }, ...(secondary ? [secondary] : [])])}
            />
            <RuleGroup
              name="then-by"
              label={copy.then}
              keys={KEYS.filter((k) => k !== primary.key)}
              value={secondary?.key ?? null}
              onPick={(k) => setSecondary(k as SortKey | null)}
              allowNone
              dir={secondary?.dir}
              onDir={(dir) => secondary && onChange([primary, { ...secondary, dir }])}
            />
          </div>
        </div>
      )}
    </Menu>
  );
}

function RuleGroup({
  name,
  label,
  keys,
  value,
  onPick,
  allowNone = false,
  dir,
  onDir,
}: {
  name: string;
  label: string;
  keys: SortKey[];
  value: SortKey | null;
  onPick: (key: SortKey | null) => void;
  allowNone?: boolean;
  dir?: SortDir;
  onDir: (dir: SortDir) => void;
}) {
  const options: Array<SortKey | null> = allowNone ? [null, ...keys] : keys;
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="mb-1 text-[11px] font-medium uppercase tracking-caps text-muted">{label}</legend>
      {options.map((key) => (
        <label key={key ?? "none"} data-cursor-hover className="flex min-h-[32px] cursor-pointer items-center gap-3 text-sm">
          <input
            type="radio"
            name={name}
            checked={value === key}
            onChange={() => onPick(key)}
            className="h-4 w-4 border-border accent-accent"
          />
          <span className={key ? "text-foreground" : "text-muted"}>{key ? copy.keys[key] : copy.none}</span>
        </label>
      ))}
      {value && dir && (
        <div role="radiogroup" aria-label={`${label}: ${copy.direction}`} className="mt-1.5 flex gap-1 rounded-full border border-border p-0.5">
          {(["asc", "desc"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dir === d}
              onClick={() => onDir(d)}
              data-cursor-hover
              className={`min-h-[30px] flex-1 rounded-full text-[12.5px] font-medium transition-colors duration-200 ${
                dir === d ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {dirLabels(value)[d]}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
