// The band's answer in this lab: undecided until "Play it" or "Not now". The
// wave (when it loads) mirrors it into the wave lab's own store, so its line
// waits at the band as it does there. Never stored; no audio either way.

export type BandDecision = "undecided" | "play" | "decline";

let current: BandDecision = "undecided";
const listeners = new Set<() => void>();

export const getBandDecision = () => current;
export const getServerBandDecision = (): BandDecision => "undecided";

export function setBandDecision(next: BandDecision) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeBandDecision(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
