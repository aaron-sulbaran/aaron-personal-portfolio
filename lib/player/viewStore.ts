"use client";

import { useSyncExternalStore } from "react";
import { CLOSED, step, type MachineConfig, type PlayerEvent, type PlayerState, type PlayerView } from "./machine";

// The player's view as a tiny module store, like lib/soundtrack.ts: the host
// (components/player/SoundtrackPlayer) is the one writer, and the band's card,
// the band's copy and the stock pill read it, so all of them change in the
// same commit.

let state: PlayerState = CLOSED;
const listeners = new Set<() => void>();

export const getPlayerView = (): PlayerView => state.view;

export function sendPlayer(event: PlayerEvent, config: MachineConfig): void {
  const next = step(state, event, config);
  if (next.view === state.view) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export const subscribePlayer = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePlayerView = (): PlayerView => useSyncExternalStore(subscribePlayer, getPlayerView, () => "closed");
