import { CLEAR_MARGIN, PHONE_MAX_WIDTH, ROUTE, type RouteShape } from "./constants";
import type { Point } from "./geometry";
import { bandLineY, bandRunPoints } from "./head";
import type { Anchors, Rect, Side, Span } from "./spine";

// The line as a serpentine: after the band's run it crosses the whole page in the clear air between blocks of words, right to left,
// then left to right, and so on down the page, and every turn between two crossings happens past the edge of the screen. The
// crossings are found on the page as measured (its words, links and headings), never placed by hand, so a page whose words move
// gets a line that moves with them. Where no gap is tall enough to cross in, the line stays off screen until the next one; it
// never runs down a margin. Behind the cards section (its field is opaque) and past the edges the line is out of sight.

// Which shape of line a window gets: a phone's (narrow and portrait, the page in one column) or a wide one's. Width decides the
// page's layout (one column below Tailwind's md, 768) and the aspect decides how the line reads on it; a window narrower than
// PHONE_MAX_WIDTH is always a phone's, whatever its height.
export const ONE_COLUMN_MAX = 768;
export type RouteKind = "phone" | "wide";
export function routeKind(width: number, viewport: number): RouteKind {
  if (width <= 0) return "wide";
  return width < PHONE_MAX_WIDTH || (width < ONE_COLUMN_MAX && viewport > width) ? "phone" : "wide";
}

// One crossing: it enters on `from` at yIn and leaves on the other side at yOut (yOut >= yIn: it never climbs as it goes), and
// keeps `clear` px from the nearest text or link. x runs from -off to width + off: past the edges, where no dot shows.
export interface Crossing { from: Side; yIn: number; yOut: number; clear: number }
export interface Route { points: Point[]; crossings: Crossing[]; off: number; kind: RouteKind }

// Everything a crossing keeps off: every block of words, every link and button, and every other line of text (a page's number and
// heading). The cards section's are left out: its field hides the line there.
function obstaclesOf(anchors: Anchors): Rect[] {
  const cards = anchors.box.cards;
  return [...anchors.blocks, ...anchors.links, ...anchors.headings].filter((r) => r.bottom <= cards.top || r.top >= cards.bottom).sort((a, b) => a.top - b.top);
}

export interface RouteOptions {
  reach: number; // the dots' farthest reach from the line, px
  clearBand: number; // px below the band's box the line's return keeps
}
// How far past an edge the line's ends and turns sit: no dot of the line shows there.
export const offOf = (opts: RouteOptions) => opts.reach + CLEAR_MARGIN + 4;

// The first crossing keeps this much lower than the band's clearance asks, so the turn off the band's run has room past the edge.
const CURVE_SLACK = 36;

// The crossings between `from` and `to` (layer px), top to bottom: each the best placed of those that start within `window` of the
// first that fits, the next one at least `gap` lower and from the other side, the first from `start`. A crossing fits when it keeps
// at least `minRoom` of the dots' reach (plus the margin) from everything it passes; it is placed for the most room, up to the dots'
// whole reach, then for the most descent across the page, up to `drop` of the width, so it travels down with the reader's scroll.
export function findCrossings(anchors: Anchors, shape: RouteShape, opts: RouteOptions, span: { from: number; to: number }, start: Side): Crossing[] {
  const W = anchors.width;
  const off = offOf(opts);
  const rects = obstaclesOf(anchors);
  const least = shape.minRoom * opts.reach + CLEAR_MARGIN;
  const full = opts.reach + CLEAR_MARGIN;
  const cards = anchors.box.cards;
  const bottom = Math.min(span.to, anchors.box.footer.top) - least;
  const maxDrop = shape.drop * W;
  const step = ROUTE.step;
  const across = W + 2 * off;
  // The nearest of `near` to the line from (-off, yL) to (W + off, yR), no farther than `full`. Every rect lies across the line's
  // x (the line runs past both edges), so it is either cut by the line or nearest it at a corner, whose distance is its height
  // off the line times the line's cosine.
  const clearance = (near: Rect[], yL: number, yR: number) => {
    const slope = (yR - yL) / across;
    const cos = 1 / Math.hypot(1, slope);
    let best = full;
    for (const r of near) {
      const a = yL + slope * (r.left + off);
      const b = yL + slope * (r.right + off);
      const above = r.top - Math.max(a, b);
      const below = Math.min(a, b) - r.bottom;
      const gap = Math.max(above, below);
      if (gap <= 0) return 0;
      best = Math.min(best, gap * cos);
      if (best < least) return best;
    }
    return best;
  };
  // The heights tried for a crossing's start: every `step` px, and the middle of every gap between the page's words (a gap barely
  // taller than a crossing needs can fall between two steps).
  const merged: Span[] = [];
  for (const r of rects) {
    const last = merged[merged.length - 1];
    if (last && r.top <= last.bottom) last.bottom = Math.max(last.bottom, r.bottom);
    else merged.push({ top: r.top, bottom: r.bottom });
  }
  const middles = merged.slice(1).map((m, k) => (merged[k].bottom + m.top) / 2);
  const heights = (from: number) => {
    const out: number[] = [];
    for (let y = from; y <= bottom; y += step) out.push(y);
    for (const m of middles) if (m >= from && m <= bottom) out.push(m);
    return out.sort((a, b) => a - b);
  };
  const crossings: Crossing[] = [];
  let from = start;
  let top = span.from;
  for (;;) {
    let first = -1;
    let best: Crossing | null = null;
    let score = -Infinity;
    for (const yIn of heights(top)) {
      if (first >= 0 && yIn > first + shape.window) break;
      const near = rects.filter((r) => r.bottom > yIn - full && r.top < yIn + maxDrop + full);
      for (let d = 0; d <= maxDrop && yIn + d <= bottom; d += step) {
        const yOut = yIn + d;
        // Behind the cards section the line is hidden: a crossing there, or one that half dips into it, would show little or nothing.
        if (yOut > cards.top - least && yIn < cards.bottom + least) break;
        const yL = from === "left" ? yIn : yOut;
        const yR = from === "left" ? yOut : yIn;
        const clear = clearance(near, yL, yR);
        if (clear < least) continue;
        if (first < 0) first = yIn;
        const s = clear + shape.descent * d;
        if (s > score) {
          score = s;
          best = { from, yIn, yOut, clear };
        }
      }
    }
    if (!best) break;
    crossings.push(best);
    top = best.yOut + shape.gap;
    from = from === "left" ? "right" : "left";
  }
  return crossings;
}

