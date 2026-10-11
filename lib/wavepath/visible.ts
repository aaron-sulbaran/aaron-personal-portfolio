import { dotReach } from "./columns";
import { sampleSpine, type SpineSamples } from "./geometry";
import { HEAD_PARAMS, headTarget, runLength, tailStart, type HeadParams } from "./head";
import { resolveSpine, type Anchors, type SpinePoint } from "./spine";
import { AMPLITUDE, PHONE_AMPLITUDE, PHONE_MAX_WIDTH, SAMPLE_STEP, TRAIN_FADE, TRAIN_PX } from "./constants";

// Aaron's one hard bound (round 5): some drawn wave on screen at every 50px
// of scroll, checked on the authored line (round 6), plus the end reached at
// max scroll. The lab's other rules and its generator do not ship.
export interface CheckOptions {
  amplitude: number;
  viewport: number;
  train: number | null; // px, or null when everything behind the head stays drawn
  head: HeadParams;
  bandRun: boolean;
}
export const amplitudeFor = (width: number) => (width > 0 && width < PHONE_MAX_WIDTH ? PHONE_AMPLITUDE : AMPLITUDE);
export const visibleOptions = (width: number, viewport: number): CheckOptions => ({
  amplitude: amplitudeFor(width),
  viewport,
  train: TRAIN_PX,
  head: HEAD_PARAMS,
  bandRun: true,
});

const VISIBLE_STEP = 50; // px of scroll between the check's samples

export interface VisibleReport {
  worstGapPx: number; // the longest scroll with no drawn dot on screen (0: always visible)
  atY: number; // where it starts, scroll px
  positions: number; // scroll positions sampled
}

export interface EndReport {
  shortPx: number; // px of arc the head falls short of the line's end at the maximum scroll
  endsOff: boolean; // the line ends past an edge or at the footer
}

// Visitor-side view, assuming the visitor has decided (the band run waits
// otherwise): the head and the train where the page would draw them at each
// scroll position, ignoring the draw-speed cap (a visitor at rest sees the
// settled head).
function frameAt(samples: SpineSamples, anchors: Anchors, opts: CheckOptions, scroll: number) {
  const runLen = opts.bandRun ? runLength(samples, anchors.width) : 0;
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  const head = headTarget(opts.head, { samples, viewport: opts.viewport, scrollY: scroll, maxScrollY: maxScroll, layerTop: 0, runLen, entryY: samples.y[0] });
  const fade = (opts.train ?? 0) * TRAIN_FADE;
  const tail = opts.train === null ? 0 : tailStart(head, opts.train, fade, runLen) + 0.2 * fade;
  return { head, tail, maxScroll };
}

export function visibility(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): VisibleReport {
  const width = anchors.width;
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  let worst = 0;
  let worstAt = 0;
  let runStart = -1;
  let positions = 0;
  // The bound is some drawn dot on screen, so a spine point just past an edge
  // still shows while its column's dots reach back (shape swing and rows).
  const peek = dotReach(opts.amplitude);
  for (let scroll = 0; ; scroll = Math.min(maxScroll, scroll + VISIBLE_STEP)) {
    positions++;
    const { head, tail } = frameAt(samples, anchors, opts, scroll);
    let seen = false;
    const last = Math.min(samples.count - 1, Math.floor(head / samples.step));
    for (let i = Math.max(0, Math.ceil(tail / samples.step)); i <= last; i++) {
      const y = samples.y[i];
      if (samples.x[i] > -peek && samples.x[i] < width + peek && y > scroll && y < scroll + opts.viewport) {
        seen = true;
        break;
      }
    }
    if (!seen && runStart < 0) runStart = scroll;
    if ((seen || scroll >= maxScroll) && runStart >= 0) {
      const gap = scroll - runStart + (seen ? 0 : VISIBLE_STEP);
      if (gap > worst) {
        worst = gap;
        worstAt = runStart;
      }
      runStart = -1;
    }
    if (scroll >= maxScroll) break;
  }
  return { worstGapPx: worst, atY: worstAt, positions };
}

export function endCheck(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): EndReport {
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  const { head } = frameAt(samples, anchors, opts, maxScroll);
  const n = samples.count - 1;
  const endsOff = samples.x[n] < 0 || samples.x[n] > anchors.width || samples.y[n] >= anchors.box.footer.top;
  return { shortPx: Math.max(0, samples.length - head), endsOff };
}

export function checkLine(points: SpinePoint[], anchors: Anchors, opts: CheckOptions) {
  const samples = sampleSpine(resolveSpine({ points }, anchors, { bandRun: opts.bandRun, viewport: opts.viewport }), SAMPLE_STEP);
  return { visible: visibility(samples, anchors, opts), end: endCheck(samples, anchors, opts) };
}

// The documented fallback, at every width (390 included): the train while the
// line keeps some wave on screen at every scroll position with it, else the
// whole line stays drawn behind the head.
export function chooseTrain(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): number | null {
  return visibility(samples, anchors, opts).worstGapPx > 0 ? null : opts.train;
}
