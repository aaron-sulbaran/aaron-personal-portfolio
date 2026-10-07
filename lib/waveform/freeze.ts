import { useSyncExternalStore } from "react";

// The visitor's "Freeze the wave", one flag for the whole wave: the band's
// canvas forwards it to the conductor, so the whole wave stops.
// Written by the player card (and the band's own toggle on phones). Not
// persisted: a reload lets the wave move again.
let frozen = false;
const listeners = new Set<() => void>();

export function getFrozen(): boolean {
  return frozen;
}

export function setFrozen(next: boolean): void {
  if (next === frozen) return;
  frozen = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFrozen(): boolean {
  return useSyncExternalStore(subscribe, getFrozen, () => false);
}
