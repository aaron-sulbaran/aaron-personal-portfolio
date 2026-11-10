"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DeckEdge } from "@/lib/card/deck";
import { siteContent, type CardKey } from "@/lib/content";
import type { PagerAction } from "@/lib/gallery/pager";
import type { PhoneGrouping } from "@/lib/gallery/plan";
import { partId } from "@/lib/gallery/timing";

// The pager's one row of controls: previous, the page dots, next. Real
// buttons. Inside the pages they change pages; on the first page the back
// chevron goes to the card before, and on the last the next chevron to the
// card after (Aaron, 2026-11-09: a visitor can chevron through every card),
// each named for that card. A chevron disables only where the deck stops
// (lib/card/deck: once every card has been seen), or at a page end of a modal
// with no deck. A card of one page shows no dots.

type Props = { index: number; count: number; grouping: PhoneGrouping; dispatch: (action: PagerAction) => void; edge?: DeckEdge };

const g = siteContent.modals.gallery;
const d = siteContent.modals.deck;
const named = (key: CardKey) => siteContent.cards[key].short;

export function PagerControls({ index, count, grouping, dispatch, edge }: Props) {
  const dotLabel = (i: number) => (grouping === "photo" ? g.photoOf(i + 1, count) : g.pageNumber(i + 1, count));
  const before = index === 0 ? (edge?.prev ?? null) : null;
  const after = index >= count - 1 ? (edge?.next ?? null) : null;
  return (
    <div data-mask={partId.pager} data-mask-kind="text" className="flex shrink-0 items-center justify-between gap-2" data-pager-controls="">
      <Arrow
        label={before ? d.previousCard(named(before)) : g.previousPage}
        disabled={index === 0 && !before}
        onClick={() => (before ? edge?.step(-1) : dispatch({ type: "prev" }))}
        next={false}
      />
      {/* The dots share the room between the arrows and give way to it, so a card of many pages (the jobs card's ten) never pushes the row past the panel. */}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {count > 1 &&
          Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={dotLabel(i)}
              aria-current={i === index ? "true" : undefined}
              onClick={() => dispatch({ type: "goto", index: i })}
              className="group inline-flex h-8 w-7 min-w-0 shrink items-center justify-center"
              data-pager-dot={i}
            >
              <span className={`block h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-200 ${i === index ? "w-4 bg-accent" : "w-1.5 bg-border group-hover:bg-muted"}`} />
            </button>
          ))}
      </div>
      <Arrow
        label={after ? d.nextCard(named(after)) : g.nextPage}
        disabled={index >= count - 1 && !after}
        onClick={() => (after ? edge?.step(1) : dispatch({ type: "next" }))}
        next
      />
    </div>
  );
}

// A phone card with no pages (its words alone): the same two chevrons under
// everything, each going to the card before or after.
export function CardStepArrows({ edge }: { edge: DeckEdge }) {
  return (
    <div className="flex items-center justify-between gap-2" data-pager-controls="">
      <Arrow label={d.previousCard(edge.prev && named(edge.prev))} disabled={!edge.prev} onClick={() => edge.step(-1)} next={false} />
      <Arrow label={d.nextCard(edge.next && named(edge.next))} disabled={!edge.next} onClick={() => edge.step(1)} next />
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
