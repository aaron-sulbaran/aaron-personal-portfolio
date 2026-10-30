// The wave path's QA surface, only with `wavedebug` in the URL (query, or
// after the hash): window.__wavePath. ripple is the answer's crest height now (0 when none). freeze(on) is the
// reader's "Freeze the wave" without the pill's or the player's button. Without it pathProbe() is null and every
// caller pays one null check.
import { setFrozen } from "@/lib/waveform/freeze";
import type { Anchors } from "./spine";

export type ProbeFrame = { head: number; target: number; length: number; runLen: number; train: number | null; decided: boolean; gated: boolean; idle: number; runFlat: number; ripple: number };
// layout: what the page was last laid out on, in layer px (origin: the band's document top, the root's left): the measured anchors and the
// viewport's height, so a check can lay the same line on the same page.
export type ProbeLayout = { anchors: Anchors; viewport: number; origin: number };
export interface PathProbe { paints: number; ticks: number; layouts: number; layout: ProbeLayout | null; frame: () => ProbeFrame | null; visibleDots: () => number; freeze: (on: boolean) => void }
type Read = { frame: () => ProbeFrame; visibleDots: () => number };

let probe: PathProbe | null | undefined;
let read: Read | null = null;

export function pathProbe(): PathProbe | null {
  if (probe !== undefined) return probe;
  if (typeof window === "undefined" || !/wavedebug/.test(window.location.search + window.location.hash)) return (probe = null);
  probe = { paints: 0, ticks: 0, layouts: 0, layout: null, frame: () => read?.frame() ?? null, visibleDots: () => read?.visibleDots() ?? 0, freeze: setFrozen };
  (window as unknown as { __wavePath: PathProbe }).__wavePath = probe;
  return probe;
}

export function attachProbe(next: Read): () => void {
  if (!pathProbe()) return () => {};
  read = next;
  return () => {
    if (read === next) read = null;
  };
}
