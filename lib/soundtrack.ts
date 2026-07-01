import { useSyncExternalStore } from "react";

// The single source of truth for the soundtrack choice (spec sections 5 and 7).
// A tiny module-level store rather than a Context provider: the readers are
// spread across the tree and one is an imperative canvas (Waveform) that samples
// the value every animation frame, not a React subtree. The pill and the menu's
// Soundtrack control (Phase 3) both write here; the waveform and the pill glyph
// both read here, so the background and the pill can never disagree.
//
//   before  first scroll into the back half, no choice yet -> idle big drift,
//           the pill carries the "Play the soundtrack" invitation.
//   on      music playing -> reactive wave, pill shows the equalizer.
//   paused  opted in but audio paused / awaiting input -> thin waiting line,
//           pill drops to a flat line. Holds; does NOT bloom back to idle.
//   off     opted out -> idle big drift, NO pill (re-entry via the menu only).

export type SoundtrackState = "before" | "on" | "paused" | "off";

type Listener = () => void;

const STORAGE_KEY = "aaron-soundtrack";

let state: SoundtrackState = "before";
const listeners = new Set<Listener>();

export function getSoundtrackState(): SoundtrackState {
  return state;
}

export function setSoundtrackState(next: SoundtrackState): void {
  if (next === state) return;
  state = next;
  // Persist the coarse opt-in / opt-out so the entry prompt never nags on
  // refresh or revisit; "before" is the un-answered state, so it is not saved.
  try {
    if (next === "off") localStorage.setItem(STORAGE_KEY, "off");
    else if (next === "on" || next === "paused") localStorage.setItem(STORAGE_KEY, "on");
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((listener) => listener());
}

// Restore the remembered choice on client mount, skipping the prompt for a
// returning visitor. NOTE for Phase 4: restoring "on" here resumes the reactive
// visual, but real Spotify playback cannot autostart without a user gesture, so
// the audio wiring should restore an opted-in visitor to a ready/paused player
// (a tap resumes) rather than autoplaying.
export function initSoundtrackFromStorage(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "off") setSoundtrackState("off");
    else if (saved === "on") setSoundtrackState("on");
  } catch {
    /* storage unavailable */
  }
}

export function subscribeSoundtrack(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// React binding for the pill and menu. The server snapshot is the initial
// client state ("before"), so there is no hydration mismatch.
export function useSoundtrack(): SoundtrackState {
  return useSyncExternalStore(subscribeSoundtrack, getSoundtrackState, () => "before");
}
