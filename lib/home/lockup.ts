import { COIL } from "@/lib/coil/constants";
import { NAME_ADVANCE_EM } from "@/lib/home/nameFlip";

// The "Hi, I'm" over "Aaron" lockup as CSS (the h1's and the loader's: one
// markup at two sizes, so the shrink is a uniform scale). The proportions are
// COIL.lockup's, Aaron's picks for the name drawn behind the old Coil: the
// greeting's cap height is greetingCap of the name's, its lowest ink sits
// greetingGap of its own cap height above the "A", and it leans greetingShift
// of the name's size to the right of the name's ink. The face's metrics are
// Profa Black's in Chromium (measured 2026-10-06, per em).

const L = COIL.lockup;

export const PROFA = {
  capR: 0.63636, // cap height
  base: 0.75, // the baseline's place under a line-height 1 box
  gAsc: 0.68727, // "Hi, I'm"'s ascent
  gDesc: 0.11909, // and its descent
} as const;

// Everything below is in em of the name's font size (the lockup's --lk).
export function lockupEm() {
  const greet = L.greetingCap; // the greeting's font size
  // The greeting's line box is `greet` tall (line-height 1); its lowest ink
  // sits gDesc below its baseline and the box ends (1 - base) of it below the
  // baseline. The name's cap top is (base - capR) under its line's top.
  const nameTopSpace = PROFA.base - PROFA.capR;
  const wanted = greet * PROFA.capR * L.greetingGap; // gap from the greeting's lowest ink to the cap top
  const natural = greet * (1 - PROFA.base - PROFA.gDesc) + nameTopSpace;
  const pull = wanted - natural;
  const bottomTrim = 1 - PROFA.base; // the line's room under the baseline, trimmed so the box ends at the letters
  return { greet, pull, nameTopSpace, bottomTrim, shift: L.greetingShift, width: NAME_ADVANCE_EM, height: greet + pull + 1 - bottomTrim };
}

// The lockup's custom properties, for the section that holds the heading and
// the loader's root. --lk (the name's font size) is set where it is used.
export function lockupVars(): Record<string, string> {
  const m = lockupEm();
  const px = (x: number) => x.toFixed(5);
  return {
    "--lk-greet": px(m.greet),
    "--lk-pull": px(m.pull),
    "--lk-bottom-trim": px(m.bottomTrim),
    "--lk-shift": px(m.shift),
    "--lk-cap-top": px(m.nameTopSpace),
    "--lk-cap": px(PROFA.capR),
  };
}
