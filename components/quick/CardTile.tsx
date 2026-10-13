import { strandCardByKey } from "@/lib/content";
import { quickRange, type QuickEntry } from "@/lib/content/quick";
import { CardFace } from "@/components/card/CardFace";
import type { OpenCard } from "./types";

// One card as a tile under its year: the Coil's own face (its picture, its
// logo, the site's mark or the jobs card's circles) at 3:4, the book's title,
// the role and years, and the two-line teaser. A button that opens the card's
// modal, as a book row does. Each tile is a checkpoint (data-quick-key): its
// face masks in when the rail reaches it (useCheckpointTrack).

export const tileKey = (entry: QuickEntry) => `card-${entry.id}`;

export function CardTile({ entry, onOpen }: { entry: QuickEntry; onOpen: OpenCard }) {
  const face = strandCardByKey.get(entry.id)?.face;
  return (
    <li data-quick-key={tileKey(entry)} className="group/item relative">
      <span data-quick-anchor="" aria-hidden="true" className="absolute left-0 top-1/2 h-px w-px" />
      <button
        type="button"
        data-card={entry.id}
        aria-haspopup="dialog"
        onClick={(event) => onOpen(entry.id, event.currentTarget)}
        className="group/tile flex w-full items-start gap-4 rounded-2xl p-3 text-left transition-[box-shadow,background-color] duration-200 [box-shadow:inset_0_0_0_1px_var(--color-border)] hover:[box-shadow:inset_0_0_0_1px_var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span data-quick-thumb="" aria-hidden="true" className="relative block aspect-[3/4] w-[60px] shrink-0 overflow-hidden rounded-[10px]">
          <span data-quick-media="" className="absolute inset-0 block">
            {face && <CardFace face={face} />}
          </span>
        </span>
        <span className="flex min-w-0 flex-col pt-0.5">
          <span className="font-display text-[1.375rem] leading-[1.1] text-foreground transition-colors duration-200 group-hover/tile:text-accent">{entry.title}</span>
          <span className="mt-1 font-label text-label text-accent">
            {entry.role}, {quickRange(entry)}
          </span>
          <span className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-snug text-muted">{entry.line}</span>
        </span>
      </button>
    </li>
  );
}
