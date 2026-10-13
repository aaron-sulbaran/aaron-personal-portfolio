"use client";

import { useMemo, useState } from "react";
import { quickCopy, quickRange, quickSorted, type QuickEntry, type QuickGroup } from "@/lib/content/quick";

export type QuickVariant = "spine" | "ledger" | "glance";

const filters = ["all", "work", "people"] as const;

export function QuickBoard({ variant, entries = quickSorted() }: { variant: QuickVariant; entries?: readonly QuickEntry[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(
    () => entries.filter((entry) => filter === "all" || entry.group === filter),
    [entries, filter],
  );

  return (
    <div>
      <div className="mb-10 flex flex-wrap gap-2" role="group" aria-label="Filter">
        {filters.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 font-label text-label ${filter === key ? "bg-accent text-background" : "text-muted shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
          >
            {quickCopy.filters[key]}
          </button>
        ))}
      </div>
      {variant === "ledger" && <Ledger entries={shown} />}
      {variant === "spine" && <Spine entries={shown} />}
      {variant === "glance" && <Glance entries={shown} open={open} onOpen={setOpen} />}
    </div>
  );
}

function EntryBody({ entry }: { entry: QuickEntry }) {
  return (
    <>
      <p className="font-label text-label text-muted">{entry.role}</p>
      <h3 className="font-display text-2xl text-foreground">{entry.org}</h3>
      <p className="mt-2 max-w-xl text-foreground">{entry.line}</p>
      <ul className="mt-3 list-disc pl-5 text-muted">
        {entry.outcomes.map((outcome) => (
          <li key={outcome}>{outcome}</li>
        ))}
      </ul>
    </>
  );
}

function Ledger({ entries }: { entries: readonly QuickEntry[] }) {
  const years = [...new Set(entries.map((entry) => entry.start.slice(0, 4)))];
  return (
    <div className="flex flex-col gap-16">
      {years.map((year) => (
        <div key={year} className="grid gap-6 md:grid-cols-[7rem_1fr]">
          <h2 className="font-display text-section text-foreground md:sticky md:top-24">{year}</h2>
          <ol className="flex flex-col gap-10">
            {entries.filter((entry) => entry.start.slice(0, 4) === year).map((entry) => (
              <li key={entry.id} className="border-t border-border pt-6">
                <p className="font-label text-label text-accent">{quickRange(entry)}</p>
                <EntryBody entry={entry} />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Spine({ entries }: { entries: readonly QuickEntry[] }) {
  return (
    <ol className="relative mx-auto max-w-3xl">
      <span aria-hidden="true" className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-border" />
      {entries.map((entry, i) => (
        <li key={entry.id} className={`relative py-8 md:w-1/2 ${i % 2 === 0 ? "md:pr-10" : "md:ml-auto md:pl-10"}`}>
          <span aria-hidden="true" className="absolute left-1/2 top-12 hidden h-2 w-2 -translate-x-1/2 rounded-full bg-accent md:block" />
          <p className="font-label text-label text-accent">{quickRange(entry)}</p>
          <EntryBody entry={entry} />
        </li>
      ))}
    </ol>
  );
}

function Glance({ entries, open, onOpen }: { entries: readonly QuickEntry[]; open: string | null; onOpen: (id: string | null) => void }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {entries.map((entry) => {
        const expanded = open === entry.id;
        return (
          <li key={entry.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onOpen(expanded ? null : entry.id)}
              className="w-full rounded-2xl border border-border p-5 text-left"
            >
              <p className="font-label text-label text-accent">{quickRange(entry)}</p>
              <span className="mt-1 block font-display text-2xl text-foreground">{entry.org}</span>
              <span className="mt-1 block font-label text-label text-muted">{entry.role}</span>
              {expanded && (
                <span className="mt-4 block">
                  <span className="block text-foreground">{entry.line}</span>
                  <span className="mt-2 block text-muted">{entry.outcomes.join(" ")}</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function groupLabel(group: QuickGroup): string {
  return group === "work" ? quickCopy.filters.work : quickCopy.filters.people;
}
