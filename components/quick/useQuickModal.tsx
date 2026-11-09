"use client";

import { useCallback, useState } from "react";
import type { CardKey } from "@/lib/content/types";
import type { CardDeck } from "@/lib/card/deck";
import { markSeen } from "@/lib/home/seen";
import { CardModal } from "@/components/card/CardModal";

// The card modal on the Express lane: the same CardModal the Coil and the book
// open, with no flight (the modal draws its own card). As the home controller
// does, a card counts as seen at close and focus returns to the tile next
// frame, without scrolling the page. A step to the card before or after (deck,
// the lane's tiles top to bottom) counts the card left as seen at once, and
// focus then returns to the first tile of the card the visitor ended on.

const tileOf = (key: CardKey) => document.querySelector<HTMLElement>(`button[data-quick-slot][data-card="${key}"]`);

export function useQuickModal(deck: CardDeck) {
  const [selection, setSelection] = useState<{ key: CardKey; origin: HTMLElement | null } | null>(null);
  const open = useCallback((key: CardKey, origin: HTMLElement) => setSelection((current) => current ?? { key, origin }), []);
  const close = useCallback(() => {
    if (!selection) return;
    markSeen(selection.key);
    const { origin } = selection;
    setSelection(null);
    requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    });
  }, [selection]);
  const step = useCallback(
    (key: CardKey) => {
      if (!selection || key === selection.key) return;
      markSeen(selection.key);
      setSelection({ key, origin: tileOf(key) });
    },
    [selection],
  );
  const returnFocus = useCallback(() => selection?.origin ?? null, [selection]);
  const modal = <CardModal cardKey={selection?.key ?? null} onClose={close} renderMedia flying={false} returnFocus={returnFocus} deck={deck} onStep={step} />;
  return { open, modal };
}
