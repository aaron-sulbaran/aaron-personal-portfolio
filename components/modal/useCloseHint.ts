"use client";

import { useSyncExternalStore } from "react";
import { siteContent } from "@/lib/content";

// The close hint by pointer type: "Press Esc to close" for a mouse and a
// keyboard, "Tap outside to close" for a touch screen (a coarse primary pointer).
const COARSE_POINTER = "(pointer: coarse)";
function subscribePointer(onChange: () => void) {
  const list = window.matchMedia(COARSE_POINTER);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function useCloseHint() {
  const coarse = useSyncExternalStore(subscribePointer, () => window.matchMedia(COARSE_POINTER).matches, () => false);
  return coarse ? siteContent.modals.closeHintTouch : siteContent.modals.closeHintKeyboard;
}
