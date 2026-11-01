import type { SoundtrackState } from "@/lib/soundtrack";

// Which of the band's layers are showing (components/soundtrack/BandInvite.tsx), as a
// pure rule so it can be tested:
// the four play choices, one per state, stacked in one grid cell, and Not now
// beside them. The question is not a layer: it shows on every visit.
export type BandLayerName = "before" | "on" | "paused" | "off" | "decline";

// With the player in the band (playerOwns) the player is the feedback, so Pause
// and Resume go, and Not now goes with them: the controls close up. Not now is
// shown wherever the question is still open to a No: before an answer, while
// paused, and after a Not now (it stays so the question always carries both
// choices, but then as the answer: see declineChosen).
export function bandLayersShown(music: SoundtrackState, playerOwns: boolean): Record<BandLayerName, boolean> {
  return {
    before: music === "before",
    on: music === "on" && !playerOwns,
    paused: music === "paused" && !playerOwns,
    off: music === "off",
    decline: music === "before" || music === "off" || (music === "paused" && !playerOwns),
  };
}

// Not now once chosen: after a Not now, this visit or a stored one (the state is "off"). It stays in its place beside Play it, but as
// the answer rather than a button: it cannot be pressed, takes no hover, and reads as the chosen option, quietly (app/globals.css, "Not
// now, once chosen"). Play it stays the invitation. Choosing Play it later moves the answer along with the state, as it always has.
export const declineChosen = (music: SoundtrackState): boolean => music === "off";
