// What the gallery lab tunes (modal-gallery.md, "What the lab tunes"), the
// presets, and what "Copy values" puts on the clipboard. Lengths are px at
// 1x, times are ms unless named seconds.

import { maskTable, type MaskStep } from "./timing";

export type TextSplit = "lines" | "block";
export type PhotoMask = "wipe" | "rise";
export type EaseKey = "site" | "power3";
export type TextAlign = "center" | "start";

export interface Settings {
  // Desktop
  panelWidth: number;
  photoWidth: number;
  rowGap: number;
  columnGap: number;
  textAlign: TextAlign;
  extrasPerRow: number;
  // Phone
  stageMaxHeight: number; // percent of the visible height
  autoAdvance: number; // seconds, 0 is off
  crossfadeMs: number;
  // Masking in
  landingMs: number;
  maskMs: number;
  staggerMs: number;
  textSplit: TextSplit;
  lineStaggerMs: number;
  photoMask: PhotoMask;
  settle: number; // percent the photo starts over 100
  ease: EaseKey;
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const RANGES = {
  panelWidth: { min: 840, max: 1040, step: 8 },
  photoWidth: { min: 300, max: 440, step: 4 },
  rowGap: { min: 24, max: 160, step: 4 },
  columnGap: { min: 24, max: 96, step: 4 },
  extrasPerRow: { min: 1, max: 2, step: 1 },
  stageMaxHeight: { min: 45, max: 65, step: 1 },
  autoAdvance: { min: 0, max: 6, step: 0.5 },
  crossfadeMs: { min: 120, max: 800, step: 20 },
  landingMs: { min: 0, max: 800, step: 20 },
  maskMs: { min: 250, max: 900, step: 10 },
  staggerMs: { min: 60, max: 220, step: 5 },
  lineStaggerMs: { min: 0, max: 120, step: 5 },
  settle: { min: 0, max: 4, step: 0.25 },
} satisfies Partial<Record<keyof Settings, Range>>;

export const EASES: Record<EaseKey, { name: string; gsap: string; css: string }> = {
  site: { name: "Site ease (lib/motion EASE)", gsap: "site", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
  power3: { name: "Sections grammar (power3.out)", gsap: "power3.out", css: "power3.out" },
};

export const SPLIT_LABELS: Record<TextSplit, string> = { lines: "By line, as the sections", block: "Whole block" };
export const PHOTO_MASK_LABELS: Record<PhotoMask, string> = { wipe: "Wipe up (the edge rises)", rise: "Rise (as a text line)" };
export const ALIGN_LABELS: Record<TextAlign, string> = { center: "Middle of the photo", start: "Top of the photo" };

// The brief's numbers, nothing added: block masks, no settle.
const BARE: Settings = {
  panelWidth: 912,
  photoWidth: 320,
  rowGap: 64,
  columnGap: 48,
  textAlign: "start",
  extrasPerRow: 2,
  stageMaxHeight: 55,
  autoAdvance: 4,
  crossfadeMs: 400,
  landingMs: 520,
  maskMs: 450,
  staggerMs: 120,
  textSplit: "block",
  lineStaggerMs: 0,
  photoMask: "wipe",
  settle: 0,
  ease: "site",
};

// My pick: a wider panel and photo so the first row owns the fold at 1440,
// text centred on its photo so a one-line hackathon row does not float at the
// top, lines masked as the sections mask them, and a 2 percent settle so the
// wipe lands rather than stops.
const RECOMMENDED: Settings = {
  panelWidth: 944,
  photoWidth: 372,
  rowGap: 88,
  columnGap: 56,
  textAlign: "center",
  extrasPerRow: 2,
  stageMaxHeight: 55,
  autoAdvance: 4,
  crossfadeMs: 420,
  landingMs: 520,
  maskMs: 480,
  staggerMs: 110,
  textSplit: "lines",
  lineStaggerMs: 45,
  photoMask: "wipe",
  settle: 2,
  ease: "site",
};

export const PRESETS: readonly { id: string; name: string; note: string; settings: Settings }[] = [
  {
    id: "recommended",
    name: "Recommended",
    note: "A 944px panel with 372px photos, text centred on its photo, lines masked as the sections mask them, a 2 percent settle on each wipe. Capital One is whole about 1.5 seconds after the landing.",
    settings: RECOMMENDED,
  },
  {
    id: "bare",
    name: "Bare default",
    note: "The brief's numbers and nothing more: 320px photos, whole-block masks of 450ms 120ms apart, text at the top of its photo, no settle.",
    settings: BARE,
  },
];

export const INITIAL: Settings = PRESETS[0].settings;

export function sameSettings(a: Settings, b: Settings) {
  return (Object.keys(a) as (keyof Settings)[]).every((key) => a[key] === b[key]);
}

export function exportValues(s: Settings, label: string, theme: string, steps: { desktop: MaskStep[]; phone: MaskStep[] }, card: string) {
  const timing = { startMs: s.landingMs, lengthMs: s.maskMs, staggerMs: s.staggerMs, lineStaggerMs: s.textSplit === "lines" ? s.lineStaggerMs : 0 };
  return {
    label,
    theme,
    measuredOn: card,
    desktop: {
      breakpoint: "1024px and up",
      panelWidth: `${s.panelWidth}px`,
      photoWidth: `${s.photoWidth}px at 3:4`,
      rowGap: `${s.rowGap}px`,
      photoTextGap: `${s.columnGap}px`,
      textBesidePhoto: ALIGN_LABELS[s.textAlign],
      extrasPerRow: s.extrasPerRow,
      sides: "alternate from the left, extras continue the alternation",
    },
    phone: {
      stageMaxHeight: `${s.stageMaxHeight}svh`,
      autoAdvance: s.autoAdvance > 0 ? `${s.autoAdvance}s, one pass, stops on the last photo or at a touch` : "off",
      crossfade: `${s.crossfadeMs}ms`,
      input: "tap or swipe left for the next photo, swipe right for the previous, arrow keys, dots",
    },
    mask: {
      startsAt: `${s.landingMs}ms after open (the flight's landing)`,
      length: `${s.maskMs}ms`,
      stagger: `${s.staggerMs}ms`,
      text: SPLIT_LABELS[s.textSplit],
      lineStagger: s.textSplit === "lines" ? `${s.lineStaggerMs}ms` : "n/a",
      photo: PHOTO_MASK_LABELS[s.photoMask],
      settle: s.settle > 0 ? `${(1 + s.settle / 100).toFixed(4)} to 1 over the mask` : "off",
      ease: EASES[s.ease].css,
      textMask: "each line or block inside an overflow clip, yPercent 110 to 0 (the sections grammar's MASKED)",
      wholeModalDoneAt: {
        desktop: `${Math.round(maskTable(steps.desktop, timing).endMs)}ms`,
        phone: `${Math.round(maskTable(steps.phone, timing).endMs)}ms`,
      },
    },
    reducedMotion: "no masks, no settle, no auto-advance, an instant stage swap; the panel's own 180ms fade only",
  };
}
