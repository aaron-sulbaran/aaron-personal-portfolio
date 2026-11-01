import layout from "./fixtures/layout.json";
import { dotReach } from "./columns";
import { RELEASE_LINE, TRAIN_FADE } from "./constants";
import { bandAway } from "./hold";
import { HEAD_PARAMS, createHead, firstOnScreenY, gatedTarget, headTarget, runLength, stepHead, tailStart } from "./head";
import { calmSpeed, headCap, type InkFrame } from "./pace";
import { layLine } from "./line";
import { stretchesInView } from "./rules";
import { visibleOptions } from "./visible";
import type { Anchors } from "./spine";

// A reader scrolling the page at a steady speed, with the head stepped the way the conductor steps it (60 frames a second, the
// target from the scroll, gated until the band has scrolled away), read off the fixture's measured pages. The checks and the
// report in lib/wavepath/pace.test.ts read the frames; nothing here is drawn.
export type Size = keyof typeof layout;
export const SIZES = Object.keys(layout) as Size[];
const DT = 1 / 60;

export interface Frame {
  t: number;
  scroll: number; // layer px: the band's top at the viewport's top is 0
  head: number;
  target: number;
  vel: number; // px of arc per second
  onScreen: boolean; // the head's dots are inside the viewport, across the width, and not behind the cards section's field
}

export interface Page {
  size: Size;
  anchors: Anchors;
  viewport: number;
  width: number;
  maxScroll: number;
  laid: ReturnType<typeof layLine>;
  runLen: number;
}

export function pageAt(size: Size): Page {
  const { anchors, viewport } = layout[size] as { anchors: unknown; viewport: number };
  const a = anchors as Anchors;
  const laid = layLine(a, viewport);
  return { size, anchors: a, viewport, width: a.width, maxScroll: a.box.footer.bottom - viewport, laid, runLen: runLength(laid.samples, a.width) };
}

export interface SteadyOptions {
  speed: number; // px of scroll per second
  stopAt?: number; // scroll px where the reader stops; the page's end by default
  settleS?: number; // seconds simulated after the reader stops
}

export function steadyScroll(page: Page, opts: SteadyOptions): Frame[] {
  const { anchors, viewport, width, maxScroll, laid, runLen } = page;
  const s = laid.samples;
  const entryY = firstOnScreenY(s, width);
  const end = Math.min(opts.stopAt ?? maxScroll, maxScroll);
  const targetAt = (scroll: number) => {
    const away = bandAway({ top: anchors.box.band.top - scroll, bottom: anchors.box.band.bottom - scroll }, viewport, RELEASE_LINE);
    const raw = headTarget(HEAD_PARAMS, { samples: s, viewport, scrollY: scroll, maxScrollY: maxScroll, layerTop: 0, runLen, entryY });
    return gatedTarget(raw, runLen, s.length, away, false);
  };
  const h = createHead();
  h.target = h.head = targetAt(0);
  const reach = dotReach(page.laid.amp);
  const train = visibleOptions(width, viewport).train ?? 0;
  const calm = calmSpeed(laid.route.kind, width);
  const frames: Frame[] = [];
  let t = 0;
  let scroll = 0;
  let settled = 0;
  for (let n = 0; n < 60 * 120; n++) {
    h.target = targetAt(scroll);
    const ink: InkFrame = { samples: s, head: h.head, tail: tailStart(h.head, train, train * TRAIN_FADE, runLen), train, width, viewTop: scroll, viewHeight: viewport, amplitude: laid.amp, cards: anchors.box.cards, dt: DT };
    h.cap = headCap(calm, ink);
    const moving = stepHead(h, DT, false);
    const i = Math.min(s.count - 1, Math.round(h.head / s.step));
    const cards = anchors.box.cards;
    const onScreen = s.x[i] > -reach && s.x[i] < width + reach && s.y[i] > scroll - reach && s.y[i] < scroll + viewport + reach && !(s.y[i] >= cards.top && s.y[i] <= cards.bottom);
    frames.push({ t, scroll, head: h.head, target: h.target, vel: h.vel, onScreen });
    t += DT;
    if (scroll < end) scroll = Math.min(end, scroll + opts.speed * DT);
    else if (!moving) break;
    else if ((settled += DT) > (opts.settleS ?? 30)) break;
  }
  return frames;
}

export interface CrossingTime {
  index: number;
  seam: boolean; // the crossing nearest page 4's top edge
  seconds: number | null; // how long the reader watches the head take to draw the screen's width; null when the crossing went by unwatched
  seen: number; // the share of that stretch of line the head drew inside the viewport
}

// How long the head takes to draw each crossing from one edge of the screen to the other, at the pace the reader watches it: the
// time it spent drawing the part of the stretch that was inside the viewport, scaled up to the whole width. A crossing the reader
// scrolled past before the head drew it (seen under a quarter) was never watched, so it has no time to report.
export function crossingTimes(page: Page, frames: Frame[]): CrossingTime[] {
  const { laid, anchors, width, viewport } = page;
  const s = laid.samples;
  const reach = dotReach(laid.amp);
  const mid = (c: { yIn: number; yOut: number }) => (c.yIn + c.yOut) / 2;
  const seamIndex = laid.route.crossings.reduce((best, c, k, all) => (Math.abs(mid(c) - anchors.box.connect.top) < Math.abs(mid(all[best]) - anchors.box.connect.top) ? k : best), 0);
  return stretchesInView(s, anchors, reach).map((run, index) => {
    const across = run.filter((i) => s.x[i] > 0 && s.x[i] < width);
    const from = across[0] * s.step;
    const to = across[across.length - 1] * s.step;
    let seenArc = 0;
    let seenS = 0;
    for (let k = 1; k < frames.length; k++) {
      const f = frames[k];
      const a = Math.max(from, frames[k - 1].head);
      const b = Math.min(to, f.head);
      if (b <= a) continue;
      const i = Math.round((a + b) / 2 / s.step);
      if (s.y[i] > f.scroll && s.y[i] < f.scroll + viewport) {
        seenArc += b - a;
        seenS += frames[k].t - frames[k - 1].t;
      }
    }
    const seen = seenArc / Math.max(1, to - from);
    return { index, seam: index === seamIndex, seconds: seen >= 0.25 ? seenS / seen : null, seen };
  });
}
