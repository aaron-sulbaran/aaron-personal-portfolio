"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { PHONE_GROUPING } from "@/lib/gallery/constants";
import type { PagerAction } from "@/lib/gallery/pager";
import { partId } from "@/lib/gallery/timing";

// The pager's one row of controls: previous, the page dots, next. Real
// buttons, the ends disabled; they only ever change pages.

type Props = { index: number; count: number; dispatch: (action: PagerAction) => void };

const g = siteContent.modals.gallery;

export function PagerControls({ index, count, dispatch }: Props) {
  const dotLabel = (i: number) => (PHONE_GROUPING === "photo" ? g.photoOf(i + 1, count) : g.pageNumber(i + 1, count));
  return (
    <div data-mask={partId.pager} data-mask-kind="text" className="flex shrink-0 items-center justify-between gap-2" data-pager-controls="">
      <Arrow label={g.previousPage} disabled={index === 0} onClick={() => dispatch({ type: "prev" })} next={false} />
      <div className="flex items-center justify-center">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={dotLabel(i)}
            aria-current={i === index ? "true" : undefined}
            onClick={() => dispatch({ type: "goto", index: i })}
            className="group inline-flex h-8 w-7 items-center justify-center"
            data-pager-dot={i}
          >
            <span className={`block h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-200 ${i === index ? "w-4 bg-accent" : "w-1.5 bg-border group-hover:bg-muted"}`} />
          </button>
        ))}
      </div>
      <Arrow label={g.nextPage} disabled={index >= count - 1} onClick={() => dispatch({ type: "next" })} next />
    </div>
  );
}

function Arrow({ label, disabled, onClick, next }: { label: string; disabled: boolean; onClick: () => void; next: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent disabled:cursor-default disabled:opacity-35 disabled:hover:text-foreground"
      data-pager-arrow={next ? "next" : "prev"}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
