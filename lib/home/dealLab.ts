import { DEAL_LAB_KEY } from "@/lib/home/introLabKey";
import { clampKnobs, getKnobs, setKnobs, type DealKnobs, type NumericKnob } from "@/lib/home/dealKnobs";

// What the deal's lab saves and shares: the knobs this page still has (the
// cards' flight, the section's opening, the columns' arrival; the deck, the
// riffle, the name's settle and the glow went with the redesign and their knobs
// wait in lib/home/dealKnobs.ts for the slice that removes or reuses them), the
// localStorage record they persist in, and how a page picks it up. Shared by
// the Deal lab chip (components/home/DealLab.tsx) and the hero lab
// (/lab/hero), whose frames read the same record.

export const DEAL_LAB_KNOBS: readonly NumericKnob[] = ["dealMs", "dealStagger", "startOffset", "openReach", "openMs", "columnsDelayMs", "columnsStaggerMs"];

export function dealLabValues(knobs: DealKnobs): Record<string, number> {
  return Object.fromEntries(DEAL_LAB_KNOBS.map((key) => [key, knobs[key]]));
}

export function readStoredDealKnobs(): Partial<DealKnobs> | null {
  try {
    const raw = window.localStorage.getItem(DEAL_LAB_KEY);
    return raw ? (JSON.parse(raw) as Partial<DealKnobs>) : null;
  } catch {
    return null;
  }
}

export function writeStoredDealKnobs(values: Partial<DealKnobs>): void {
  try {
    window.localStorage.setItem(DEAL_LAB_KEY, JSON.stringify(values));
  } catch {
    // Storage blocked: the panel still works for this visit.
  }
}

// Applies the saved record to this page's store (dev only: setKnobs is a no-op in production).
export function applyStoredDealKnobs(): void {
  const stored = readStoredDealKnobs();
  if (stored) setKnobs(clampKnobs(stored, getKnobs()));
}
