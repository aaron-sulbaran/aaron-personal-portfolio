import { useSyncExternalStore } from "react";
import { getSoundtrackPlayer } from "./audio";

// The single source of truth for the soundtrack choice (spec sections 5 and 7).
// A tiny module-level store rather than a Context provider: the readers are
// spread across the tree and one is an imperative canvas (Waveform) that samples
// the value every animation frame, not a React subtree. The pill and the menu's
// Soundtrack control (Phase 3) both write here; the waveform and the pill glyph
// both read here, so the background and the pill can never disagree.
//
//   before  no choice yet -> idle drift; the band asks, the pill reads "Music?".
//   on      music playing -> reactive wave, the pill's note fills and sways.
//   paused  opted in but audio paused / awaiting input -> thin waiting line,
//           pill drops to a flat line. Holds; does NOT bloom back to idle.
//   off     opted out -> still line in the band;
//           the pill stays as a quiet "Music" capsule, one click from playing.

export type SoundtrackState = "before" | "on" | "paused" | "off";

type Listener = () => void;

const STORAGE_KEY = "aaron-soundtrack";

let state: SoundtrackState = "before";
const listeners = new Set<Listener>();
// What initSoundtrackFromStorage restored this page load, if anything: the
// pill greets a restored opt-in and keeps a restored opt-out quiet.
let restored: SoundtrackState | null = null;
// When startSoundtrack last ran (performance.now() ms), and whether the
// player then reported it stopped inside START_WINDOW_MS: a rejected play()
// or a failed load, not the visitor's own pause. Cleared by the next attempt.
export const START_WINDOW_MS = 4000;
let lastStartAt = Number.NEGATIVE_INFINITY;
let playFailed = false;

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
// returning visitor.
export function initSoundtrackFromStorage(): void {
  // Idempotent: only seed from storage while the choice is still unanswered.
  // Two components call this on mount and the home page can remount on client
  // nav, so re-running once the user is live ("on"/"paused"/"off") would clobber
  // real state, for example reapplying stored "on" as "paused" over a singleton that
  // is still audibly playing.
  if (state !== "before") return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "off") restored = "off";
    // A remembered opt-in restores to the ready/paused player, not autoplay:
    // browsers require a gesture for audio, and a silent "on" would lie (the
    // wave reactive, the glyph bouncing, nothing audible). One tap resumes.
    else if (saved === "on") restored = "paused";
    if (restored) setSoundtrackState(restored);
  } catch {
    /* storage unavailable */
  }
}

export function getRestoredSoundtrack(): SoundtrackState | null {
  return restored;
}

export function getLastStartAt(): number {
  return lastStartAt;
}

// True from a failed start until the next attempt; changes only alongside a
// state change, so subscribeSoundtrack covers it.
export function getPlayFailed(): boolean {
  return playFailed;
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

// Reconciler: the player is the source of truth for AUDIBLE playback, and its
// play() is async (el.play() can reject: autoplay policy, decode error, the
// ended -> next-track autoplay outside any gesture). setSoundtrackState("on")
// is written optimistically in the same gesture, so on rejection the state
// would otherwise stay "on" while nothing plays: equalizer glyph bouncing,
// "Now Playing" label up, silence. This one-way downgrade (never an upgrade;
// "on" is only ever entered through startSoundtrack) keeps the state layer
// honest whenever the player reports it stopped. Attached lazily on the first
// startSoundtrack call so merely importing this module never constructs the
// player.
let reconcilerAttached = false;
function ensureReconciler(): void {
  if (reconcilerAttached) return;
  reconcilerAttached = true;
  const player = getSoundtrackPlayer();
  player.subscribe(() => {
    const s = getSoundtrackState();
    // Downgrade: the player stopped (autoplay reject, error, native pause) while
    // we still claim "on" -> drop to "paused" so nothing shows audible music.
    if (!player.playing && s === "on") {
      playFailed = performance.now() - lastStartAt < START_WINDOW_MS;
      setSoundtrackState("paused");
    // Upgrade: the player resumed on its own (OS media key / lockscreen resume)
    // while we sit at "paused" -> follow it back to "on". Never lifts "off": an
    // opt-out is only re-entered through the menu.
    } else if (player.playing && s === "paused") {
      setSoundtrackState("on");
    }
  });
}

// The three playback writers. Each runs inside a user-gesture handler (pill
// buttons, prompt buttons, menu toggle), which is what lets the audio element
// start under browser autoplay policy. State and playback move together so the
// wave, the pill glyph, and the audible audio can never disagree.
export function startSoundtrack(): void {
  lastStartAt = performance.now();
  playFailed = false;
  ensureReconciler();
  getSoundtrackPlayer().play();
  setSoundtrackState("on");
}

// The visitor's own pause or stop closes the start window, so it never reads
// as a failure.
export function pauseSoundtrack(): void {
  lastStartAt = Number.NEGATIVE_INFINITY;
  getSoundtrackPlayer().pause();
  setSoundtrackState("paused");
}

export function stopSoundtrack(): void {
  lastStartAt = Number.NEGATIVE_INFINITY;
  playFailed = false;
  getSoundtrackPlayer().pause();
  setSoundtrackState("off");
}
