import { dotReach } from "./columns";
import type { SpineSamples } from "./geometry";
import { HEAD_PARAMS, headTarget, runLength, tailStart, type HeadParams } from "./head";
import type { Anchors } from "./spine";
import { AMPLITUDE, PHONE_AMPLITUDE, PHONE_MAX_WIDTH, TRAIN_FADE, TRAIN_PX } from "./constants";

// Aaron's bound (round 5) was some drawn wave on screen at every 50px of scroll. Since the serpentine (2026-10-31) the line crosses
// only where the page has a gap to cross in and stays off screen past a block of words too tall to have one, and since his note on
// the turns (A33: "it's not that the wave ALWAYS has to be on screen, its movement just needs to naturally flow in and out of
// frame") the line also leaves the screen whole before it comes back (EXCURSION_MARGIN). So the screen is empty where the line
// itself has nothing on screen to show, and for the stretch the head is out of frame between one crossing and the next; never with
// the head in view.
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
// settled head). `tail` is the train's last dot; its faded end is nearly clear.
export function trainAt(samples: SpineSamples, anchors: Anchors, opts: CheckOptions, scroll: number) {
  const runLen = opts.bandRun ? runLength(samples, anchors.width) : 0;
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  const head = headTarget(opts.head, { samples, viewport: opts.viewport, scrollY: scroll, maxScrollY: maxScroll, layerTop: 0, runLen, entryY: samples.y[0] });
  const fade = (opts.train ?? 0) * TRAIN_FADE;
  const tail = opts.train === null ? 0 : tailStart(head, opts.train, fade, runLen);
  return { head, tail, fade, maxScroll };
}

// The same, with the tail where the faded end starts to show (a fifth of the way into the fade).
function frameAt(samples: SpineSamples, anchors: Anchors, opts: CheckOptions, scroll: number) {
  const { head, tail, fade, maxScroll } = trainAt(samples, anchors, opts, scroll);
  return { head, tail: opts.train === null ? 0 : tail + 0.2 * fade, maxScroll };
}

// Whether the head is out of frame at a scroll position: past an edge by more than the dots' reach, where the line goes round a turn
// and comes back, or behind the cards section.
export function headOutOfFrame(samples: SpineSamples, anchors: Anchors, opts: CheckOptions, scroll: number): boolean {
  const { head } = trainAt(samples, anchors, opts, scroll);
  const i = Math.min(samples.count - 1, Math.round(head / samples.step));
  const peek = dotReach(opts.amplitude);
  const cards = anchors.box.cards;
  return samples.x[i] <= -peek || samples.x[i] >= anchors.width + peek || (samples.y[i] >= cards.top && samples.y[i] <= cards.bottom);
}

// Whether no drawn dot is on screen at a scroll position (layer px: the band's top at the viewport's top is 0).
export function blankAt(samples: SpineSamples, anchors: Anchors, opts: CheckOptions, scroll: number): boolean {
  const width = anchors.width;
  // A spine point just past an edge still shows while its column's dots reach back (shape swing and rows).
  const peek = dotReach(opts.amplitude);
  const { head, tail } = frameAt(samples, anchors, opts, scroll);
  const last = Math.min(samples.count - 1, Math.floor(head / samples.step));
  for (let i = Math.max(0, Math.ceil(tail / samples.step)); i <= last; i++) {
    const y = samples.y[i];
    if (samples.x[i] > -peek && samples.x[i] < width + peek && y > scroll && y < scroll + opts.viewport) return false;
  }
  return true;
}

// The scroll positions, every VISIBLE_STEP px from the top to the maximum scroll, at which no drawn dot is on screen.
export function blankScrolls(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): number[] {
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  const blank: number[] = [];
  for (let scroll = 0; ; scroll = Math.min(maxScroll, scroll + VISIBLE_STEP)) {
    if (blankAt(samples, anchors, opts, scroll)) blank.push(scroll);
    if (scroll >= maxScroll) break;
  }
  return blank;
}

// The longest run of blank positions, as px of scroll, and where it starts.
export function visibility(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): VisibleReport {
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  const blank = blankScrolls(samples, anchors, opts);
  let worst = 0;
  let worstAt = 0;
  for (let i = 0; i < blank.length; ) {
    let j = i;
    while (j + 1 < blank.length && blank[j + 1] - blank[j] <= VISIBLE_STEP) j++;
    const gap = blank[j] - blank[i] + VISIBLE_STEP;
    if (gap > worst) {
      worst = gap;
      worstAt = blank[i];
    }
    i = j + 1;
  }
  return { worstGapPx: worst, atY: worstAt, positions: Math.floor(maxScroll / VISIBLE_STEP) + 2 };
}

export function endCheck(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): EndReport {
  const maxScroll = Math.max(0, anchors.box.footer.bottom - opts.viewport);
  const { head } = frameAt(samples, anchors, opts, maxScroll);
  const n = samples.count - 1;
  const endsOff = samples.x[n] < 0 || samples.x[n] > anchors.width || samples.y[n] >= anchors.box.footer.top;
  return { shortPx: Math.max(0, samples.length - head), endsOff };
}

export function checkLine(samples: SpineSamples, anchors: Anchors, opts: CheckOptions) {
  return { visible: visibility(samples, anchors, opts), end: endCheck(samples, anchors, opts) };
}
