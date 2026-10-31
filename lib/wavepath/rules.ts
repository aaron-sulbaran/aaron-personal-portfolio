import type { SpineSamples } from "./geometry";
import { runLength } from "./head";
export { seamCrossing } from "./serpentine";
import type { Anchors } from "./spine";

// The serpentine's rules as checks on a laid line, shared by the unit tests (lib/wavepath/serpentine.test.ts, on the fixture) and
// the end to end ones (e2e/wavepath.spec.ts, on the live page): read off the samples the page draws, never the route's bookkeeping.

// The first sample past the band's run and out of sight beyond the right edge: what follows is the serpentine's.
export function pastRun(samples: SpineSamples, width: number, reach: number) {
  let i = Math.ceil(runLength(samples, width) / samples.step);
  while (i < samples.count && samples.x[i] < width + reach) i++;
  return i;
}

// The runs of sample indices from `first` on that are in view: the spine within the dots' reach of the screen, not behind the cards
// section's field.
function runsInView(samples: SpineSamples, anchors: Anchors, reach: number, first: number): number[][] {
  const cards = anchors.box.cards;
  const out: number[][] = [];
  let run: number[] = [];
  for (let i = first; i < samples.count; i++) {
    const shown = samples.x[i] > -reach && samples.x[i] < anchors.width + reach && (samples.y[i] < cards.top || samples.y[i] > cards.bottom);
    if (shown) run.push(i);
    else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out;
}

// The line's stretches in view after the band's run, as runs of sample indices.
export const stretchesInView = (samples: SpineSamples, anchors: Anchors, reach: number): number[][] => runsInView(samples, anchors, reach, pastRun(samples, anchors.width, reach));

// Every leg of the line in view, the band's run first.
export const legsInView = (samples: SpineSamples, anchors: Anchors, reach: number): number[][] => runsInView(samples, anchors, reach, 0);

// The arc, px, from the end of each leg in view to the start of the next: the line out past an edge, round a turn and back in. The
// train is drawn this far behind the head, so while an excursion is longer than the train (plus a margin) the tail has left the
// screen before the head comes back, and the screen never shows both legs of a turn.
export function excursionsBetween(samples: SpineSamples, anchors: Anchors, reach: number): number[] {
  const legs = legsInView(samples, anchors, reach);
  return legs.slice(1).map((leg, k) => (leg[0] - legs[k][legs[k].length - 1]) * samples.step);
}

// The radius at sample i, from the turn between the chords to the samples k either side (px; Infinity on a straight).
export function radiusAt(s: SpineSamples, i: number, k = 4) {
  const ax = s.x[i] - s.x[i - k];
  const ay = s.y[i] - s.y[i - k];
  const bx = s.x[i + k] - s.x[i];
  const by = s.y[i + k] - s.y[i];
  const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  return turn < 1e-6 ? Infinity : (k * s.step) / turn;
}

// The tightest turn in view, px.
export function tightestInView(samples: SpineSamples, anchors: Anchors, reach: number) {
  let tightest = Infinity;
  for (const run of stretchesInView(samples, anchors, reach)) for (const i of run) if (i >= 4 && i < samples.count - 4) tightest = Math.min(tightest, radiusAt(samples, i));
  return tightest;
}

// The samples on a bend tighter than this radius (px) are a turn: the legs are straight or sweep wide, so only a turn comes this tight.
export const TURN_RADIUS = 120;

// The turns in view at a scroll position (layer px: the band's top at the viewport's top is 0), as sample indices: bends within the
// dots' reach of the screen, not behind the cards section's field.
export function turnsInView(samples: SpineSamples, anchors: Anchors, reach: number, scroll: number, viewport: number): number[] {
  const cards = anchors.box.cards;
  const out: number[] = [];
  for (let i = 4; i < samples.count - 4; i++) {
    const { x, y } = { x: samples.x[i], y: samples.y[i] };
    if (x <= -reach || x >= anchors.width + reach || y <= scroll - reach || y >= scroll + viewport + reach || (y >= cards.top && y <= cards.bottom)) continue;
    if (radiusAt(samples, i) < TURN_RADIUS) out.push(i);
  }
  return out;
}

// Each stretch in view as where it enters and leaves (x of its first and last samples).
export const stretchEnds = (samples: SpineSamples, anchors: Anchors, reach: number) =>
  stretchesInView(samples, anchors, reach).map((run) => ({ first: samples.x[run[0]], last: samples.x[run[run.length - 1]], top: samples.y[run[0]], bottom: samples.y[run[run.length - 1]] }));

// The most any stretch in view drops while inside the outer `share` of the width on either side, px.
export function marginDrop(samples: SpineSamples, anchors: Anchors, reach: number, share = 0.15) {
  const band = share * anchors.width;
  let worst = 0;
  for (const run of stretchesInView(samples, anchors, reach)) {
    for (const left of [true, false]) {
      const ys = run.filter((i) => (left ? samples.x[i] < band : samples.x[i] > anchors.width - band)).map((i) => samples.y[i]);
      if (ys.length) worst = Math.max(worst, Math.max(...ys) - Math.min(...ys));
    }
  }
  return worst;
}
