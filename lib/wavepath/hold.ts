// The wave's wait after an answer. An answer to the band does not send the
// line off at once: the wave keeps the look it had before the answer (the run
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
export const bandAway = (rect: { top: number; bottom: number }, viewportHeight: number, line: number): boolean => rect.bottom <= line * viewportHeight;

// A live answer press. With the band already scrolled away it behaves as a
// press always did: the ripple goes out now. Otherwise the wave is held and
// the ripple waits for the release.
export function pressAnswer(hold: WaveHold, away: boolean): HoldResult {
  if (away) {
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
