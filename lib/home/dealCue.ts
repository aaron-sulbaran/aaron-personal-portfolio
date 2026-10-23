// The page's cue to the ribbon before the click (slice 4d): the pointer is over
// "Deal me in", so the row eases faster and its gaps tighten toward the button, as
// anticipation. The button writes it (components/home/IntroCta.tsx: a fine
// pointer only, never under reduced motion); the scene reads it once a frame
// (components/coil/scene/entrance.ts) and eases the effect in and out itself, so
// a hover that comes and goes is never a step. A plain module value: nothing
// renders from it.

let hovering = false;

export function setDealHover(on: boolean): void {
  hovering = on;
}

export function isDealHover(): boolean {
  return hovering;
}
