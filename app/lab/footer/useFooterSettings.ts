"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type FooterSettings } from "./settings";

// The lab's settings, kept across reloads in localStorage (a per-viewer
// convenience, every read and write guarded), loaded after the first paint
// so the server render and hydration agree. Bump the key when the shape
// changes.
const STORE_KEY = "footer-lab-settings-v3";

function merge(stored: Partial<FooterSettings>): FooterSettings {
  const d = DEFAULT_SETTINGS;
  return { ...d, ...stored, font: { ...d.font, ...stored.font }, field: { ...d.field, ...stored.field }, disc: { ...d.disc, ...stored.disc } };
}

export function useFooterSettings() {
  const [settings, setSettings] = useState<FooterSettings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let next = DEFAULT_SETTINGS;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) next = merge(JSON.parse(raw) as Partial<FooterSettings>);
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
