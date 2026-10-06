// The visitor's answer to the band's question, for the lab: undecided until
// "Play it" or "Not now" (the band stand-in's buttons or the panel). Not
// stored across loads, so every load starts undecided, as a first visit does.
// No audio either way.

export type Decision = "undecided" | "play" | "decline";

let current: Decision = "undecided";
const listeners = new Set<() => void>();

export const getDecision = () => current;
export const getServerDecision = (): Decision => "undecided";

export function setDecision(next: Decision) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeDecision(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
