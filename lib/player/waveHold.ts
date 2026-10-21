import { zoneOf } from "./zone";

// The wave's wait after an answer (the lab's Wave after the answer: waits).
// Today an answer to the band sends a ripple along the line at once and the
// line starts to follow the scroll, even while the visitor is still looking at
// the band. Held, the wave keeps the look it had before the answer (the run
// breathing, the head waiting at its end, no music, no pluck) until the band
// has scrolled away; then it is released: the line follows, the music shapes
// it, and the answer's ripple, kept back until now, goes out. Pure: the
// conductor owns one state and feeds it presses and scroll checks.

export interface WaveHold {
  on: boolean;
  ripple: boolean; // a ripple was kept back for the release
}

export const createWaveHold = (): WaveHold => ({ on: false, ripple: false });

export interface HoldResult {
  startRipple: boolean; // send the answer's ripple now
}

// Whether the band is scrolled away: its bottom edge is above `line` of the viewport's height.
export const bandAway = (rect: { top: number; bottom: number }, viewportHeight: number, line: number): boolean => zoneOf(rect, viewportHeight, line) === "past";

// A live answer press. With no wait (production, or the lab off), or with the
// band already scrolled away, it behaves as it always has: the ripple goes out
// now. Otherwise the wave is held and the ripple waits for the release.
export function pressAnswer(hold: WaveHold, wait: number | null, away: boolean): HoldResult {
  if (wait === null || away) {
    hold.on = false;
    hold.ripple = false;
    return { startRipple: true };
  }
  hold.on = true;
  hold.ripple = true;
  return { startRipple: false };
}

// A scroll or a resize while held: released once the band is away. The kept
// ripple is handed back with the release, and never twice.
export function checkRelease(hold: WaveHold, away: boolean): { released: boolean; startRipple: boolean } {
  if (!hold.on || !away) return { released: false, startRipple: false };
  const startRipple = hold.ripple;
  hold.on = false;
  hold.ripple = false;
  return { released: true, startRipple };
}

// The wait was switched off (the lab closed, or the option changed): release
// without a ripple, because nothing was answered then.
export function dropHold(hold: WaveHold): boolean {
  const was = hold.on;
  hold.on = false;
  hold.ripple = false;
  return was;
}
