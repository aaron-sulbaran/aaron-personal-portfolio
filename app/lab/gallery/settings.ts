// What the gallery lab tunes (modal-gallery.md, "What the lab tunes"), the
// presets, and what "Copy values" puts on the clipboard. Lengths are px at
// 1x, times are ms unless named seconds.

import { areaRatio, uniformBoxes, type HorizontalShape } from "./plan";
import type { LeadMode, StageFit } from "./rows";
import { maskTable, type MaskStep } from "./timing";

export type TextSplit = "lines" | "block";
export type PhotoMask = "wipe" | "rise";
export type EaseKey = "site" | "power3";
export type TextAlign = "center" | "start";
// Round four: every photo its own row (the Capital One model), or the
// interleaved rows of rounds one to three.
export type DesktopLayout = "rows" | "interleaved";
// Round four: a pager of photo-and-words pages, or the stage over a scroll.
export type PhoneLayout = "pager" | "stage";
// Where a photo narrower than its card's photo column sits in it.
export type PhotoAlign = "text" | "center" | "edge";

export interface Settings {
  desktopLayout: DesktopLayout;
  phoneLayout: PhoneLayout;
  // Round four, desktop: one box per orientation and the text column
  verticalWidth: number; // px, the vertical box is 3:4
  horizontalWidth: number; // px
  horizontalShape: HorizontalShape;
  textWidth: number; // px, the text beside a photo; the panel follows
  photoAlign: PhotoAlign;
  // Round four, phone
  slideMs: number; // the pager's travel between pages
  flickPx: number; // a vertical drag this far closes the modal
  // Desktop (rounds one to three)
  panelWidth: number;
  photoWidth: number;
  rowGap: number;
  columnGap: number;
  textAlign: TextAlign;
  extrasPerRow: number;
  leadMode: LeadMode; // where a photo card's card picture leads
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
  stageMaxHeight: { min: 30, max: 65, step: 1 },
  verticalWidth: { min: 260, max: 400, step: 4 },
  horizontalWidth: { min: 320, max: 560, step: 4 },
  textWidth: { min: 320, max: 600, step: 8 },
  slideMs: { min: 0, max: 700, step: 10 },
  flickPx: { min: 40, max: 240, step: 8 },
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
export const LEAD_LABELS: Record<LeadMode, string> = { title: "Beside the title", block: "Beside the first block" };
export const FIT_LABELS: Record<StageFit, string> = { each: "Each photo's height (eases)", tallest: "The tallest photo's height (text stays put)" };
export const ALIGN_LABELS: Record<TextAlign, string> = { center: "Middle of the photo", start: "Top of the photo" };
export const DESKTOP_LABELS: Record<DesktopLayout, string> = { rows: "Every photo its own row (round 4)", interleaved: "Interleaved (rounds 1 to 3)" };
export const PHONE_LABELS: Record<PhoneLayout, string> = { pager: "Pager (round 4)", stage: "Stage over a scroll (rounds 1 to 3)" };
export const PHOTO_ALIGN_LABELS: Record<PhotoAlign, string> = { text: "Against its words", center: "Centred", edge: "Against the panel edge" };

// What rounds one to three never had: the round four values at their
// defaults, with both layouts set back to the old ones.
const EARLIER = {
  desktopLayout: "interleaved",
  phoneLayout: "stage",
  verticalWidth: 320,
  horizontalWidth: 424,
  horizontalShape: "4:3",
  textWidth: 460,
  photoAlign: "text",
  slideMs: 360,
  flickPx: 96,
} as const satisfies Partial<Settings>;

// The brief's numbers, nothing added: block masks, no settle, every photo
// wider than square across the whole row, the stage easing to each photo.
const BARE: Settings = {
  ...EARLIER,
  panelWidth: 912,
  photoWidth: 320,
  rowGap: 64,
  columnGap: 48,
  textAlign: "start",
  extrasPerRow: 2,
  leadMode: "block",
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
  ...EARLIER,
  panelWidth: 944,
  photoWidth: 372,
  rowGap: 88,
  columnGap: 56,
  textAlign: "center",
  extrasPerRow: 2,
  leadMode: "block",
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

// My pick, rounds two and three. A photo card's card picture leads beside
// the title, so the flight lands at the top of the modal and every other
// photo stays beside its own words. Captions made every vertical row taller,
// so vertical photos drop to the 320px floor and the rows close to 56px
// apart: that keeps Capital One's first photo above the fold at 1024 by 768
// behind its unpaired opening paragraph, and gives the text beside a photo a
// 486px measure. Anything from 1.1:1 spans the row but stops at 400px tall,
// 12px over its paragraph, so a 4:3 or 3:2 group photo, its caption and its
// paragraph clear the fold at 1024 by 768 (IEEE ends at 762 of 768). On
// phones the stage holds the tallest photo's height, so the text under it
// never jumps while the pass runs, capped at 48 percent so every card's first
// lines show at 360 by 740 (IEEE, the tightest, at 735 of 740). Masks
// unchanged from round one.
const RECOMMENDED: Settings = {
  ...EARLIER,
  panelWidth: 944,
  photoWidth: 320,
  rowGap: 56,
  columnGap: 56,
  textAlign: "center",
  extrasPerRow: 2,
  leadMode: "title",
  wideFrom: 1.1,
  wideWidth: 100,
  wideMaxHeight: 400,
  stackGap: 12,
  stageMaxHeight: 48,
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

// Round four (Aaron, 2026-10-09: "I like the way that the actual Capital
// One looked, and I would like to have that applied across all of them"),
// on the recommendation. Desktop: the header at the top left, then every
// photo its own row with its words beside it, vertically centred, the sides
// alternating. One vertical box (320 by 427, the card picture's 3:4) and one
// horizontal box (424 by 318, 4:3), the same area within 2 percent, so a
// horizontal photo reads as the same size as a vertical one; anything wider
// than square takes the horizontal box. The text column is 460px (about 52
// characters of 18px Inter), so the panel is 916px on an all-vertical card
// like Capital One and 1020px on a card with a horizontal photo; a narrower
// photo sits against its words. Rows 64px apart. Phone: a pager, one photo
// and its words a page, the header fixed above, the stage at most 40
// percent of the height (every photo whole at 360 to 430 wide), 360ms of
// travel, a 96px vertical flick to close. Auto-advance off: the words
// change with the photo, and a page that turns on its own moves what you are
// reading.
const ROUND_FOUR: Settings = {
  ...RECOMMENDED,
  desktopLayout: "rows",
  phoneLayout: "pager",
  verticalWidth: 320,
  horizontalWidth: 424,
  horizontalShape: "4:3",
  textWidth: 460,
  photoAlign: "text",
  wideFrom: 1,
  rowGap: 64,
  stageMaxHeight: 40,
  slideMs: 360,
  flickPx: 96,
  autoAdvance: 0,
};

export const PRESETS: readonly { id: string; name: string; note: string; settings: Settings }[] = [
  {
    id: "round-four",
    name: "Round 4, Capital One everywhere",
    note: "Every card as Capital One: the header at the top left, then every photo its own row with its words beside it, centred, sides alternating. One vertical box (320 by 427) and one horizontal box (424 by 318), the same area; a photo with no words yet shows a placeholder. Phone: a pager, one photo and its words a page, the header fixed above, arrows, dots and swipes, a vertical flick closes. Auto-advance off.",
    settings: ROUND_FOUR,
  },
  {
    id: "recommended",
    name: "Recommended",
    note: "The card picture leads beside the title, so the flight lands at the top. Vertical photos at the 320px floor beside their paragraph, rows 56px apart (Capital One's first photo clears the fold at 1024 by 768); anything from 1.1:1 spans the row up to 400px tall with its caption and paragraph 12px under it; the phone stage holds the tallest photo, capped at 48 percent of the height, so the text never jumps. Masks as round one.",
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
    desktop: s.desktopLayout === "rows" ? roundFourDesktop(s) : interleavedDesktop(s),
    phone: s.phoneLayout === "pager" ? roundFourPhone(s) : stagePhone(s),
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
    reducedMotion: "no masks, no settle, no auto-advance, an instant stage swap or page turn with no travel; the panel's own 180ms fade only",
  };
}

function roundFourDesktop(s: Settings) {
  const boxes = uniformBoxes(s.verticalWidth, s.horizontalWidth, s.horizontalShape);
  const round = (n: number) => Math.round(n);
  return {
    breakpoint: "1024px and up",
    layout: DESKTOP_LABELS.rows,
    header: "the logo tile (logo cards), the title and the meta line at the top left; a photo card's picture is its first row, not beside the title",
    verticalBox: `${boxes.vertical.width} by ${round(boxes.vertical.height)}px (3:4), every vertical photo and the card picture`,
    horizontalBox: `${boxes.horizontal.width} by ${round(boxes.horizontal.height)}px (${s.horizontalShape}), every photo from ${s.wideFrom.toFixed(2)}:1 wide`,
    horizontalArea: `${Math.round(areaRatio(boxes.horizontal, boxes.vertical) * 100)}% of the vertical box`,
    fit: "each photo cropped to its box (object-fit: cover), so every photo of one orientation is the same size",
    textColumn: `${s.textWidth}px`,
    panel: "2 x 40px padding + the card's widest box + the photo to text gap + the text column, capped by the viewport",
    narrowerPhoto: PHOTO_ALIGN_LABELS[s.photoAlign],
    rowGap: `${s.rowGap}px`,
    photoTextGap: `${s.columnGap}px`,
    textBesidePhoto: ALIGN_LABELS[s.textAlign],
    sides: "alternate from the left, one photo a row",
    words: "each photo's own block; the card picture takes the first block; a photo whose block another took shows a placeholder; blocks no photo took open or close the card, or ride with the nearest photo",
    captions: "under each photo, text-sm muted, masked with its photo",
  };
}

function interleavedDesktop(s: Settings) {
  return {
    breakpoint: "1024px and up",
    layout: DESKTOP_LABELS.interleaved,
    panelWidth: `${s.panelWidth}px`,
    verticalPhotoWidth: `${s.photoWidth}px, its own height`,
    horizontalFrom: `${s.wideFrom.toFixed(2)}:1 and wider spans the row`,
    horizontalWidth: `up to ${s.wideWidth}% of the inner width, at most ${s.wideMaxHeight}px tall, never under 320px wide`,
    horizontalToParagraph: `${s.stackGap}px`,
    captions: "under each photo, text-sm muted, masked with its photo",
    rowGap: `${s.rowGap}px`,
    photoTextGap: `${s.columnGap}px`,
    textBesidePhoto: ALIGN_LABELS[s.textAlign],
    cardPictureLeads: `${LEAD_LABELS[s.leadMode]}: a photo card's modal opens on its card picture (the flown card, 3:4), then up to three photos`,
    extrasPerRow: s.extrasPerRow,
    sides: "alternate from the left, extras continue the alternation",
  };
}

function roundFourPhone(s: Settings) {
  return {
    layout: PHONE_LABELS.pager,
    sheet: "the modal fills the visible height less 24px top and bottom; nothing scrolls but a long page's words",
    header: "fixed above the pages: the logo tile (logo cards), the title, the meta line",
    page: "one photo, its caption and its words; the first page carries the opening blocks, the last the closing ones and the links",
    stageHeight: `at most ${s.stageMaxHeight}% of the visible height, as tall as the card's tallest photo fitted whole, the same on every page`,
    fit: "each photo whole inside the inner width and the stage, standing on its caption; never cropped by the stage",
    longWords: "scroll inside their own area under the caption; the photo never leaves view",
    controls: "previous and next buttons and the dots in one row under the page, all real buttons, the ends disabled",
    travel: s.slideMs > 0 ? `${s.slideMs}ms, ${EASES[s.ease].css}, the photo and its words together` : "instant",
    swipe: "left or right on the photo or the words turns one page; past an end it springs back",
    dismiss: `a vertical flick of ${s.flickPx}px (or a quick one of 24px) on the photo, the header or words that fit closes the modal; a sideways swipe never does`,
    keys: "left and right arrows turn the page",
    autoAdvance: s.autoAdvance > 0 ? `${s.autoAdvance}s, one pass, stops on the last page or at a touch` : "off",
  };
}

function stagePhone(s: Settings) {
  return {
    layout: PHONE_LABELS.stage,
    stageMaxHeight: `${s.stageMaxHeight}svh`,
    autoAdvance: s.autoAdvance > 0 ? `${s.autoAdvance}s, one pass, stops on the last photo or at a touch` : "off",
    crossfade: `${s.crossfadeMs}ms`,
    stageHeight: FIT_LABELS[s.stageFit],
    stageEase: s.stageFit === "each" ? `${s.stageEaseMs}ms` : "n/a",
    fit: "each photo whole inside the inner width and the height cap",
    input: "tap or swipe left for the next photo, swipe right for the previous, arrow keys, dots",
  };
}
