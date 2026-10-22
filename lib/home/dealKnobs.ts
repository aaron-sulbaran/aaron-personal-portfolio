import { useSyncExternalStore } from "react";
import { COIL } from "@/lib/coil/constants";
import type { EntranceTuning } from "@/lib/coil/entrance";

// The deal's lab knobs: one flat record, its ranges, the clamp every value
// passes through, and a tiny store the dev-only lab panel writes and the deal's
// parts read when they use a value (never per frame). The defaults are
// COIL.deal; production never writes the store, so it reads them as they are.

const D = COIL.deal;

export type DealKnobs = {
  // The deal's clock, in ms from the click (COIL.deal.timeline).
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
  openStartMs: number; // the field opens
  // The wheel (COIL.deal.wheel).
  wheelIdleCardsPerSecond: number;
  wheelLeanDeg: number;
  wheelScale: number; // times the size of the teaser's slot
  wheelOffsetX: number; // shares of the canvas
  wheelOffsetY: number;
  openReach: number; // how far the section's opening travels (1: to the farthest corner)
  openMs: number; // how long the section takes to open
  columnsDelayMs: number;
  columnsStaggerMs: number;
};

export type NumericKnob = keyof DealKnobs;

export type KnobSpec = { label: string; group: string; min: number; max: number; step: number; unit?: string };

export const KNOB_SPEC: Record<NumericKnob, KnobSpec> = {
  peakCardsPerSecond: { label: "Peak speed", group: "Spin", min: 2, max: 20, step: 0.5, unit: " cards/s" },
  coarsePeakCardsPerSecond: { label: "Peak speed, touch", group: "Spin", min: 2, max: 20, step: 0.5, unit: " cards/s" },
  upMs: { label: "Spin-up", group: "Spin", min: 200, max: 1500, step: 10, unit: "ms" },
  textOutMs: { label: "Teaser text out", group: "Spin", min: 0, max: 1000, step: 10, unit: "ms" },
  wheelIdleCardsPerSecond: { label: "Wheel pace", group: "Wheel", min: 0, max: 3, step: 0.05, unit: " cards/s" },
  wheelLeanDeg: { label: "Wheel lean", group: "Wheel", min: -45, max: 15, step: 1, unit: "deg" },
  wheelScale: { label: "Wheel size", group: "Wheel", min: 0.5, max: 1.6, step: 0.02 },
  wheelOffsetX: { label: "Wheel nudge X", group: "Wheel", min: -0.3, max: 0.3, step: 0.01 },
  wheelOffsetY: { label: "Wheel nudge Y", group: "Wheel", min: -0.3, max: 0.3, step: 0.01 },
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
};

export const DEFAULT_KNOBS: DealKnobs = {
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
  wheelIdleCardsPerSecond: D.wheel.idleCardsPerSecond,
  wheelLeanDeg: D.wheel.leanDeg,
  wheelScale: D.wheel.scale,
  wheelOffsetX: D.wheel.offsetX,
  wheelOffsetY: D.wheel.offsetY,
  openReach: D.open.reach,
  openMs: D.open.ms,
  columnsDelayMs: D.columns.delayMs,
  columnsStaggerMs: D.columns.staggerMs,
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
  return out;
}

// The tuning handed to the Coil's entrance (lib/coil/entrance.ts tunedConstants):
// the timeline, the wheel and the field's opening.
export function entranceTuningOf(knobs: DealKnobs): EntranceTuning {
  return {
    timeline: {
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
      idleCardsPerSecond: knobs.wheelIdleCardsPerSecond,
      leanDeg: knobs.wheelLeanDeg,
      scale: knobs.wheelScale,
      offsetX: knobs.wheelOffsetX,
      offsetY: knobs.wheelOffsetY,
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
