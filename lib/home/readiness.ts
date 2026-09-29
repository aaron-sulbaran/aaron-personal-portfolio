"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

// The home hero's readiness, as one explicit signal instead of a first-match
// document.querySelector("[data-state]") read (any earlier element carrying a
// data-state attribute would have hijacked that). A tiny external store:
//
//   pre       the hero has not started (SSR, first paint, the loader)
//   entering  the entrance is playing; scroll is locked
//   ready     settled and interactive
//
// Exactly one hero owns the store at a time (the Coil's HomeController, or
// TileRing behind the ring flag). The owner claims it before paint and
// publishes each phase; the phase is mirrored as data-home on <html> so CSS
// and QA can read it. Pages without a hero never claim it, so consumers such
// as SiteNav treat them as ready and never wait (whenHomeReady).
export type HomeReadiness = "pre" | "entering" | "ready";

let phase: HomeReadiness = "pre";
let owners = 0;
const listeners = new Set<() => void>();

function mirror() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (owners > 0) root.setAttribute("data-home", phase);
  else root.removeAttribute("data-home");
}

function emit() {
  mirror();
  listeners.forEach((listener) => listener());
}

export function getHomeReadiness(): HomeReadiness {
  return phase;
}

export function hasHomeHero(): boolean {
  return owners > 0;
}

export function subscribeHomeReadiness(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Registers a hero as the store's owner. The release resets the phase to
// "pre" once the last owner leaves (a client navigation away from home), so a
// return visit starts clean.
export function claimHomeReadiness(): () => void {
  owners += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners = Math.max(0, owners - 1);
    if (owners === 0) phase = "pre";
    emit();
  };
}

export function publishHomeReadiness(next: HomeReadiness) {
  if (phase === next) return;
  phase = next;
  emit();
}

// Runs `onReady` once the hero is ready: immediately when it already is or
// when the page has no hero at all, otherwise on the first "ready" publish.
// Returns a cancel function for effect cleanup.
export function whenHomeReady(onReady: () => void): () => void {
  if (owners === 0 || phase === "ready") {
    onReady();
    return () => {};
  }
  const unsubscribe = subscribeHomeReadiness(() => {
    if (owners === 0 || phase === "ready") {
      unsubscribe();
      onReady();
    }
  });
  return unsubscribe;
}

const serverSnapshot = (): HomeReadiness => "pre";

export function useHomeReadiness(): HomeReadiness {
  return useSyncExternalStore(subscribeHomeReadiness, getHomeReadiness, serverSnapshot);
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// For a hero that tracks its phase in React state (TileRing): claims the store
// before paint on mount and publishes every phase change before paint, so
// passive effects elsewhere (SiteNav) already see the owner.
export function useHomeReadinessPublisher(current: HomeReadiness) {
  useIsoLayoutEffect(() => claimHomeReadiness(), []);
  useIsoLayoutEffect(() => {
    publishHomeReadiness(current);
  }, [current]);
}
