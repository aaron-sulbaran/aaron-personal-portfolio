"use client";

import { siteContent, type CardKey } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";
import { summonMarkCard } from "@/lib/mark/summon";

// A card's easter egg line (This site: "I've hidden a few easter eggs on this
// site." and a link-styled "Show me one"), standing alone after the paragraphs.
// The control closes the card and asks for the logo's easter egg
// (lib/mark/summon), which then plays as it does for a hold, so the egg is the
// logo's own and a reader who never found it sees it: the logo's charge and
// strike, then its card. It is a button drawn as the card's links are (the
// inline link's line and fill, in the label face), with no inline layer behind
// it. Focus goes back to where the card was opened (the modal's own return) and
// the egg's card returns it there in turn. Nothing when the card has no line.
export function CardEgg({ cardKey, onClose }: { cardKey: CardKey; onClose: () => void }) {
  const egg = siteContent.cards[cardKey].modal.easterEgg;
  if (!egg) return null;
  return (
    <p data-mask={partId.egg} data-mask-kind="text" className="font-label text-label text-muted">
      {egg.line}{" "}
      <span className="text-accent">
        <button
          type="button"
          className="inline-link card-link"
          onClick={() => {
            summonMarkCard();
            onClose();
          }}
        >
          {egg.control}
        </button>
      </span>
    </p>
  );
}
