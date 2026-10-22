import type { SoundtrackState } from "@/lib/soundtrack";

// When the stock playback pill may show, pure. Before an answer the pill is
// "Music?": a second ask, so it waits until the first one (the prompt in the
// band) has scrolled away unanswered, and never shows while the prompt is on
// screen. After an answer the pill is the way back to the music and follows the
// band as it always did (useBandPassed: the band's bottom edge above the dock line).
export type PillGateInput = {
  music: SoundtrackState;
  bandPassed: boolean; // the band's bottom edge is above the dock line
  promptPassed: boolean; // the prompt's bottom edge is above the dock line
  promptOnScreen: boolean; // any of the prompt is in the viewport
};

export function pillReached({ music, bandPassed, promptPassed, promptOnScreen }: PillGateInput): boolean {
  if (music === "before") return promptPassed && !promptOnScreen;
  return bandPassed;
}
