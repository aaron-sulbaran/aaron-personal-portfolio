import type { SoundtrackState } from "@/lib/soundtrack";

// Which of the band's layers are showing (components/soundtrack/BandInvite.tsx), as a
// pure rule so it can be tested:
// the four play choices, one per state, stacked in one grid cell, and Not now
// beside them. The question is not a layer: it shows on every visit.
export type BandLayerName = "before" | "on" | "paused" | "off" | "decline";

// With the player in the band (playerOwns) the player is the feedback, so Pause
// and Resume go, and Not now goes with them: the controls close up. Not now is
// offered wherever the question is still open to a No: before an answer, after a
// Not now (it stays so the question always carries both choices), and while paused.
export function bandLayersShown(music: SoundtrackState, playerOwns: boolean): Record<BandLayerName, boolean> {
  return {
    before: music === "before",
    on: music === "on" && !playerOwns,
    paused: music === "paused" && !playerOwns,
    off: music === "off",
    decline: music === "before" || music === "off" || (music === "paused" && !playerOwns),
  };
}
