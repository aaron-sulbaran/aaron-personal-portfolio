import { DRAW_EASE_S, DRAW_SPEED, GATE_S, HEAD_AT, HEAD_REST_PX, HEAD_SMOOTHING, RUN_PAST, RUN_SPACING, RUN_START } from "./constants";
import { arcAtY, type Point, type SpineSamples } from "./geometry";
import type { Anchors } from "./spine";

// Where the head sits for a scroll position, the band run the line starts
// with, and the train's tail: pure, shared by the engine and the rule checks,
// so the checks see exactly what the page draws.

export type HeadMode = "viewport" | "progress";

// The band's wave line: on the site, measured from the band's stage
// (`anchors.line`, the middle of [data-wave-band-line]); the lab's formula
// (stage clamp(240px, 30vh, 340px), copy 20px down) stands in for fixtures.
export function bandLineY(anchors: Anchors, viewport: number): number {
  if (anchors.line !== undefined) return anchors.line;
  const words = anchors.words.band;
  if (anchors.width < 768) return words.bottom + 36;
  const stage = Math.min(340, Math.max(240, 0.3 * viewport));
  return words.top - 20 + stage / 2;
}

// The run: level from just past the left edge to a little past the right
// edge, as points close enough together that the curve through them cannot bow.
export function bandRunPoints(anchors: Anchors, viewport: number): Point[] {
  const y = bandLineY(anchors, viewport);
  const end = anchors.width + RUN_PAST;
  const n = Math.max(2, Math.ceil((end - RUN_START) / RUN_SPACING));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: RUN_START + ((end - RUN_START) * i) / n, y }));
}

// Leaving the run: it ends a little past the right edge heading right. It
// turns toward the line's next point on a circular arc (a quarter turn at
// most, so a next point back on the page is reached by a turn past the edge,
// never an on-screen hairpin), small enough to stay above that point, so the
// line never climbs back.
export function runExit(anchors: Anchors, viewport: number, next: Point | undefined): Point[] {
  if (!next) return [];
  const end = anchors.width + RUN_PAST;
  const y = bandLineY(anchors, viewport);
  const turn = next.x > end ? Math.min(Math.PI / 2, Math.atan2(next.y - y, next.x - end)) : Math.PI / 2;
  if (turn <= 0) return [];
  const r = Math.min(Math.min(180, Math.max(90, 0.12 * anchors.width)), Math.max(30, 0.45 * (next.y - y)));
  return [1, 2, 3].map((k) => {
    const a = (turn * k) / 3;
    return { x: end + r * Math.sin(a), y: y + r - r * Math.cos(a) };
  });
}

// The run's arc length: from the line's start to where it reaches the right edge.
export function runLength(samples: SpineSamples, width: number): number {
  for (let i = 0; i < samples.count; i++) if (samples.x[i] >= width - 1) return i * samples.step;
  return 0;
}

export interface HeadParams {
  mode: HeadMode;
  headAt: number;
  preDrawn: number;
  fromBand: boolean;
}

export interface HeadFrame {
  samples: SpineSamples;
  viewport: number;
  scrollY: number; // document px
  maxScrollY: number; // document px
  layerTop: number; // the layer's document top
  runLen: number; // 0 without a band run
  entryY: number; // layer px, where the line first comes on screen
}

