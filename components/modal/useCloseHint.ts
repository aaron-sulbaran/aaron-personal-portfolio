"use client";

import { siteContent } from "@/lib/content";
import { useCoarsePointer } from "@/components/useCoarsePointer";

// The close hint by pointer type: "Press Esc to close" for a mouse and a
// keyboard, "Tap outside to close" for a touch screen (a coarse primary pointer).
// Both are true of every modal: a press outside the panel closes it for any
// pointer (components/modal/useOutsidePress), and Escape for any keyboard.
export function useCloseHint() {
  const coarse = useCoarsePointer();
  return coarse ? siteContent.modals.closeHintTouch : siteContent.modals.closeHintKeyboard;
}
