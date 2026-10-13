"use client";

import { useCallback, useState } from "react";
import type { CardKey } from "@/lib/content/types";
import { markSeen } from "@/lib/home/seen";
import { CardModal } from "@/components/card/CardModal";

// The card modal on the Express lane: the same CardModal the Coil and the book
// open, with no flight (the modal draws its own card). As the home controller
// does, a card counts as seen at close and focus returns to the tile next
// frame, without scrolling the page.

export function useQuickModal() {
  const [selection, setSelection] = useState<{ key: CardKey; origin: HTMLElement } | null>(null);
  const open = useCallback((key: CardKey, origin: HTMLElement) => setSelection((current) => current ?? { key, origin }), []);
  const close = useCallback(() => {
    if (!selection) return;
    markSeen(selection.key);
    const { origin } = selection;
    setSelection(null);
    requestAnimationFrame(() => {
      if (origin.isConnected) origin.focus({ preventScroll: true });
    });
  }, [selection]);
  const modal = <CardModal cardKey={selection?.key ?? null} onClose={close} renderMedia flying={false} />;
  return { open, modal };
}
