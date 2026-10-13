"use client";

import { useMemo, useState } from "react";
import { quickCopy, quickEntries, quickSigns } from "@/lib/content/quick";
import { QUICK_FILTERS, quickItems, type QuickFilter, type QuickOrder } from "@/lib/quick/items";
import type { QuickVariant } from "@/lib/quick/settings";
import { RailVariant } from "./RailVariant";
import { RoadVariant } from "./RoadVariant";
import { SpineVariant } from "./SpineVariant";

// The quick page below its header: the filters, then the list in the chosen
// variant. A new list (variant, order, filter or a replay) is a new road, so the
// variant remounts and its one-way checkpoints start again.

const VARIANTS = { spine: SpineVariant, rail: RailVariant, road: RoadVariant } as const;

type Props = { variant: QuickVariant; order: QuickOrder; speed: number; forceReduced: boolean; replay: number };

export function QuickBoard({ variant, order, speed, forceReduced, replay }: Props) {
  const [filter, setFilter] = useState<QuickFilter>("all");
  const items = useMemo(() => quickItems(quickEntries, quickSigns, { order, filter }), [order, filter]);
  const runKey = `${variant}:${order}:${filter}:${replay}`;
  const Variant = VARIANTS[variant];

  return (
    <div>
      <div className="mb-14 flex flex-wrap gap-2" role="group" aria-label={quickCopy.filterLabel}>
        {QUICK_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 font-label text-label transition-colors ${filter === key ? "bg-accent text-background" : "text-muted ring-1 ring-inset ring-border hover:text-foreground"}`}
          >
            {quickCopy.filters[key]}
          </button>
        ))}
      </div>
      <Variant key={runKey} items={items} runKey={runKey} speed={speed} forceReduced={forceReduced} />
    </div>
  );
}
