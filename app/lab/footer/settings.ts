import type { DriftPreset } from "@/lib/coil/drift";
import type { RiseEase } from "./motion";
import { FONT_CANDIDATES, candidateFont } from "./webFont";

// What the footer lab tunes, its ranges, the presets and the export. Lengths
// in "units" are shares of the wordmark's ascender height (the top of the b,
// d, l and f), so a value survives any letter size.

export type Face = "procedural" | "constructed" | "profa" | "font";
export type Ending = "under" | "clip" | "above";
export type Caps = "round" | "butt" | "square";
export type Join = "round" | "miter" | "bevel";
export type Ink = "foreground" | "accent";
// How the word answers the pointer. A typeset face's swell needs a weight
// axis; the waist slice is the path faces' (procedural and constructed).
export type TypeResponse = "swell" | "lean" | "grow" | "none" | "slice";
export type ConnectPlacement = "above" | "below";

export type FooterSettings = {
  face: Face;
  font: {
    family: string; // a Google Fonts family, for the web font face
    weight: number; // its wght at rest
    width: number; // its wdth at rest, when it has a width axis
    round: number; // its ROND, when it has a roundness axis: 0 crisp
    swell: number; // extra wght at the pointer, through the axis
    widthSwell: number; // extra wdth at the pointer, through the axis
  };
  weight: number;
  heightVw: number;
  tracking: number;
  caps: Caps;
  join: Join;
  corners: number; // 0 round bowls, 1 squared: how sharply a bowl meets its stem
  constructed: {
    stem: number; // units: a vertical's thickness (S)
    bar: number; // units: a horizontal's thickness (B)
    roundness: number; // 0 true elliptical bowls, 1 squared superellipses
    gap: number; // units between two straight sides
  };
  aperture: {
    on: boolean; // the period is a shutter of blades meeting at a pivot
    blades: 3 | 4;
    scale: number; // the constructed period's square, in stems
    gap: number; // between the blades, a share of the square
    ease: number; // share of the way the pivot moves toward its target each 60fps frame
  };
  ink: Ink;
  inkFade: number; // how far the ink fades toward the baseline: 0 none, 1 gone
  floor: number; // how the word meets the bottom edge: 0 whole, resting just above it; 0.3 crops 30 percent of the letters' height
  gap: number; // units of space between the row above and the tallest swell
  swellRadius: number; // units
  swellAmount: number; // units of extra weight at the pointer
  swellEaseS: number; // seconds: the swell's time constant
  reflow: boolean; // a swelling letter pushes its neighbors
  pressDepth: number; // share of the height pressed flat at the pointer
  pressStiffness: number;
  pressDamping: number; // damping ratio: under 1 bounces back
  riseMs: number; // 0 turns the rise off
  riseStaggerMs: number; // 0 rises the word as one
  riseEase: RiseEase;
  response: TypeResponse;
  leanDeg: number;
  grow: number; // the typeset stand-in for a weight swell: extra scale at the pointer
  slice: {
    shift: number; // units: how far apart the hovered letter's halves slide
    stiffness: number;
    damping: number; // damping ratio: under 1 overshoots and settles
  };
  field: {
    on: boolean;
    intensity: number; // the field behind the footer: 1 is the hero's, 0 paper, above 1 deeper
    letterIntensity: number; // clip only: the field seen through the letters
    ending: Ending;
    fade: number; // units: the length of the field's last fade
    fadeIn: number; // share of the footer the field takes to rise from paper at the top
    drift: DriftPreset;
    flip: boolean;
    letterTint: number; // clip only: accent laid over the field inside the letters
  };
  connect: ConnectPlacement;
  disc: { on: boolean; lean: number };
};

export const RANGES = {
  weight: { min: 0.04, max: 0.26, step: 0.005 },
  heightVw: { min: 5, max: 24, step: 0.25 },
  tracking: { min: -0.1, max: 0.4, step: 0.005 },
  corners: { min: 0, max: 1, step: 0.01 },
  stem: { min: 0.08, max: 0.32, step: 0.005 },
  bar: { min: 0.06, max: 0.26, step: 0.005 },
  roundness: { min: 0, max: 1, step: 0.01 },
  letterGap: { min: 0, max: 0.3, step: 0.005 },
  apertureScale: { min: 1, max: 1.8, step: 0.01 },
  apertureGap: { min: 0.02, max: 0.2, step: 0.005 },
  apertureEase: { min: 0.02, max: 0.5, step: 0.01 },
  sliceShift: { min: 0.02, max: 0.24, step: 0.005 },
  sliceStiffness: { min: 60, max: 900, step: 10 },
  sliceDamping: { min: 0.15, max: 1.2, step: 0.01 },
  inkFade: { min: 0, max: 1, step: 0.01 },
  floor: { min: 0, max: 0.3, step: 0.01 },
  gap: { min: 0, max: 1.5, step: 0.01 },
  swellRadius: { min: 0.3, max: 4, step: 0.05 },
  swellAmount: { min: 0, max: 0.2, step: 0.005 },
  swellEaseS: { min: 0, max: 0.6, step: 0.01 },
  pressDepth: { min: 0, max: 0.7, step: 0.01 },
  pressStiffness: { min: 60, max: 900, step: 10 },
  pressDamping: { min: 0.15, max: 1.2, step: 0.01 },
  riseMs: { min: 0, max: 2400, step: 20 },
  riseStaggerMs: { min: 0, max: 240, step: 5 },
  leanDeg: { min: 0, max: 20, step: 0.5 },
  grow: { min: 0, max: 0.3, step: 0.01 },
  fontWidth: { min: 25, max: 200, step: 0.5 },
  fontWidthSwell: { min: 0, max: 60, step: 0.5 },
  fontRound: { min: 0, max: 100, step: 1 },
  intensity: { min: 0, max: 2.2, step: 0.05 },
  fade: { min: 0.1, max: 2.5, step: 0.05 },
  fadeIn: { min: 0, max: 0.6, step: 0.01 },
  letterTint: { min: 0, max: 1, step: 0.01 },
  discLean: { min: 0, max: 80, step: 1 },
} as const;

