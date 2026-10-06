"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, mergeSettings, type LabSettings } from "./settings";

// The lab's settings, kept across reloads in localStorage (a per-viewer
// convenience; every read and write is guarded, and a blocked store falls
// back to the recommendation).
const STORE_KEY = "sections-lab-settings-v1";

export function useSectionsSettings() {
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  useEffect(() => {
    // After the first paint, so the server render and hydration agree.
    const id = requestAnimationFrame(() => {
      let next = DEFAULT_SETTINGS;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) next = mergeSettings(JSON.parse(raw) as Partial<LabSettings>);
      } catch {
        next = DEFAULT_SETTINGS;
      }
      loaded.current = true;
      setSettings(next);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch {
      // Not stored; the lab still works for this load.
    }
  }, [settings]);

  return [settings, setSettings] as const;
}
