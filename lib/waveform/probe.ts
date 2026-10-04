// The wave's QA surface, created only when the URL carries `wavedebug` (as a
// query, `/?wavedebug#about`, or after the fragment, `/#about?wavedebug`) and
// exposed as `window.__waveProbe`. Without the flag `waveProbe()` returns null
// and every caller's per-frame cost is one null check; nothing is written.
// For a deep link the query must precede the hash: `/#about?wavedebug` makes
// the fragment `about?wavedebug`, which no element matches, so it lands at the top.
//
// The horizon view registers its readers once (`attachWaveSource`) and bumps
// `horizonPaints` per paint; the readers build their answers only when called.
// The sweep trigger counts itself in and out (`countSweepTrigger`), so a
// trigger leaked by a remount shows up as a count above one.

export type WaveProbe = {
  sweep: () => number;
  horizonPaints: number; // incremented by the horizon view's paint
  strip: () => { top: number; bottom: number; baseline: number } | null; // viewport px
  columns: () => { x: number; duck: number; alpha: number }[]; // last painted frame, horizon
  rects: () => { left: number; right: number; top: number; bottom: number }[]; // the horizon's padded avoid boxes, document px
  triggers: () => number; // live sweep ScrollTriggers on #listen
};

export type WaveSource = Pick<WaveProbe, "sweep" | "strip" | "columns" | "rects">;

declare global {
  interface Window {
    __waveProbe?: WaveProbe;
  }
}

let probe: WaveProbe | null | undefined;
let source: WaveSource | null = null;
let liveTriggers = 0;

const flagged = () => /wavedebug/.test(window.location.search) || /wavedebug/.test(window.location.hash);

export function waveProbe(): WaveProbe | null {
  if (probe !== undefined) return probe;
  if (typeof window === "undefined" || !flagged()) return (probe = null);
  probe = {
    sweep: () => source?.sweep() ?? 0,
    horizonPaints: 0,
    strip: () => source?.strip() ?? null,
    columns: () => source?.columns() ?? [],
    rects: () => source?.rects() ?? [],
    triggers: () => liveTriggers,
  };
  window.__waveProbe = probe;
  return probe;
}

// Returns the detach; a stale source never clears a newer one.
export function attachWaveSource(next: WaveSource): () => void {
  if (!waveProbe()) return () => {};
  source = next;
  return () => {
    if (source === next) source = null;
  };
}

// +1 when the sweep trigger is created, -1 when it is killed.
export function countSweepTrigger(delta: 1 | -1): void {
  if (waveProbe()) liveTriggers += delta;
}
