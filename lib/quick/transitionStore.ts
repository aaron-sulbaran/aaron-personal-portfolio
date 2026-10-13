"use client";

import { useSyncExternalStore } from "react";
import { IDLE, transitionReducer, type TransitionEvent, type TransitionState } from "./transition";

// The transition's one live state for the page, read by the layer that plays
// it and by anything that waits on it (the lane's mask-in, the invite).

let state: TransitionState = IDLE;
let layers = 0;
const listeners = new Set<() => void>();

export function getTransition(): TransitionState {
  return state;
}

export function dispatchTransition(event: TransitionEvent) {
  const next = transitionReducer(state, event);
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeTransition(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTransitionState(): TransitionState {
  return useSyncExternalStore(subscribeTransition, getTransition, () => IDLE);
}

// The layer registers itself; without one (the holding page) a request is a plain navigation.
export function registerTransitionLayer(): () => void {
  layers += 1;
  return () => {
    layers = Math.max(0, layers - 1);
  };
}

// Every way between the two: the invite, the Menu chip, "See the full site".
export function goTo(to: string) {
  if (layers === 0) {
    window.location.assign(to);
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  dispatchTransition({ type: "go", from: window.location.pathname, to, reduced });
}
