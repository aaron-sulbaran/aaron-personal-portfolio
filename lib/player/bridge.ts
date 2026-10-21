import { useSyncExternalStore } from "react";
import type { CreditMode } from "./settings";

// The few things the lab changes in the real band and pill, as a tiny store:
// the band and the pill read it, and in production nothing ever writes it, so
// they read today's values. "auto" is the pill's own rule (it appears once the
// band is passed); "hold" shows it now; "away" keeps it hidden while the lab's
// own surface stands in its place. `creditBelow` takes the band's credit line
// out of its row, because the lab's card is open over the band's lower right
// and carries the line as a caption under itself.

export type PillHold = "auto" | "hold" | "away";

export interface PlayerBridge {
  pill: PillHold;
  credit: CreditMode;
  creditBelow: boolean;
}

export const TODAY: PlayerBridge = { pill: "auto", credit: "band", creditBelow: false };

let bridge: PlayerBridge = TODAY;
const listeners = new Set<() => void>();

export function setBridge(patch: Partial<PlayerBridge>): void {
  const next = { ...bridge, ...patch };
  if (next.pill === bridge.pill && next.credit === bridge.credit && next.creditBelow === bridge.creditBelow) return;
  bridge = next;
  listeners.forEach((listener) => listener());
}

export function resetBridge(): void {
  setBridge(TODAY);
}

export const subscribeBridge = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function usePlayerBridge(): PlayerBridge {
  return useSyncExternalStore(subscribeBridge, () => bridge, () => TODAY);
}

export function pillReached(pill: PillHold, passed: boolean): boolean {
  if (pill === "hold") return true;
  if (pill === "away") return false;
  return passed;
}
