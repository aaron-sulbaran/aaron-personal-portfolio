"use client";

import { HINT_OPENED_KEY, hintStore } from "@/lib/cursor/hover";

// The first card ever opened: the memory of the cursor's pill and the hint
// line, under the cursor's once-ever key. The click-a-card prompt does not read
// it (lib/home/clickPrompt.ts, promptDue: a tab with no card opened is due the
// prompt on every visit); the lab's "First visit again" forgets it.
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
