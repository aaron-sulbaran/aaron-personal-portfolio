import { siteContent, strandCardByKey, type CardKey } from "@/lib/content";
import { headerMeta, headerTileOf } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { CardFace } from "./CardFace";

// The header at the top left: the card's face in a 3:4 tile (where its flown
// card lands; with no flight the modal draws the face), then the title and the
// meta line beside it (lib/gallery/card headerMeta). Beside the rows a photo
// card has no tile (its flown card lands on the card picture in the first row);
// on a phone every card has one, because the phone header stays put while the
// pages turn, so no page can carry a parked flown card off the panel. A phone's
// header is tighter, clear of the close button.
export function CardHeader({ cardKey, renderMedia, compact }: { cardKey: CardKey; renderMedia: boolean; compact: boolean }) {
  const card = strandCardByKey.get(cardKey);
  const tile = headerTileOf(cardKey, compact);
  return (
    <div className={`flex items-center pr-12 ${compact ? "gap-4" : "gap-5"}`}>
      {card && (compact || card.face.kind !== "photo") && (
        <div data-tile-slot={card.kind} aria-hidden="true" className="relative shrink-0" style={{ width: tile.width, height: tile.height }}>
          {renderMedia && <CardFace face={card.face} />}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 data-mask={partId.title} data-mask-kind="text" data-mask-split="" className={`font-display leading-tight text-foreground ${compact ? "text-[1.75rem]" : "text-4xl"}`}>
          {siteContent.cards[cardKey].modal.title}
        </h2>
        <p data-mask={partId.meta} data-mask-kind="text" data-mask-split="" className="font-label text-label text-accent">
          <InlineCopy source={headerMeta(cardKey, compact)} />
        </p>
      </div>
    </div>
  );
}