// A polyline with its corners rounded: each corner becomes a circular arc of `radius` (smaller where its legs are short), the whole
// sampled every `step` px. The corners here are all past the edges, so the line on screen is the straight legs.
export function roundedPolyline(corners: Point[], radius: number, step: number): Point[] {
  const out: Point[] = [];
  const add = (p: Point) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.01) out.push(p);
  };
  const line = (a: Point, b: Point) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k <= n; k++) add({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  };
  let from = corners[0];
  for (let i = 1; i < corners.length - 1; i++) {
    const p = corners[i];
    const a = corners[i - 1];
    const b = corners[i + 1];
    const inLen = Math.hypot(p.x - a.x, p.y - a.y);
    const outLen = Math.hypot(b.x - p.x, b.y - p.y);
    const u = { x: (p.x - a.x) / inLen, y: (p.y - a.y) / inLen };
    const v = { x: (b.x - p.x) / outLen, y: (b.y - p.y) / outLen };
    const turn = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y)));
    if (turn < 1e-3) continue;
    const half = Math.tan(turn / 2);
    const t = Math.min(radius * half, inLen / 2, outLen / 2);
    const r = t / half;
    const s = { x: p.x - u.x * t, y: p.y - u.y * t };
    const e = { x: p.x + v.x * t, y: p.y + v.y * t };
    line(from, s);
    // The arc's centre is r along the normal toward the turn.
    const side = u.x * v.y - u.y * v.x > 0 ? 1 : -1;
    const c = { x: s.x - side * u.y * r, y: s.y + side * u.x * r };
    const a0 = Math.atan2(s.y - c.y, s.x - c.x);
    const n = Math.max(2, Math.ceil((r * turn) / step));
    for (let k = 1; k <= n; k++) {
      const ang = a0 + side * (turn * k) / n;
      add({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });
    }
    from = e;
  }
  line(from, corners[corners.length - 1]);
  return out;
}

// Which side the line is on after a run of crossings that began from `start`.
const sideAfter = (crossings: Crossing[], start: Side): Side => (crossings.length % 2 ? (start === "left" ? "right" : "left") : start);

// The whole line: the band's level run, then off past the right edge, down out of sight and back in for the first crossing, and so
// on; after the last crossing it carries on past the edge and ends there.
export function serpentine(anchors: Anchors, viewport: number, opts: RouteOptions): Route {
  const kind = routeKind(anchors.width, viewport);
  const shape = ROUTE[kind];
  const W = anchors.width;
  const off = offOf(opts);
  const run = bandRunPoints(anchors, viewport);
  const line = bandLineY(anchors, viewport);
  const cards = anchors.box.cards;
  const floor = Math.max(line + 80, anchors.box.band.bottom + opts.clearBand + CURVE_SLACK);
  const above = findCrossings(anchors, shape, opts, { from: floor, to: cards.top }, "right");
  const after = findCrossings(anchors, shape, opts, { from: Math.max(floor, cards.bottom), to: Infinity }, sideAfter(above, "right"));
  const crossings = [...above, ...after];
  const turn = ROUTE.turn;
  const edge = (side: Side, by: number) => (side === "left" ? -off - by : W + off + by);
  // A crossing's height at an x: its straight line extended past its ends.
  const at = (c: Crossing, x: number) => {
    const yL = c.from === "left" ? c.yIn : c.yOut;
    const yR = c.from === "left" ? c.yOut : c.yIn;
    return yL + ((yR - yL) * (x + off)) / (W + 2 * off);
  };
  // The corners, all past an edge: off the run's end heading right, then for each crossing the turn into it and the turn out of
  // it, `turn` px past the edge it enters and the edge it leaves, each pair joined by a drop straight down out of sight.
  const runEnd = run[run.length - 1];
  let x = Math.max(runEnd.x, edge("right", 0)) + turn;
  const corners: Point[] = [runEnd, { x, y: line }];
  for (const c of crossings) {
    corners.push({ x, y: at(c, x) });
    x = edge(c.from === "left" ? "right" : "left", turn);
    corners.push({ x, y: at(c, x) });
  }
  // The line ends at its last corner, past the edge.
  const tail = roundedPolyline(corners, turn * 0.8, ROUTE.sample);
  return { points: [...run.slice(0, -1), ...tail], crossings, off, kind };
}
