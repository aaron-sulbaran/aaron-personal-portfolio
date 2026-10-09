"use client";

import { CARDS, drawnShape, type LabCard } from "./cards";
import { groupingOf } from "./cardSteps";
import type { Settings } from "./settings";

// What the grouping rule made of every card under the current settings, so
// Aaron can see which photos stand still and which take turns. The open card
// reads its shape overrides; the others their real shapes.

type Props = { s: Settings; card: LabCard; shapes: number[]; onPick: (id: string) => void };

export function GroupingList({ s, card, shapes, onPick }: Props) {
  return (
    <details open className="flex flex-col gap-2" data-grouping-list="">
      <summary className="cursor-pointer text-foreground">{s.extras === "rotate" ? "Grouping per card (the rounds 5 and 6 rule)" : "Rows per card (round 4)"}</summary>
      <div className="mt-2 flex flex-col gap-2.5">
        {CARDS.map((c) => {
          const aspects = c.photos.map((_, i) => drawnShape(c, i, c.id === card.id ? shapes[i] : undefined));
          const grouping = groupingOf(c, aspects, s);
          const open = c.id === card.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              aria-pressed={open}
              className={`flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-left leading-snug ${open ? "shadow-[inset_0_0_0_1px_var(--color-accent)]" : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:shadow-[inset_0_0_0_1px_var(--color-muted)]"}`}
              data-grouping={c.id}
            >
              <span className="font-semibold text-foreground">{c.name}</span>
              <span className="text-muted">{grouping.summary}</span>
              {grouping.rows.map((row) => (
                <span key={row} className="text-foreground">
                  {row}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </details>
  );
}
