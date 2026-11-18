"use client";

import { useSyncExternalStore } from "react";

// Whether version D's scrim is up. The prompt run writes it; HomeController
// reads it to hold the Coil still while the page is dimmed.
let up = false;
const listeners = new Set<() => void>();

export function spotlightUp(): boolean {
  return up;
}

export function setSpotlightUp(next: boolean): void {
  if (up === next) return;
  up = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSpotlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSpotlightUp(): boolean {
  return useSyncExternalStore(subscribeSpotlight, spotlightUp, () => false);
}
