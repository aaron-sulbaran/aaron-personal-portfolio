import { useSyncExternalStore } from "react";
import { COIL } from "@/lib/coil/constants";
import type { EntranceTuning } from "@/lib/coil/entrance";

// The deal's lab knobs: one flat record, its ranges, the clamp every value
// passes through, and a tiny store the dev-only lab panel writes and the deal's
// parts read when they use a value (never per frame). The defaults are
// COIL.deal; production never writes the store, so it reads them as they are.

const D = COIL.deal;

export const PROMPT_VERSIONS = ["plate", "calm", "outline", "spotlight", "quiet", "lit", "title"] as const;
export type PromptVersion = (typeof PROMPT_VERSIONS)[number];
export const PROMPT_TITLE_PLACES = ["row", "bare", "column"] as const;
export type PromptTitlePlace = (typeof PROMPT_TITLE_PLACES)[number];
export const PROMPT_MODES = ["early", "hold", "after"] as const;
export type PromptMode = (typeof PROMPT_MODES)[number];

// D, F and G light the rested Coil, so they never start before the landing.
export function startsOnLanding(version: PromptVersion): boolean {
  return version === "spotlight" || version === "lit" || version === "title";
}

// D, F and G always start on the landing, so their Early is Hold; everything else is as chosen.
export function modeForVersion(version: PromptVersion, mode: PromptMode): PromptMode {
  return startsOnLanding(version) && mode === "early" ? "hold" : mode;
}

export type DealKnobs = {
  // The ribbon (COIL.deal.ribbon): the first screen's drifting row.
  ribbonCardHeightPx: number;
  ribbonCardHeightPhonePx: number;
  ribbonGapPx: number; // between cards on a desktop or a tablet
  ribbonGapPhonePx: number; // between cards on a phone-wide canvas (under COIL.deal.ribbon.phoneBelowPx)
  ribbonSpeedPxPerS: number;
  ribbonFadeWidthPx: number;
  ribbonOffsetYPx: number; // the row's vertical nudge from its slot
  ribbonHoverSpeedFactor: number; // how many times faster the row eases while the pointer is over the button
  ribbonHoverTighten: number; // how far its gaps tighten toward the button then, of the way to a closed row
  ribbonHoverEaseMs: number; // how long the anticipation takes to take hold (and let go)
  // The click: the tight row the cards gather into (never tighter than a gap of
  // lib/coil/separation.ts MIN_GAP_SHARE of a card's width).
  ribbonGatherPitch: number; // card heights between cards of the row (smaller is tighter; a card is 0.75 wide)
  // The deal's clock, in ms from the click (COIL.deal.timeline); every time
  // after the two below counts from the end of the condense.
  condenseMs: number; // the ribbon's gaps close and the row rushes in toward the button
  condensePower: number; // the rush's strength: how front loaded its ease out is (3 is power2.out)
  curlStartMs: number; // the row starts curling into the wheel (before the condense ends when negative)
  curlMs: number; // the row curls into the wheel
  windRampMs: number; // the pull's winding eases in (0: starts at full rate)
  peakCardsPerSecond: number; // the wheel's top speed
  coarsePeakCardsPerSecond: number; // a touch screen's top speed (a phone can run at 30 Hz)
  upMs: number; // the spin-up, 0.5 cards/s to the peak
  textOutMs: number; // the teaser's text leaves
  scrollStartMs: number; // the page scrolls itself to the section
  scrollMs: number;
  flattenStartMs: number; // the wheel flattens into the band
  flattenMs: number;
  slowStartMs: number; // the band slows to the idle pace
  slowMs: number;
  pullStartMs: number; // the band lifts into 3D and unfurls
  pullMs: number;
  openStartMs: number; // the field opens (it lifts the faded patch behind the paragraphs)
  // The wheel (COIL.deal.wheel).
  wheelLeanDeg: number;
  wheelScale: number; // times its size at the anchor
  wheelOffsetX: number; // shares of the canvas
  wheelOffsetY: number;
  wheelPinKneePx: number; // the ribbon and the wheel slow into the stage's sticking over this many px (0: the old catch)
  openReach: number; // how far the section's opening travels (1: to the farthest corner)
  openMs: number; // how long the section takes to open
  columnsDelayMs: number;
  columnsStaggerMs: number;
  // The click-a-card prompt (COIL.deal.prompt).
  promptVersion: PromptVersion;
  promptMode: PromptMode;
  promptEarlyStartMs: number; // from the lift
  promptHoldStartMs: number; // from the landing
  promptAfterStartMs: number; // from the landing
  promptHoldMs: number; // the readable hold, never under COIL.deal.prompt.minHoldMs
  promptAloneMs: number; // G, line first: the line's hold at full size with the page still waiting, in place of promptHoldMs
  promptShrinkMs: number;
  promptSizeVwDesktop: number;
  promptSizeVwPhone: number;
  promptTitleRatio: number; // E, F and G: the start size in page titles
  promptDimStrength: number; // F and G: the dim, as a share of its token (0: none)
  promptTitlePlace: PromptTitlePlace; // G from 768 px wide: where its big line plays
};

