"use client";

import { siteContent } from "@/lib/content";
import { useCoarsePointer } from "@/components/useCoarsePointer";

// The close hint by pointer type: "Press Esc to close" for a mouse and a
// keyboard, "Tap outside to close" for a touch screen (a coarse primary pointer).
export function useCloseHint() {
  const coarse = useCoarsePointer();
  return coarse ? siteContent.modals.closeHintTouch : siteContent.modals.closeHintKeyboard;
}
