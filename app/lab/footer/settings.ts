import type { DriftPreset } from "@/lib/coil/drift";
import type { RiseEase } from "./motion";

// What the footer lab tunes, its ranges, the presets and the export. Lengths
// in "units" are shares of the wordmark's ascender height (the top of the b,
// d, l and f), so a value survives any letter size.

export type Face = "procedural" | "profa";
export type Ending = "under" | "clip" | "above";
export type Caps = "round" | "butt";
export type Ink = "foreground" | "accent";
export type ProfaResponse = "lean" | "grow" | "none";
export type ConnectPlacement = "above" | "below";

export type FooterSettings = {
  face: Face;
  weight: number;
  heightVw: number;
  tracking: number;
  caps: Caps;
  ink: Ink;
  inkFade: number; // how far the ink fades toward the baseline: 0 none, 1 gone
  bleed: number; // units of the word below the footer's bottom edge
  gap: number; // units of space between the row above and the tallest swell
  swellRadius: number; // units
  swellAmount: number; // units of extra weight at the pointer
  swellEaseS: number; // seconds: the swell's time constant
  reflow: boolean; // a swelling letter pushes its neighbors
  pressDepth: number; // share of the height pressed flat at the pointer
  pressStiffness: number;
  pressDamping: number; // damping ratio: under 1 bounces back
  riseMs: number; // 0 turns the rise off
  riseStaggerMs: number;
  riseEase: RiseEase;
  profaResponse: ProfaResponse;
  leanDeg: number;
  grow: number; // the Profa stand-in for a weight swell: extra scale at the pointer
  field: {
    on: boolean;
    intensity: number; // 1 is the hero's field, 0 paper, above 1 deeper
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
  inkFade: { min: 0, max: 1, step: 0.01 },
  bleed: { min: 0, max: 0.4, step: 0.01 },
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
  intensity: { min: 0, max: 2.2, step: 0.05 },
  fade: { min: 0.1, max: 2.5, step: 0.05 },
  fadeIn: { min: 0, max: 0.6, step: 0.01 },
  letterTint: { min: 0, max: 1, step: 0.01 },
  discLean: { min: 0, max: 80, step: 1 },
} as const;

const DESIGNER: FooterSettings = {
  face: "procedural",
  weight: 0.15,
  heightVw: 12.5,
  tracking: 0.03,
  caps: "round",
  ink: "accent",
  inkFade: 0.25,
  bleed: 0.1,
  gap: 0.35,
  swellRadius: 1.4,
  swellAmount: 0.07,
  swellEaseS: 0.14,
  reflow: true,
  pressDepth: 0.32,
  pressStiffness: 380,
  pressDamping: 0.42,
  riseMs: 1000,
  riseStaggerMs: 55,
  riseEase: "expo",
  profaResponse: "lean",
  leanDeg: 7,
  grow: 0.12,
  field: { on: true, intensity: 1.35, ending: "under", fade: 1.1, fadeIn: 0.3, drift: "visible", flip: false, letterTint: 0.35 },
  connect: "above",
  disc: { on: false, lean: 24 },
};

const BARE: FooterSettings = {
  ...DESIGNER,
  weight: 0.12,
  ink: "foreground",
  inkFade: 0,
  bleed: 0,
  swellAmount: 0,
  reflow: false,
  pressDepth: 0,
  riseMs: 0,
  profaResponse: "none",
  field: { ...DESIGNER.field, on: false },
};

const ZEPHYR: FooterSettings = {
  ...DESIGNER,
  weight: 0.2,
  heightVw: 12.5,
  tracking: 0,
  inkFade: 0,
  bleed: 0.22,
  field: { ...DESIGNER.field, intensity: 1.8, ending: "clip", fade: 1.4, fadeIn: 0.2, flip: false, letterTint: 0.2 },
};

const PROFA: FooterSettings = {
  ...DESIGNER,
  face: "profa",
  tracking: -0.01,
  heightVw: 11.5,
  inkFade: 0,
  profaResponse: "lean",
};

export type Preset = { id: string; name: string; note: string; settings: FooterSettings };

export const PRESETS: readonly Preset[] = [
  {
    id: "designer",
    name: "Designer",
    note: "Procedural letters in the accent at 0.15 weight, 12.5 percent of the width tall, sunk a tenth below the edge. The field rises from paper and fades out under the letters. A small swell, a soft bouncing press, a one second rise.",
    settings: DESIGNER,
  },
  { id: "bare", name: "Bare", note: "The wordmark in ink on paper. No field, no swell, no press, no rise.", settings: BARE },
  {
    id: "zephyr",
    name: "Zephyr echo",
    note: "Closest to the reference: heavier letters cut by the bottom edge, the field pushed deeper and clipped by the letters, so its glow lights them from the lower left.",
    settings: ZEPHYR,
  },
  { id: "profa", name: "Profa lean", note: "Option 2: Profa Black, leaning toward the pointer, pressed on click. No weight swell is possible.", settings: PROFA },
];

export const DEFAULT_SETTINGS = DESIGNER;

export function sameSettings(a: FooterSettings, b: FooterSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function exportValues(s: FooterSettings, preset: string, theme: string, backdrop: string, readout: { sizePx: number; spanPct: number; stageWidth: number }) {
  return {
    preset,
    theme,
    backdrop,
    measured: { stageWidthPx: Math.round(readout.stageWidth), ascenderPx: Math.round(readout.sizePx), wordSpansPct: Math.round(readout.spanPct) },
    ...s,
  };
}