// The knobs that are a plain number on a slider.
export type NumericKnob = {
  [K in keyof DealKnobs]: DealKnobs[K] extends number ? K : never;
}[keyof DealKnobs];

export type KnobSpec = { label: string; group: string; min: number; max: number; step: number; unit?: string };

export const KNOB_SPEC: Record<NumericKnob, KnobSpec> = {
  ribbonCardHeightPx: { label: "Card height, desktop", group: "Ribbon", min: 80, max: 320, step: 5, unit: "px" },
  ribbonCardHeightPhonePx: { label: "Card height, phone", group: "Ribbon", min: 60, max: 240, step: 5, unit: "px" },
  ribbonGapPx: { label: "Gap between cards, desktop", group: "Ribbon", min: 0, max: 120, step: 2, unit: "px" },
  ribbonGapPhonePx: { label: "Gap between cards, phone", group: "Ribbon", min: 0, max: 120, step: 2, unit: "px" },
  ribbonSpeedPxPerS: { label: "Drift speed", group: "Ribbon", min: 0, max: 120, step: 1, unit: " px/s" },
  ribbonFadeWidthPx: { label: "Edge fade width", group: "Ribbon", min: 0, max: 300, step: 4, unit: "px" },
  ribbonOffsetYPx: { label: "Vertical nudge", group: "Ribbon", min: -200, max: 200, step: 4, unit: "px" },
  ribbonHoverSpeedFactor: { label: "Hover: speed-up", group: "Anticipation", min: 1, max: 8, step: 0.1, unit: "x" },
  ribbonHoverTighten: { label: "Hover: gaps tighten", group: "Anticipation", min: 0, max: 1, step: 0.01 },
  ribbonHoverEaseMs: { label: "Hover: ease", group: "Anticipation", min: 60, max: 800, step: 10, unit: "ms" },
  ribbonGatherPitch: { label: "Gather: how tight (card heights apart)", group: "Click", min: 0.8, max: 1.2, step: 0.01 },
  condenseMs: { label: "Rush in (gaps close)", group: "Click", min: 0, max: 2000, step: 10, unit: "ms" },
  condensePower: { label: "Rush: strength", group: "Click", min: 1, max: 7, step: 0.1 },
  curlStartMs: { label: "Curl starts (after the rush)", group: "Condense and curl", min: -1000, max: 1000, step: 10, unit: "ms" },
  curlMs: { label: "Curl into the wheel", group: "Condense and curl", min: 0, max: 2000, step: 10, unit: "ms" },
  windRampMs: { label: "Winding onset ramp", group: "Lift", min: 0, max: 700, step: 5, unit: "ms" },
  peakCardsPerSecond: { label: "Peak speed", group: "Spin", min: 2, max: 20, step: 0.5, unit: " cards/s" },
  coarsePeakCardsPerSecond: { label: "Peak speed, touch", group: "Spin", min: 2, max: 20, step: 0.5, unit: " cards/s" },
  upMs: { label: "Spin-up", group: "Spin", min: 200, max: 1500, step: 10, unit: "ms" },
  textOutMs: { label: "Page 1 text out", group: "Spin", min: 0, max: 1000, step: 10, unit: "ms" },
  wheelLeanDeg: { label: "Wheel lean", group: "Wheel", min: -45, max: 15, step: 1, unit: "deg" },
  wheelScale: { label: "Wheel size", group: "Wheel", min: 0.5, max: 1.6, step: 0.02 },
  wheelOffsetX: { label: "Wheel nudge X", group: "Wheel", min: -0.3, max: 0.3, step: 0.01 },
  wheelOffsetY: { label: "Wheel nudge Y", group: "Wheel", min: -0.3, max: 0.3, step: 0.01 },
  wheelPinKneePx: { label: "Slow into the stick", group: "Wheel", min: 0, max: 900, step: 10, unit: "px" },
  scrollStartMs: { label: "Scroll starts", group: "Scroll", min: 0, max: 1500, step: 10, unit: "ms" },
  scrollMs: { label: "Scroll duration", group: "Scroll", min: 600, max: 4000, step: 50, unit: "ms" },
  flattenStartMs: { label: "Flatten starts", group: "Flatten and slow", min: 0, max: 2500, step: 10, unit: "ms" },
  flattenMs: { label: "Flatten duration", group: "Flatten and slow", min: 300, max: 2500, step: 10, unit: "ms" },
  slowStartMs: { label: "Slowing starts", group: "Flatten and slow", min: 600, max: 3000, step: 10, unit: "ms" },
  slowMs: { label: "Slowing duration", group: "Flatten and slow", min: 300, max: 3000, step: 10, unit: "ms" },
  pullStartMs: { label: "Lift starts", group: "Lift", min: 600, max: 3500, step: 10, unit: "ms" },
  pullMs: { label: "Lift duration", group: "Lift", min: 300, max: 2000, step: 10, unit: "ms" },
  openStartMs: { label: "Field opens", group: "Field", min: 0, max: 3500, step: 10, unit: "ms" },
  openReach: { label: "Opening size", group: "Field", min: 0.3, max: 1.4, step: 0.05 },
  openMs: { label: "Opening duration", group: "Field", min: 300, max: 4000, step: 50, unit: "ms" },
  columnsDelayMs: { label: "Columns delay", group: "Columns", min: 0, max: 3000, step: 50, unit: "ms" },
  columnsStaggerMs: { label: "Columns stagger", group: "Columns", min: 0, max: 120, step: 2, unit: "ms" },
  promptEarlyStartMs: { label: "Early: starts (from the lift)", group: "Prompt", min: -800, max: 800, step: 10, unit: "ms" },
  promptHoldStartMs: { label: "Hold: starts (from the landing)", group: "Prompt", min: -800, max: 800, step: 10, unit: "ms" },
  promptAfterStartMs: { label: "After: starts (from the landing)", group: "Prompt", min: -800, max: 800, step: 10, unit: "ms" },
  promptHoldMs: { label: "Readable hold", group: "Prompt", min: D.prompt.minHoldMs, max: 2500, step: 50, unit: "ms" },
  promptAloneMs: { label: "G, line first: the line alone", group: "Prompt", min: 300, max: 1500, step: 50, unit: "ms" },
  promptShrinkMs: { label: "Shrink into the spot", group: "Prompt", min: 200, max: 1500, step: 10, unit: "ms" },
  promptSizeVwDesktop: { label: "Start size, desktop", group: "Prompt", min: 2, max: 8, step: 0.1, unit: "vw" },
  promptSizeVwPhone: { label: "Start size, phone", group: "Prompt", min: 4, max: 12, step: 0.1, unit: "vw" },
  promptDimStrength: { label: "F and G: dim strength", group: "Prompt", min: 0, max: 1, step: 0.05 },
  promptTitleRatio: { label: "E, F and G: start size", group: "Prompt", min: 0.8, max: 3, step: 0.05, unit: "x title" },
};