const SEED_FONT = candidateFont(FONT_CANDIDATES[0]);

// Round 1 (2026-10-08). Every round 1 preset now rises as one (Aaron: no
// stagger) and rests whole (the bleed that cut Zephyr's letters is gone; a
// crop is now the floor slider's, chosen on purpose).
const DESIGNER: FooterSettings = {
  face: "procedural",
  font: SEED_FONT,
  weight: 0.15,
  heightVw: 12.5,
  tracking: 0.03,
  caps: "round",
  join: "round",
  corners: 0,
  constructed: { stem: 0.2, bar: 0.15, roundness: 0.35, gap: 0.09 },
  aperture: { on: false, blades: 4, scale: 1.3, gap: 0.08, ease: 0.12 },
  ink: "accent",
  inkFade: 0.25,
  floor: 0,
  gap: 0.35,
  swellRadius: 1.4,
  swellAmount: 0.07,
  swellEaseS: 0.14,
  reflow: true,
  pressDepth: 0.32,
  pressStiffness: 380,
  pressDamping: 0.42,
  riseMs: 1000,
  riseStaggerMs: 0,
  riseEase: "expo",
  response: "lean",
  leanDeg: 7,
  grow: 0.12,
  slice: { shift: 0.08, stiffness: 320, damping: 0.42 },
  field: { on: true, intensity: 1.35, letterIntensity: 1.35, ending: "under", fade: 1.1, fadeIn: 0.3, drift: "visible", flip: false, letterTint: 0.35 },
  connect: "above",
  disc: { on: false, lean: 24 },
};

const BARE: FooterSettings = {
  ...DESIGNER,
  weight: 0.12,
  ink: "foreground",
  inkFade: 0,
  floor: 0,
  swellAmount: 0,
  reflow: false,
  pressDepth: 0,
  riseMs: 0,
  response: "none",
  field: { ...DESIGNER.field, on: false },
};

const ZEPHYR: FooterSettings = {
  ...DESIGNER,
  weight: 0.2,
  heightVw: 12.5,
  tracking: 0,
  inkFade: 0,
  floor: 0,
  field: { ...DESIGNER.field, intensity: 1.8, letterIntensity: 1.8, ending: "clip", fade: 1.4, fadeIn: 0.2, flip: false, letterTint: 0.2 },
};

const PROFA: FooterSettings = {
  ...DESIGNER,
  face: "profa",
  tracking: -0.01,
  heightVw: 11.5,
  inkFade: 0,
  response: "lean",
};

// Round 2 (Aaron's copied values of 2026-10-09 with his notes): Zephyr's
// weight, size and letters, which show the field at Zephyr's depth, over the
// designer's quieter field; whole letters; the word rises as one.
const ROUND2: FooterSettings = {
  ...ZEPHYR,
  swellRadius: 1.8,
  swellAmount: 0.06,
  floor: 0,
  riseStaggerMs: 0,
  response: "swell",
  field: { on: true, intensity: 1.2, letterIntensity: 1.8, ending: "clip", fade: 1.6, fadeIn: 0.3, drift: "visible", flip: false, letterTint: 0.2 },
};

export type Preset = { id: string; name: string; note: string; settings: FooterSettings };

export const PRESETS: readonly Preset[] = [
  {
    id: "round2",
    name: "Round 2, designer field with Zephyr weight",
    note: "Zephyr's heavy letters (0.2 weight, 12.5 percent of the width) as windows onto the field at Zephyr's depth, over a field held back to the designer's quiet. Every letter whole, the word rising as one, the swell and press Aaron kept.",
    settings: ROUND2,
  },
  {
    id: "designer",
    name: "Designer",
    note: "Round 1's pick. Procedural letters in the accent at 0.15 weight, 12.5 percent of the width tall. The field rises from paper and fades out under the letters. A small swell, a soft bouncing press, a one second rise.",
    settings: DESIGNER,
  },
  { id: "bare", name: "Bare", note: "The wordmark in ink on paper. No field, no swell, no press, no rise.", settings: BARE },
  {
    id: "zephyr",
    name: "Zephyr echo",
    note: "Closest to the reference: heavier letters, the field pushed deeper and clipped by the letters, so its glow lights them from the lower left. Round 2 keeps its letters whole (they were cut by the bottom edge).",
    settings: ZEPHYR,
  },
  { id: "profa", name: "Profa lean", note: "Profa Black, leaning toward the pointer, pressed on click. No weight swell is possible.", settings: PROFA },
];

export const DEFAULT_SETTINGS = ROUND2;

export function sameSettings(a: FooterSettings, b: FooterSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type Measured = { sizePx: number; spanPct: number; stageWidth: number; croppedPct: number; fittedVw: number | null };

export function exportValues(s: FooterSettings, preset: string, theme: string, backdrop: string, readout: Measured, drawnWith: string) {
  return {
    preset,
    theme,
    backdrop,
    drawnWith,
    measured: {
      stageWidthPx: Math.round(readout.stageWidth),
      ascenderPx: Math.round(readout.sizePx),
      wordSpansPct: Math.round(readout.spanPct),
      heightHeldToVw: readout.fittedVw === null ? null : +readout.fittedVw.toFixed(2),
      floorCropsPct: Math.round(readout.croppedPct),
    },
    ...s,
  };
}
