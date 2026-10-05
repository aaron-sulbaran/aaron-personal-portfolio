"use client";

import { useSyncExternalStore } from "react";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";
import { PRESETS, type Settings } from "./settings";

// The lab's state: B is what the panel edits, A is a pinned copy to flip
// against, `view` says which one the specimens show. It survives a reload in
// this browser only (a convenience; nothing reads it back).
export type LabState = {
  b: Settings;
  a: Settings | null;
  view: "a" | "b";
  collapsed: boolean;
};

// v2: round 2 added settings and made Aaron's pick the default, so round 1's
// stored state is left behind.
const STORAGE_KEY = "lab-type-v2";
const INITIAL: LabState = { b: PRESETS[0].settings, a: null, view: "b", collapsed: false };

let state: LabState = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<LabState>;
      const fill = (settings: Settings) => ({ ...PRESETS[0].settings, ...settings });
      state = { ...INITIAL, ...stored, b: stored.b ? fill(stored.b) : INITIAL.b, a: stored.a ? fill(stored.a) : null };
    }
  } catch {
    /* storage unavailable or stale: start from the recommendation */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  load();
  return state;
}

export function setLab(update: (current: LabState) => LabState) {
  load();
  state = update(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((listener) => listener());
}

// Any edit lands on B, and shows B.
export function editB(update: (b: Settings) => Settings) {
  setLab((s) => ({ ...s, b: update(s.b), view: "b" }));
}

export function flipView() {
  setLab((s) => (s.a ? { ...s, view: s.view === "a" ? "b" : "a" } : s));
}

export function useLab(): LabState {
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL);
}

// The theme is the site's own data-theme on <html>, observed so the site's
// Menu toggle and the lab's agree.
function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "light");
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColorMeta(theme);
}