export const DEAL_CHOICE_SPEC = {
  promptVersion: { label: "Version", group: "Prompt", options: PROMPT_VERSIONS, names: { plate: "A, on a plate", calm: "B, in a calm place", outline: "C, outlined", spotlight: "D, spotlight", quiet: "E, quieter", lit: "F, lit cards", title: "G, lit title" } },
  promptMode: { label: "Timing", group: "Prompt", options: PROMPT_MODES, names: { early: "Early", hold: "Hold", after: "After" } },
  promptTitlePlace: { label: "G: where", group: "Prompt", options: PROMPT_TITLE_PLACES, names: { row: "Top, on a plate", bare: "Top, words only", column: "In the column" } },
} as const;

// G's two timings, named in the lab by what the reader sees: Hold has the page's title and columns wait
// for the line (they come in as it shrinks), After brings them in first, as the deal times them.
export const TITLE_MODE_NAMES: Record<PromptMode, string> = { early: "Early", hold: "Line first", after: "Columns first" };

export const DEFAULT_KNOBS: DealKnobs = {
  ribbonCardHeightPx: D.ribbon.cardHeightPx,
  ribbonCardHeightPhonePx: D.ribbon.cardHeightPhonePx,
  ribbonGapPx: D.ribbon.gapPx,
  ribbonGapPhonePx: D.ribbon.gapPhonePx,
  ribbonSpeedPxPerS: D.ribbon.speedPxPerS,
  ribbonFadeWidthPx: D.ribbon.fadeWidthPx,
  ribbonOffsetYPx: D.ribbon.offsetYPx,
  ribbonHoverSpeedFactor: D.ribbon.hoverSpeedFactor,
  ribbonHoverTighten: D.ribbon.hoverTighten,
  ribbonHoverEaseMs: D.ribbon.hoverEaseMs,
  ribbonGatherPitch: D.ribbon.gatherPitch,
  condenseMs: D.timeline.condenseMs,
  condensePower: D.timeline.condensePower,
  curlStartMs: D.timeline.curlStartMs,
  curlMs: D.timeline.curlMs,
  windRampMs: D.timeline.windRampMs,
  peakCardsPerSecond: D.timeline.peakCardsPerSecond,
  coarsePeakCardsPerSecond: D.timeline.coarsePeakCardsPerSecond,
  upMs: D.timeline.upMs,
  textOutMs: D.timeline.textOutMs,
  scrollStartMs: D.timeline.scrollStartMs,
  scrollMs: D.timeline.scrollMs,
  flattenStartMs: D.timeline.flattenStartMs,
  flattenMs: D.timeline.flattenMs,
  slowStartMs: D.timeline.slowStartMs,
  slowMs: D.timeline.slowMs,
  pullStartMs: D.timeline.pullStartMs,
  pullMs: D.timeline.pullMs,
  openStartMs: D.timeline.openStartMs,
  wheelLeanDeg: D.wheel.leanDeg,
  wheelScale: D.wheel.scale,
  wheelOffsetX: D.wheel.offsetX,
  wheelOffsetY: D.wheel.offsetY,
  wheelPinKneePx: D.wheel.pinKneePx,
  openReach: D.open.reach,
  openMs: D.open.ms,
  columnsDelayMs: D.columns.delayMs,
  columnsStaggerMs: D.columns.staggerMs,
  promptVersion: D.prompt.version,
  promptMode: D.prompt.mode,
  promptEarlyStartMs: D.prompt.startMs.early,
  promptHoldStartMs: D.prompt.startMs.hold,
  promptAfterStartMs: D.prompt.startMs.after,
  promptHoldMs: D.prompt.holdMs,
  promptAloneMs: D.prompt.title.aloneMs,
  promptShrinkMs: D.prompt.shrinkMs,
  promptSizeVwDesktop: D.prompt.sizeVw.desktop,
  promptSizeVwPhone: D.prompt.sizeVw.phone,
  promptTitleRatio: D.prompt.titleRatio,
  promptDimStrength: D.prompt.dimStrength,
  promptTitlePlace: D.prompt.titlePlace,
};

