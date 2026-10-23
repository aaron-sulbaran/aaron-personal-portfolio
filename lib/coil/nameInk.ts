import { COIL } from "./constants";

// The name's ink, which of the two the page draws: production's (the pale name
// the live site has) or the stronger one (display type at 3:1 or better against
// the page; the numbers are COIL.lockup.stronger). The hero lab's "Name ink"
// knob chooses (lib/home/introKnobs.ts), default stronger; nothing else does.
export const NAME_INK_MODES = ["production", "stronger"] as const;
export type NameInkMode = (typeof NAME_INK_MODES)[number];

// The composite's gain on the --name-ink token in this mode.
export function nameInkGain(mode: NameInkMode): number {
  return mode === "stronger" ? COIL.lockup.stronger.inkGain : COIL.lockup.inkGain;
}
