// The player's clock text, pure: elapsed as m:ss and what is left as -m:ss.

const whole = (seconds: number) => (Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0);

export function formatClock(seconds: number): string {
  const total = whole(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

// The time left, never negative, with its minus: "-2:31". Until the track's
// length is known (0, or not a number) it reads "-0:00" rather than a guess.
export function formatRemaining(duration: number, position: number): string {
  const left = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - Math.max(0, position)) : 0;
  return `-${formatClock(Math.ceil(left - 1e-6))}`;
}

// The seek bar's fill, 0 to 100, from the playhead.
export function progressPercent(duration: number, position: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (position / duration) * 100));
}

// A keyboard's step on the seek bar: arrows move 5 seconds, Page keys 15, and
// the result stays inside the track.
export const SEEK_STEP_S = 5;
export const SEEK_PAGE_S = 15;
export function seekBy(duration: number, position: number, delta: number): number {
  const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return Math.min(end, Math.max(0, position + delta));
}
