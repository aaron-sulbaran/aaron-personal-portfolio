import { useSyncExternalStore } from "react";
import { COIL } from "@/lib/coil/constants";

// The deal's lab knobs: one flat record, its ranges, the clamp every value
// passes through, and a tiny store the dev-only lab panel writes and the deal's
// parts read when they use a value (never per frame). The defaults are
// COIL.deal; production never writes the store, so it reads them as they are.

const D = COIL.deal;

export type DealKnobs = {
  riffleOn: boolean;
  riffleMs: number;
  dealMs: number; // the cards' flight: the Coil's entrance duration
  dealStagger: number; // the shutter's stagger, a share of the duration per card
  startOffset: number; // where the stack starts: 0 the helix center, 1 the section's top edge
  glowSize: number;
  glowOffsetX: number;
  glowOffsetY: number;
  glowStrength: number;
  openReach: number; // how far the section's opening travels (1: to the farthest corner)
  openMs: number; // how long the section takes to open
  columnsDelayMs: number;
  columnsStaggerMs: number;
  fanDeg: number;
  settleScale: number;
  settleMs: number;
  settleDelayMs: number;
};

export type NumericKnob = Exclude<keyof DealKnobs, "riffleOn">;

export type KnobSpec = { label: string; group: string; min: number; max: number; step: number; unit?: string };

export const KNOB_SPEC: Record<NumericKnob, KnobSpec> = {
  riffleMs: { label: "Riffle duration", group: "Deck", min: 300, max: 1500, step: 10, unit: "ms" },
  fanDeg: { label: "Fan angle", group: "Deck", min: 0, max: 14, step: 0.5, unit: "deg" },
  dealMs: { label: "Deal duration", group: "Deal", min: 600, max: 4000, step: 50, unit: "ms" },
  dealStagger: { label: "Deal stagger", group: "Deal", min: 0, max: 0.04, step: 0.001 },
  startOffset: { label: "Entrance start offset", group: "Deal", min: 0, max: 1.2, step: 0.05 },
  openReach: { label: "Opening size", group: "Deal", min: 0.3, max: 1.4, step: 0.05 },
  openMs: { label: "Opening duration", group: "Deal", min: 300, max: 4000, step: 50, unit: "ms" },
  columnsDelayMs: { label: "Columns delay", group: "Columns", min: 0, max: 3000, step: 50, unit: "ms" },
  columnsStaggerMs: { label: "Columns stagger", group: "Columns", min: 0, max: 120, step: 2, unit: "ms" },
  glowSize: { label: "Glow size", group: "Glow", min: 0.3, max: 2, step: 0.05 },
  glowOffsetX: { label: "Glow offset X", group: "Glow", min: -0.5, max: 0.8, step: 0.02 },
  glowOffsetY: { label: "Glow offset Y", group: "Glow", min: -0.5, max: 0.5, step: 0.02 },
  glowStrength: { label: "Glow strength", group: "Glow", min: 0, max: 1, step: 0.02 },
  settleScale: { label: "Settle start scale", group: "Name", min: 1, max: 2, step: 0.01 },
  settleMs: { label: "Settle duration", group: "Name", min: 200, max: 3000, step: 50, unit: "ms" },
  settleDelayMs: { label: "Settle delay", group: "Name", min: 0, max: 1500, step: 20, unit: "ms" },
};

export const DEFAULT_KNOBS: DealKnobs = {
  riffleOn: D.riffle.on,
  riffleMs: D.riffle.ms,
  dealMs: D.entrance.durationMs,
  dealStagger: D.entrance.shutterStagger,
  startOffset: D.entrance.startOffset,
  glowSize: D.glow.size,
  glowOffsetX: D.glow.offsetX,
  glowOffsetY: D.glow.offsetY,
  glowStrength: D.glow.strength,
  openReach: D.open.reach,
  openMs: D.open.ms,
  columnsDelayMs: D.columns.delayMs,
  columnsStaggerMs: D.columns.staggerMs,
  fanDeg: D.deck.fanDeg,
  settleScale: D.settle.startScale,
  settleMs: D.settle.ms,
  settleDelayMs: D.settle.delayMs,
};

const NUMERIC = Object.keys(KNOB_SPEC) as NumericKnob[];

// Every knob held to its range. A value that is not a finite number (or not a
// boolean for the toggle) falls back to the base, and keys that are not knobs
// are dropped, so a stale or hand-edited saved record cannot break the page.
export function clampKnobs(input: Partial<Record<string, unknown>>, base: DealKnobs = DEFAULT_KNOBS): DealKnobs {
  const out: DealKnobs = { ...base };
  out.riffleOn = typeof input.riffleOn === "boolean" ? input.riffleOn : base.riffleOn;
  for (const key of NUMERIC) {
    const value = input[key];
    const spec = KNOB_SPEC[key];
    out[key] = typeof value === "number" && Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : base[key];
  }
  return out;
}

// The tuning handed to the Coil's entrance (lib/coil/entrance.ts tunedConstants).
export function entranceTuningOf(knobs: DealKnobs) {
  return { durationMs: knobs.dealMs, shutterStagger: knobs.dealStagger, startOffset: knobs.startOffset };
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
