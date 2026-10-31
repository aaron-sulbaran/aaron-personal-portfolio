import { dotReach, layColumns, type PathColumns } from "./columns";
import { BAND_CLEAR_EXTRA, SAMPLE_STEP, SPACING } from "./constants";
import { sampleSpine, type SpineSamples } from "./geometry";
import { createMusic } from "./music";
import { buildPathDots, createSink, type DotFrame } from "./paint";
import { createPlucks } from "./pluck";
import { createRipple } from "./ripple";
import { serpentine, type Route } from "./serpentine";
import type { Anchors, Rect } from "./spine";
import { amplitudeFor } from "./visible";

// The line as the page lays it out: the route for the window on the measured anchors (lib/wavepath/serpentine), sampled, and set in
// columns. One place for the page (components/soundtrack/path/pathView) and for the checks that read the same line the page draws.
export interface LaidLine { amp: number; samples: SpineSamples; cols: PathColumns; route: Route }

export function layLine(anchors: Anchors, viewport: number): LaidLine {
  const amp = amplitudeFor(anchors.width);
  const reach = dotReach(amp);
  const route = serpentine(anchors, viewport, { reach, clearBand: reach + BAND_CLEAR_EXTRA });
  const samples = sampleSpine(route.points, SAMPLE_STEP);
  return { amp, samples, cols: layColumns(samples, SPACING, amp, anchors.blocks, [...anchors.links, ...anchors.headings]), route };
}

// Every dot of the whole line (x, y, radius in layer px) in a frame with the head past the line's end. "rest" is the line still
// (Not now, paused, reduced motion); "loud" is the music at its fullest with the breath and the line's idle ripple at theirs, the
// most the dots ever spread.
export type DotState = "rest" | "loud";

export function lineDots({ amp, cols }: LaidLine, state: DotState): number[] {
  const music = createMusic();
  if (state === "loud") {
    music.share = 1;
    music.bins.fill(1);
  }
  const frame: DotFrame = { head: 1e9, tail: -Infinity, train: null, runLen: 0, gate: 0, breath: state === "loud" ? 1 : 0, shimmer: 0, music, plucks: createPlucks(), ripple: createRipple(), still: state === "rest", ...(state === "loud" ? { idleGain: 1, idleClock: 3 } : {}) };
  const sink = createSink();
  buildPathDots(cols, Int32Array.from({ length: cols.count }, (_, j) => j), 0, cols.count, frame, amp, 0, -Infinity, Infinity, null, sink);
  return [...sink.muted, ...sink.accent];
}

// The rects a dot lands on: a dot is a disc, so it lands on a rect when its centre is within its radius of it.
export function dotsOn(dots: readonly number[], rects: readonly Rect[]): { rect: number; dots: number }[] {
  const hits: { rect: number; dots: number }[] = [];
  rects.forEach((r, rect) => {
    let n = 0;
    for (let k = 0; k < dots.length; k += 3) {
      const reach = Math.hypot(Math.max(r.left - dots[k], 0, dots[k] - r.right), Math.max(r.top - dots[k + 1], 0, dots[k + 1] - r.bottom));
      if (reach <= dots[k + 2]) n++;
    }
    if (n) hits.push({ rect, dots: n });
  });
  return hits;
}
