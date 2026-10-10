import { COIL } from "@/lib/coil/constants";
import { DEFAULT_DRIFT } from "@/lib/coil/drift";

// Every footer value (slice C6), from the footer lab's committed preset
// "Round 4, Aaron's pick" (branch lab, app/lab/footer/settings.ts at commit
// 22d3b4f), which Aaron signed off on 2026-10-09 (docs/lab-log-2026-10-05.md,
// "Footer lab"). Lengths in units are shares of the wordmark's ascender
// height (the top of the b, d, l and f), so a value survives any letter size.
// A pick changes here and nowhere else; never retune by eye in a component.
export const FOOTER = {
  // The constructed face: the stem (a vertical's thickness) and the bar (a
  // horizontal's) set the weight; roundness 0 is a true ellipse, 1 a square.
  face: { stem: 0.235, bar: 0.18, roundness: 0.45, gap: 0.095 },
  tracking: 0,
  heightVw: 14.5, // the asked ascender height, percent of the footer's width
  fitShare: 0.92, // the widest the word may sit at rest, a share of the width
  gap: 0.35, // units over the tallest swell's top, inside the word's band
  bottomClear: 0.05, // units from the baseline to the footer's bottom edge (floor 0)
  swell: { radius: 1.8, amount: 0.06, easeS: 0.14 }, // units, units of stem, seconds
  press: { depth: 0.32, stiffness: 380, damping: 0.42 }, // share of the height; a unit-mass spring; damping ratio
  // The rise out of the baseline: the word as one (no stagger), expo, the
  // first time `seenShare` of the footer is in view. It starts `under` units
  // plus `extraPx` below its place and is cut `floor` units under the baseline.
  rise: { ms: 1000, seenShare: 0.3, under: 0.06, extraPx: 4, floor: 0.04 },
  letterTint: 0.2, // the accent laid over the field inside the letters
  field: {
    behind: 1.2, // the field's depth behind the footer (1 is the hero's, 0 paper)
    letters: 1.8, // its depth seen through the letters
    fade: 1.6, // units: the field's last fade, ending at the word's top
    fadeIn: 0.3, // share of the footer's height the field takes to rise from paper
    drift: DEFAULT_DRIFT, // the hero's own drift, as the lab's hero backdrop ran it
    surfacePad: COIL.lockup.pad, // of the size: the word's rect for the name's surface, padded as the hero pads its lockup
    bandLeadPx: 2, // the letters' band (and the paper cover) starts this far over the word's top
    dprCap: { fine: 1.75, coarse: 2 },
    nearMargin: "0px 0px 100% 0px", // the field's chunk is asked for one viewport height ahead
  },
  // The hero's lockup rect (the name surface's target) per px of the hero's
  // width, measured on the running hero (merged main, 2026-10-09: 1022 by 334
  // at 1440 wide, 758 by 248 at 1068, 356 by 116 at 390), so the footer's
  // surface folds are the hero's size in px.
  heroLockup: { wide: 0.2319, narrow: 0.2982 },
  // The period's Easter egg. Times in ms; hop in units; ripple speed in units
  // per second; ripple decay per second.
  egg: {
    anticipationMs: 110,
    hop: 0.42,
    airMs: 520,
    turnDeg: 90,
    overshootDeg: 7,
    squash: 0.28,
    shadow: 0.34,
    rippleSpeed: 5,
    rippleLetters: 0.3,
    rippleField: 0.22,
    rippleDecay: 1.2,
  },
  poster: { width: 480, driftS: 22 }, // the stand-in's canvas width (px) and its CSS drift period
  hitPx: { min: 44, pad: 12 }, // the period button: its side plus the pad, at least the minimum
  bleedPx: 16, // the paper cover and its mask run past the stage's edges
} as const;

// The egg's shape as numbers (the preset's literal values widened), so a
// test can vary one.
export type EggShape = { readonly [K in keyof typeof FOOTER.egg]: number };