const NUMERIC = Object.keys(KNOB_SPEC) as NumericKnob[];

// Every knob held to its range. A value that is not a finite number falls back
// to the base, and keys that are not knobs (the retired deck, riffle, glow and
// settle among them) are dropped, so a stale or hand-edited saved record cannot
// break the page.
export function clampKnobs(input: Partial<Record<string, unknown>>, base: DealKnobs = DEFAULT_KNOBS): DealKnobs {
  const out: DealKnobs = { ...base };
  for (const key of NUMERIC) {
    const value = input[key];
    const spec = KNOB_SPEC[key];
    out[key] = typeof value === "number" && Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : base[key];
  }
  out.promptVersion = pick(PROMPT_VERSIONS, input.promptVersion, base.promptVersion);
  out.promptMode = pick(PROMPT_MODES, input.promptMode, base.promptMode);
  out.promptTitlePlace = pick(PROMPT_TITLE_PLACES, input.promptTitlePlace, base.promptTitlePlace);
  return out;
}

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.find((item) => item === value) ?? fallback;
}

// The tuning handed to the Coil's entrance (lib/coil/entrance.ts tunedConstants):
// the ribbon, the timeline, the wheel and the field's opening.
export function entranceTuningOf(knobs: DealKnobs): EntranceTuning {
  return {
    ribbon: {
      cardHeightPx: knobs.ribbonCardHeightPx,
      cardHeightPhonePx: knobs.ribbonCardHeightPhonePx,
      gapPx: knobs.ribbonGapPx,
      gapPhonePx: knobs.ribbonGapPhonePx,
      speedPxPerS: knobs.ribbonSpeedPxPerS,
      fadeWidthPx: knobs.ribbonFadeWidthPx,
      offsetYPx: knobs.ribbonOffsetYPx,
      hoverSpeedFactor: knobs.ribbonHoverSpeedFactor,
      hoverTighten: knobs.ribbonHoverTighten,
      hoverEaseMs: knobs.ribbonHoverEaseMs,
      gatherPitch: knobs.ribbonGatherPitch,
    },
    timeline: {
      condenseMs: knobs.condenseMs,
      condensePower: knobs.condensePower,
      curlStartMs: knobs.curlStartMs,
      curlMs: knobs.curlMs,
      windRampMs: knobs.windRampMs,
      peakCardsPerSecond: knobs.peakCardsPerSecond,
      coarsePeakCardsPerSecond: knobs.coarsePeakCardsPerSecond,
      upMs: knobs.upMs,
      textOutMs: knobs.textOutMs,
      scrollStartMs: knobs.scrollStartMs,
      scrollMs: knobs.scrollMs,
      flattenStartMs: knobs.flattenStartMs,
      flattenMs: knobs.flattenMs,
      slowStartMs: knobs.slowStartMs,
      slowMs: knobs.slowMs,
      pullStartMs: knobs.pullStartMs,
      pullMs: knobs.pullMs,
      openStartMs: knobs.openStartMs,
    },
    wheel: {
      leanDeg: knobs.wheelLeanDeg,
      scale: knobs.wheelScale,
      offsetX: knobs.wheelOffsetX,
      offsetY: knobs.wheelOffsetY,
      pinKneePx: knobs.wheelPinKneePx,
    },
    open: { ms: knobs.openMs, reach: knobs.openReach },
  };
}

// ---- the store ----

let current: DealKnobs = DEFAULT_KNOBS;
const listeners = new Set<() => void>();

export function getKnobs(): DealKnobs {
  return current;
}

// Dev only: the lab panel is the one writer, and it is not built in production.
export function setKnobs(patch: Partial<DealKnobs>) {
  if (process.env.NODE_ENV === "production") return;
  current = clampKnobs({ ...current, ...patch }, current);
  listeners.forEach((listener) => listener());
}

export function resetKnobs() {
  if (process.env.NODE_ENV === "production") return;
  current = DEFAULT_KNOBS;
  listeners.forEach((listener) => listener());
}

export function subscribeKnobs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useKnobs(): DealKnobs {
  return useSyncExternalStore(subscribeKnobs, getKnobs, () => DEFAULT_KNOBS);
}
