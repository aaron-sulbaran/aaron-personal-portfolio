"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type WaveSettings } from "./settings";

// The lab's settings, kept across reloads in localStorage (a per-viewer
// convenience; every read and write is guarded). On load, `?seed=<n>` in the
// URL pins the generated line to that seed; otherwise, with "new line each
// visit" on, the line takes this browser session's seed, made once per
// session and kept in sessionStorage, so a reload, a resize or a theme change
// mid-read never reshuffles it.

const STORE_KEY = "wave-lab-settings-v4";
const SESSION_SEED_KEY = "wave-lab-session-seed-v1";

function merge(stored: Partial<WaveSettings>): WaveSettings {
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    ...stored,
    alpha: { light: { ...d.alpha.light, ...stored.alpha?.light }, dark: { ...d.alpha.dark, ...stored.alpha?.dark } },
    position: { ...d.position, ...stored.position },
    stripHeight: { ...d.stripHeight, ...stored.stripHeight },
    motion: { ...d.motion, ...stored.motion },
    path: { ...d.path, ...stored.path, gen: { ...d.path.gen, ...stored.path?.gen }, rules: { ...d.path.rules, ...stored.path?.rules } },
    cursor: { ...d.cursor, ...stored.cursor, mix: { ...d.cursor.mix, ...stored.cursor?.mix } },
  };
}

// This session's seed: made with Math.random once (outside the generator,
// which never touches it) and kept until the session ends.
export function sessionSeed(): number {
  try {
    const kept = Number(sessionStorage.getItem(SESSION_SEED_KEY));
    if (Number.isInteger(kept) && kept > 0) return kept;
  } catch {
    // Storage blocked: a fresh seed per load is the best that can be done.
  }
  const seed = 1 + Math.floor(Math.random() * 0x7ffffffe);
  try {
    sessionStorage.setItem(SESSION_SEED_KEY, String(seed));
  } catch {
    // As above.
  }
  return seed;
}

export function useLabSettings() {
  const [settings, setSettings] = useState<WaveSettings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  useEffect(() => {
    // After the first paint, so the server render and hydration agree.
    const id = requestAnimationFrame(() => {
      let next = DEFAULT_SETTINGS;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) next = merge(JSON.parse(raw) as Partial<WaveSettings>);
      } catch {
        next = DEFAULT_SETTINGS;
      }
      const param = new URLSearchParams(window.location.search).get("seed");
      const urlSeed = param === null ? NaN : Number(param);
      if (Number.isInteger(urlSeed) && urlSeed >= 0) {
        next = { ...next, placement: "path", path: { ...next.path, spine: "generated", seed: urlSeed } };
      } else if (next.path.newEachVisit) {
        next = { ...next, path: { ...next.path, spine: "generated", seed: sessionSeed() } };
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
