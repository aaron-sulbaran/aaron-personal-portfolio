// The switch between Commits and Tokens as one wave across the strip
// (docs/superpowers/specs/2026-10-13-metrics-wave-toolkit-design.md). Going to
// Tokens the wave runs left to right: the bars, then each figure from the top,
// then the toolkit band masks in. Going back it runs right to left: the
// figures from the last, the band masks out, then the bars. Pure; the
// orchestration (components/metrics/useWave.ts) plays what this schedules.

export type WaveDirection = "ltr" | "rtl";

export type WaveInput = {
  direction: WaveDirection;
  figures: number;
  // Between one figure's mask and the next.
  gapMs: number;
  // Between the bars and the first figure (ltr), or the band and the bars (rtl).
  offsetMs: number;
  reduced: boolean;
  // One mask's length; only the schedule's end needs it.
  maskMs?: number;
};

export type WaveSchedule = {
  direction: WaveDirection;
  // When the bars switch series.
  barsAtMs: number;
  // When each figure's mask starts, by figure index (the top figure is 0).
  figureAtMs: number[];
  // When the toolkit band's mask starts (in going to Tokens, out coming back).
  bandAtMs: number;
  // When the last mask ends, so the wave is done.
  endMs: number;
  // Reduced motion: nothing masks, everything swaps at once.
  instant: boolean;
};

export const WAVE_MASK_MS = 360;

export function waveSchedule({ direction, figures, gapMs, offsetMs, reduced, maskMs = WAVE_MASK_MS }: WaveInput): WaveSchedule {
  if (reduced) return { direction, barsAtMs: 0, figureAtMs: Array.from({ length: figures }, () => 0), bandAtMs: 0, endMs: 0, instant: true };
  const gap = Math.max(0, gapMs);
  const offset = Math.max(0, offsetMs);
  const mask = Math.max(0, maskMs);
  if (direction === "ltr") {
    const figureAtMs = Array.from({ length: figures }, (_, i) => offset + i * gap);
    const bandAtMs = offset + figures * gap;
    return { direction, barsAtMs: 0, figureAtMs, bandAtMs, endMs: bandAtMs + mask, instant: false };
  }
  const figureAtMs = Array.from({ length: figures }, (_, i) => (figures - 1 - i) * gap);
  const bandAtMs = figures * gap;
  const barsAtMs = bandAtMs + offset;
  return { direction, barsAtMs, figureAtMs, bandAtMs, endMs: Math.max(bandAtMs + mask, barsAtMs), instant: false };
}

export type WaveEvent = { name: string; atMs: number };

// The schedule's events in the order they start (a tie keeps the wave's own
// order: ltr bars, figures top down, band; rtl figures last first, band, bars).
// Also what `data-wave-order` reads on the board.
export function waveEvents(schedule: WaveSchedule): WaveEvent[] {
  const figures = schedule.figureAtMs.map((atMs, index) => ({ name: `figure-${index}`, atMs }));
  const band = { name: schedule.direction === "ltr" ? "band-in" : "band-out", atMs: schedule.bandAtMs };
  const bars = { name: "bars", atMs: schedule.barsAtMs };
  const walk = schedule.direction === "ltr" ? [bars, ...figures, band] : [...figures.reverse(), band, bars];
  return walk.map((event, index) => ({ event, index })).sort((a, b) => a.event.atMs - b.event.atMs || a.index - b.index).map((entry) => entry.event);
}
