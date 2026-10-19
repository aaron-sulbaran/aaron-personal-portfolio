import { strandCardByKey, type StrandFace } from "@/lib/content";
import { quickSubtitle, type QuickEntry } from "@/lib/content/quick";
import { LaneThumb } from "./LaneThumb";
import type { OpenCard } from "./types";

// One card as a tile under its year: the same portrait beside the words, the
// title, the subtitle and the teaser in full. A logo fits inside that portrait.
// A button that opens the card's modal, as a book row does. Each tile is a
// checkpoint (data-quick-key): its face masks in when the rail reaches it
// (useCheckpointTrack). The button fills its grid cell, so a pair in one year
// shares a height.

export const tileKey = (entry: QuickEntry) => `card-${entry.slot}`;

function tileFace(entry: QuickEntry): StrandFace | undefined {
  if (entry.tileLogo) return { kind: "logo", logo: entry.tileLogo, tile: "plain" };
  return strandCardByKey.get(entry.id)?.face;
}

export function CardTile({ entry, onOpen }: { entry: QuickEntry; onOpen: OpenCard }) {
  const face = tileFace(entry);
  return (
    <li data-quick-key={tileKey(entry)} className="group/item relative flex">
      <span data-quick-anchor="" aria-hidden="true" className="absolute left-0 top-1/2 h-px w-px" />
      <button
        type="button"
        data-card={entry.id}
        data-quick-slot={entry.slot}
        aria-haspopup="dialog"
        onClick={(event) => onOpen(entry.id, event.currentTarget)}
        className="group/tile flex h-full w-full items-start gap-4 rounded-2xl p-3 text-left transition-[box-shadow,background-color] duration-200 [box-shadow:inset_0_0_0_1px_var(--color-border)] hover:[box-shadow:inset_0_0_0_1px_var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-4"
      >
        <LaneThumb face={face} />
        <span className="flex min-w-0 flex-col pt-0.5">
          <span className="font-display text-[1.375rem] leading-[1.1] text-foreground transition-colors duration-200 group-hover/tile:text-accent">{entry.title}</span>
          <span className="mt-1 font-label text-label text-accent">{quickSubtitle(entry)}</span>
          <span className="mt-1.5 text-[0.9375rem] leading-snug text-muted">{entry.line}</span>
        </span>
      </button>
    </li>
  );
}
