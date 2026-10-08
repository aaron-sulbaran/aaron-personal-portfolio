// What the gallery lab tunes (modal-gallery.md, "What the lab tunes"), the
// presets, and what "Copy values" puts on the clipboard. Lengths are px at
// 1x, times are ms unless named seconds.

import type { StageFit } from "./rows";
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
  // Horizontal photos on desktop
  wideFrom: number; // width over height from which a photo spans the row
  wideWidth: number; // percent of the panel's inner width a spanning photo may take
  wideMaxHeight: number; // px; a spanning photo narrows rather than grow past this
  stackGap: number; // px between a spanning photo's caption and its paragraph
  // Phone
  stageMaxHeight: number; // percent of the visible height
  autoAdvance: number; // seconds, 0 is off
  crossfadeMs: number;
  stageFit: StageFit;
  stageEaseMs: number; // the stage easing between photo heights
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
  wideFrom: { min: 1, max: 1.5, step: 0.05 },
  wideWidth: { min: 60, max: 100, step: 2 },
  wideMaxHeight: { min: 320, max: 720, step: 10 },
  stackGap: { min: 8, max: 48, step: 2 },
  stageEaseMs: { min: 0, max: 600, step: 10 },
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
export const FIT_LABELS: Record<StageFit, string> = { each: "Each photo's height (eases)", tallest: "The tallest photo's height (text stays put)" };
export const ALIGN_LABELS: Record<TextAlign, string> = { center: "Middle of the photo", start: "Top of the photo" };

// The brief's numbers, nothing added: block masks, no settle, every photo
// wider than square across the whole row, the stage easing to each photo.
const BARE: Settings = {
  panelWidth: 912,
  photoWidth: 320,
  rowGap: 64,
  columnGap: 48,
  textAlign: "start",
  extrasPerRow: 2,
  wideFrom: 1.05,
  wideWidth: 100,
  wideMaxHeight: 720,
  stackGap: 16,
  stageMaxHeight: 55,
  autoAdvance: 4,
  crossfadeMs: 400,
  stageFit: "each",
  stageEaseMs: 250,
  landingMs: 520,
  maskMs: 450,
  staggerMs: 120,
  textSplit: "block",
  lineStaggerMs: 0,
  photoMask: "wipe",
  settle: 0,
  ease: "site",
};

// Round one's pick, before photos kept their own shape: kept so Aaron can
// compare. Every photo was 3:4, so nothing spanned the row.
const ROUND_ONE: Settings = {
  panelWidth: 944,
  photoWidth: 372,
  rowGap: 88,
  columnGap: 56,
  textAlign: "center",
  extrasPerRow: 2,
  wideFrom: 1.1,
  wideWidth: 100,
  wideMaxHeight: 720,
  stackGap: 20,
  stageMaxHeight: 55,
  autoAdvance: 4,
  crossfadeMs: 420,
  stageFit: "each",
  stageEaseMs: 250,
  landingMs: 520,
  maskMs: 480,
  staggerMs: 110,
  textSplit: "lines",
  lineStaggerMs: 45,
  photoMask: "wipe",
  settle: 2,
  ease: "site",
};

// My pick for round two. Vertical photos narrow to 356px so the text beside
// them keeps a comfortable measure; anything wider than 1.1:1 spans the row
// but stops at 420px tall, so a 4:3 or 3:2 group photo, its caption and the
// first lines of its paragraph still clear the fold at 1024 by 768. On
// phones the stage holds the tallest photo's height, so the text under it
// never jumps while the pass runs. Masks unchanged from round one.
const RECOMMENDED: Settings = {
  panelWidth: 944,
  photoWidth: 356,
  rowGap: 80,
  columnGap: 56,
  textAlign: "center",
  extrasPerRow: 2,
  wideFrom: 1.1,
  wideWidth: 100,
  wideMaxHeight: 420,
  stackGap: 20,
  stageMaxHeight: 55,
  autoAdvance: 4,
  crossfadeMs: 420,
  stageFit: "tallest",
  stageEaseMs: 260,
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
    note: "Vertical photos 356px beside their paragraph; anything from 1.1:1 spans the row up to 420px tall with its caption and paragraph under it; the phone stage holds the tallest photo so the text never jumps. Masks as round one.",
    settings: RECOMMENDED,
  },
  {
    id: "bare",
    name: "Bare default",
    note: "The brief's numbers and nothing more: 320px photos, every photo wider than square across the whole row, the stage easing to each photo over 250ms, whole-block masks of 450ms 120ms apart, no settle.",
    settings: BARE,
  },
  {
    id: "round-one",
    name: "Round one pick",
    note: "My round one pick with spanning photos uncapped and the stage easing to each photo: what the old numbers do with the new shapes.",
    settings: ROUND_ONE,
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
      verticalPhotoWidth: `${s.photoWidth}px, its own height`,
      horizontalFrom: `${s.wideFrom.toFixed(2)}:1 and wider spans the row`,
      horizontalWidth: `up to ${s.wideWidth}% of the inner width, at most ${s.wideMaxHeight}px tall, never under 320px wide`,
      horizontalToParagraph: `${s.stackGap}px`,
      captions: "under each photo, text-sm muted, masked with its photo",
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
      stageHeight: FIT_LABELS[s.stageFit],
      stageEase: s.stageFit === "each" ? `${s.stageEaseMs}ms` : "n/a",
      fit: "each photo whole inside the inner width and the height cap",
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