// The head's target at a scroll position. At the page's maximum scroll it is
// always the line's end: over the last viewport of scroll the head line is
// pulled down to the line's lowest point, so a line ending below where the
// head line can reach (the footer, past the fold) is still drawn to its end.
export function headTarget(p: HeadParams, f: HeadFrame): number {
  const { samples, viewport } = f;
  const L = samples.length;
  let line = f.scrollY + p.headAt * viewport - f.layerTop;
  if (p.fromBand) {
    const start = Math.max(0, f.layerTop + f.entryY - p.headAt * viewport);
    line = Math.min(line, f.entryY + 2 * Math.max(0, f.scrollY - start));
  }
  const yEnd = samples.yMax[samples.count - 1];
  const lineAtMax = f.maxScrollY - f.layerTop + p.headAt * viewport;
  if (yEnd > lineAtMax) {
    const ramp = Math.min(1, Math.max(0, (f.scrollY - (f.maxScrollY - viewport)) / viewport));
    line += (yEnd - lineAtMax) * ramp;
  }
  const start = f.runLen;
  if (p.mode === "progress") {
    const y0 = start > 0 ? samples.y[Math.min(samples.count - 1, Math.round(start / samples.step))] : samples.y[0];
    const progress = Math.min(1, Math.max(0, (line - y0) / Math.max(1, yEnd - y0)));
    return start + (L - start) * (p.preDrawn + (1 - p.preDrawn) * progress);
  }
  return Math.max(start, p.preDrawn * L, arcAtY(samples, line));
}

// The train's tail. Behind a band run the tail is held back until the head
// has drawn a train's length past the run's end, so the run stays drawn in
// full while it waits and nothing jumps when the head sets off.
export function tailStart(head: number, train: number, fade: number, runLen: number): number {
  const naive = head - train;
  if (runLen <= 0) return naive;
  const intrude = Math.max(0, runLen - train + fade);
  return naive - intrude * Math.min(1, Math.max(0, 1 - (head - runLen) / train));
}

export const HEAD_PARAMS: HeadParams = { mode: "viewport", headAt: HEAD_AT, preDrawn: 0, fromBand: true };

export interface HeadState {
  head: number;
  target: number;
  vel: number;
  gate: number;
  gateTarget: number;
}
export const createHead = (): HeadState => ({ head: 0, target: 0, vel: 0, gate: 0, gateTarget: 0 });

// Where the head may go: the whole line under reduced motion, the run's end
// until the visitor answers the band, else the scroll's target.
export function gatedTarget(raw: number, runLen: number, length: number, decided: boolean, still: boolean): number {
  if (still) return length;
  return decided ? raw : runLen;
}

// One step toward the target, never faster than DRAW_SPEED px of arc per
// second, the speed eased in over DRAW_EASE_S; the swell's gate relaxes over
// GATE_S. True while either still moves.
export function stepHead(h: HeadState, dt: number, still: boolean): boolean {
  if (still) {
    h.head = h.target;
    h.vel = 0;
    h.gate = 0;
    return false;
  }
  const gap = h.target - h.head;
  const want = Math.max(-DRAW_SPEED, Math.min(DRAW_SPEED, gap * HEAD_SMOOTHING));
  h.vel = Math.abs(want) > Math.abs(h.vel) ? want + (h.vel - want) * Math.exp(-dt / DRAW_EASE_S) : want;
  h.head += h.vel * dt;
  if ((gap > 0 && h.head > h.target) || (gap < 0 && h.head < h.target) || Math.abs(h.head - h.target) < HEAD_REST_PX) {
    h.head = h.target;
    h.vel = 0;
  }
  h.gate = h.gateTarget + (h.gate - h.gateTarget) * Math.exp(-dt / GATE_S);
  if (Math.abs(h.gate - h.gateTarget) < 0.01) h.gate = h.gateTarget;
  return h.head !== h.target || h.gate !== h.gateTarget;
}

// Where the line first comes on screen, layer px.
export function firstOnScreenY(samples: SpineSamples, width: number): number {
  for (let i = 0; i < samples.count; i++) if (samples.x[i] > 0 && samples.x[i] < width) return samples.y[i];
  return samples.y[0];
}

// The run's largest step off its line, px (0 for a level run).
export function runFlatness(samples: SpineSamples, runLen: number): number {
  let worst = 0;
  for (let i = 0; i * samples.step < runLen; i++) worst = Math.max(worst, Math.abs(samples.y[i] - samples.y[0]));
  return worst;
}
