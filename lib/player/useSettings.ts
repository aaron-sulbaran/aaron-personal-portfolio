"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, type PlayerLabSettings } from "./settings";

// The lab's settings in localStorage. Dev only: outside development the hook
// returns the defaults, which are off. A storage event keeps the home tab (or
// the lab's preview frame) and the lab tab in step.

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: PlayerLabSettings } = { raw: null, value: DEFAULT_SETTINGS };

function readRaw(): string | null {
  try {
    return localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

export function readSettings(): PlayerLabSettings {
  if (process.env.NODE_ENV !== "development") return DEFAULT_SETTINGS;
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parseSettings(raw) };
  return cache.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePlayerSettings(): [PlayerLabSettings, (change: (prev: PlayerLabSettings) => PlayerLabSettings) => void] {
  const settings = useSyncExternalStore(subscribe, readSettings, () => DEFAULT_SETTINGS);
  const update = useCallback((change: (prev: PlayerLabSettings) => PlayerLabSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(change(readSettings())));
    } catch {
      return;
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [settings, update];
}
