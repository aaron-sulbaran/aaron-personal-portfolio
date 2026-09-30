"use client";

import { useSyncExternalStore } from "react";

// Which cards the visitor has opened this visit, keyed by home tile key, in
// sessionStorage ("aaron-explored-tiles", the key the retired ring used, so a
// visitor mid-visit keeps their marks across the switch). One store serves both
// Coil drivers and the book: the scene reads getSeen() per frame without a
// React render, and components subscribe through useSeen / useIsSeen.
//
// The snapshot starts empty on the server and on the first client render
// (useSyncExternalStore's server snapshot), so hydration always matches; the
// stored set is read lazily on the first client access.
export const SEEN_STORAGE_KEY = "aaron-explored-tiles";

const EMPTY: ReadonlySet<string> = new Set();

let snapshot: ReadonlySet<string> = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function hydrate() {
  if (hydrated) return;
  const store = storage();
  if (!store) return;
  hydrated = true;
  try {
    const raw = store.getItem(SEEN_STORAGE_KEY);
    const keys: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(keys)) {
      snapshot = new Set(keys.filter((key): key is string => typeof key === "string"));
    }
  } catch {
    // Corrupt or blocked storage: start empty.
  }
}

export function getSeen(): ReadonlySet<string> {
  hydrate();
  return snapshot;
}

export function isSeen(key: string): boolean {
  return getSeen().has(key);
}

export function markSeen(key: string) {
  hydrate();
  if (snapshot.has(key)) return;
  const next = new Set(snapshot);
  next.add(key);
  snapshot = next;
  try {
    storage()?.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(next)));
  } catch {
    // Private mode or disabled storage: seen lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverSeen = (): ReadonlySet<string> => EMPTY;

export function useSeen(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeSeen, getSeen, serverSeen);
}

const serverIsSeen = () => false;

export function useIsSeen(key: string): boolean {
  return useSyncExternalStore(subscribeSeen, () => isSeen(key), serverIsSeen);
}
