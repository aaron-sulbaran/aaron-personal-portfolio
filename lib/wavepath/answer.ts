import type { SoundtrackState } from "@/lib/soundtrack";

// What a change of the soundtrack's state is to the wave. A press is the visitor's own answer to the band, live: it is not a restore
// from storage (the head script and initSoundtrackFromStorage move "before" to "paused" or "off" with no press; getRestoredSoundtrack()
// is set before that change notifies), and it is not a pause or a resume.
//   play     "Play it" or the Menu's play: before an answer, or after a Not now. The wave answers with a ripple once the band has
//            scrolled away (lib/wavepath/hold), and the music shapes it.
//   decline  "Not now": from any state to "off". The wave answers at once, in the band, with a gentle swell (SWELL).
export type Press = "play" | "decline";

export function pressOf(from: SoundtrackState, to: SoundtrackState, restored: SoundtrackState | null): Press | null {
  if (from === to) return null;
  if (to === "off") return from === "before" && restored !== null ? null : "decline";
  if (to === "on") return from === "before" ? (restored === null ? "play" : null) : from === "off" ? "play" : null;
  return null;
}

// Whether a press sends the swell: a Not now, unless the wave stands still (reduced motion) or is frozen. A yes sends its ripple
// through the hold, not the swell.
export const swells = (press: Press | null, still: boolean, frozen: boolean): boolean => press === "decline" && !still && !frozen;
