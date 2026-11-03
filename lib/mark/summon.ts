import { MODAL_DISMISS_HOLD, MODAL_DISMISS_RAMP } from "@/lib/modal";

// Asking for the logo's easter egg from somewhere other than the logo (the This
// site card's "Show me one"). The logo plays it as it plays a hold: it charges,
// discharges, and its card opens with the strike (components/mark/MarkTrigger),
// so there is one path to the egg and the card that asks is not part of it. The
// ask waits for the card that is closing to be gone, its frost held and then
// cleared (lib/modal), so the logo is seen, and a second ask while one waits is
// the same ask. Nothing is listening where the logo is not mounted.
export const SUMMON_AFTER_MS = Math.round((MODAL_DISMISS_HOLD + MODAL_DISMISS_RAMP) * 1000);

const listeners = new Set<() => void>();
let waiting: ReturnType<typeof setTimeout> | null = null;

export function summonMarkCard(): void {
  if (waiting !== null) return;
  waiting = setTimeout(() => {
    waiting = null;
    listeners.forEach((listener) => listener());
  }, SUMMON_AFTER_MS);
}

// The logo listens for as long as it is mounted.
export function onMarkSummon(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
