"use client";

import { useSyncExternalStore } from "react";
import { HINT_OPENED_KEY, hintStore } from "@/lib/cursor/hover";

// The first card ever opened, one memory for the cursor pill, the hint line and
// the click-a-card prompt. It is the cursor's once-ever key, not a second one.
export const CARD_OPENED_KEY = HINT_OPENED_KEY;

export type FirstOpenStore = {
  openedBefore: () => boolean;
  markOpened: () => void;
  forget: () => void;
  subscribe: (listener: () => void) => () => void;
};

export function firstOpenStore(): FirstOpenStore {
  const hint = hintStore();
  return {
    openedBefore: hint.opened,
    markOpened: hint.markOpened,
    forget: hint.forget,
    subscribe: hint.subscribe,
  };
}

// The server snapshot is true, so the server HTML keeps today's hidden prompt.
export function useOpenedBefore(): boolean {
  return useSyncExternalStore(
    (listener) => firstOpenStore().subscribe(listener),
    () => firstOpenStore().openedBefore(),
    () => true,
  );
}
