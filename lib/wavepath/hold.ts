import type { Press } from "./answer";

// The wave's wait after an answer. An answer to the band does not send the
// line off at once: the wave keeps the look it had before the answer (the run
// breathing, the head waiting at its end, no pluck; the music is not held, it shapes the run at once) until the band
// has scrolled away; then it is released: the line follows and the answer's ripple, kept back until now, goes out. Pure: the
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
// the ripple waits for the release. A Not now sends no ripple at all, now or
// at the release: its answer is the swell in the band, at the press
// (lib/wavepath/answer), and the held wave just waits to follow.
export function pressAnswer(hold: WaveHold, away: boolean, answer: Press = "play"): HoldResult {
  const ripple = answer === "play";
  if (away) {
    hold.on = false;
    hold.ripple = false;
    return { startRipple: ripple };
  }
  hold.on = true;
  hold.ripple = ripple;
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

// Whether the wave follows the reader. An answer is followed once its hold has ended. Scrolling the band away with no answer counts as a
// Not now, for the wave alone (Aaron, Nov 9: a reader who scrolls on without pressing anything has said no): the line trails them like
// any other. Nothing is saved and the soundtrack stays "before", so the prompt is still open, its "Music?" pill still arrives, and a
// reader who scrolls back to it finds the run waiting level, as before.
export const wavefollows = (answered: boolean, holdOn: boolean, away: boolean): boolean => (answered ? !holdOn : away);
