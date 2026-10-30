import type { Point } from "./geometry";
import { PHONE_MAX_WIDTH, RUN_PAST } from "./constants";
import { bandRunPoints, runExit } from "./head";

// The line in page-relative terms (the lab's spines.ts and compose.ts, the
// shipped subset). A point names a section (y over its words, or its box with
// `box`) or a gap (one section's last words to the next one's first), and x
// across the page, which may leave it. It starts as the level run across the band.
// fixtures/pages.json is measureAnchors' output on the real page at 1440x900,
// 1024x768 and 390x844.
export const SECTION_KEYS = ["band", "cards", "numbers", "connect", "footer"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type GapKey = "gap0" | "gap1" | "gap2" | "gap3"; // gapN lies between SECTION_KEYS[N] and SECTION_KEYS[N + 1]
export interface SpinePoint {
  at: SectionKey | GapKey;
  y: number;
  x: number;
  box?: boolean;
  dx?: number;
  dy?: number;
  // A gutter's point: x is at least the dots' reach (plus a margin) beyond the nearest text or link on that side across
  // the points of this stretch, so a gutter on a page whose words fill the width is pushed past the edge instead of onto them.
  keep?: Side;
}
export interface Span {
  top: number;
  bottom: number;
}
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface Anchors {
  width: number;
  box: Record<SectionKey, Span>;
  words: Record<SectionKey, Span>;
  blocks: Rect[]; // the ink of every [data-wave-words] block, layer px
  headings: Rect[];
  links: Rect[]; // every link and button the line must keep off, layer px
  hairlines: number[];
  line?: number; // the band's wave line, layer px
}

export const STRETCHES = ["band", "gap0", "cards", "gap1", "numbers", "gap2", "connect", "gap3", "footer"] as const;
export type StretchKey = (typeof STRETCHES)[number];
export type Behaviour = "through" | "run" | "arc" | "gutter" | "pass" | "bay";
export type Side = "left" | "right";

// The page is nine stretches in order (the band, then each gap and section
// down to the footer); each gets at most one behaviour, and the behaviours
// turn into ordinary page-relative points.
//   through: crosses the stretch's words at an angle. side is the direction
//            of travel (right means left to right); reach is the share of the
//            width it spans; slope is how much of the stretch's height it
//            drops while crossing.
//   run:     heads for one edge and leaves the screen (one point past the
//            edge). side is the exit edge; reach is how far past it.
//   arc:     the line is off screen for this stretch and comes back lower.
//            side is which edge; reach is how far past it.
//   gutter:  a pass down the side gutter, clear of the column (keep): on a page
//            whose words fill the width it lands past the edge. side is which.
//   pass:    one waypoint, a plain crossing. reach is its offset from centre.
//   bay:     comes in from past the edge, crosses the clear air of the stretch
//            as far as reach of the width and goes back out the same side: the
//            line shows where the page has room and leaves where it has none.
//            side is the edge it comes from.
// The band and the footer are measured by their whole box, the rest by
// their words (the cards section has none, so its box), so a gap's 0 to 1 is
// the clear air between texts.
export interface Move {
  at: StretchKey;
  kind: Behaviour;
  side: Side;
  reach: number;
  slope: number;
  centre?: number; // 0..1 inside the stretch, default 0.5
  mid?: number; // through: the x the crossing is centred on (default 0.5); gutter: its x
}

const round = (v: number) => Math.round(v * 1000) / 1000;

// How far past the edge (a share of the width) a bay comes in from and goes back out to: past the dots' reach, so nothing of it shows there.
const BAY_OUT = 0.2;

export function composePoints(moves: Move[]): SpinePoint[] {
  const ordered = moves.slice().sort((a, b) => STRETCHES.indexOf(a.at) - STRETCHES.indexOf(b.at));
  const points: SpinePoint[] = [];
  for (const m of ordered) {
    const box = m.at === "band" || m.at === "footer" ? true : undefined;
    const c = m.centre ?? 0.5;
    const h = Math.max(0.1, Math.min(0.45, m.slope / 2));
    const right = m.side === "right";
    const add = (y: number, x: number, keep?: Side) => points.push({ at: m.at, y: round(y), x: round(x), ...(box ? { box } : {}), ...(keep ? { keep } : {}) });
    if (m.kind === "through") {
      const a = (m.mid ?? 0.5) - m.reach / 2;
      const b = (m.mid ?? 0.5) + m.reach / 2;
      add(c - h, right ? a : b);
      add(c + h, right ? b : a);
    } else if (m.kind === "run") {
      // One point past the edge: the curve arrives from wherever the line
      // was, so a run never doubles back into a hairpin.
      add(c + h * 0.5, right ? 1 + m.reach : -m.reach);
    } else if (m.kind === "arc") {
      const out = right ? 1 + m.reach : -m.reach;
      add(c - h, out);
      add(c + h, out);
    } else if (m.kind === "gutter") {
      const g = m.mid ?? (right ? 0.965 : 0.035);
      add(c - h, g, m.side);
      add(c + h, g, m.side);
    } else if (m.kind === "bay") {
      const out = right ? 1 + BAY_OUT : -BAY_OUT;
      add(c - h, out);
      add(c, right ? 1 - m.reach : m.reach);
      add(c + h, out);
    } else {
      add(c, right ? 0.5 + m.reach / 2 : 0.5 - m.reach / 2);
    }
  }
  return points;
}

function spanOf(anchors: Anchors, point: SpinePoint): Span {
  if (point.at.startsWith("gap")) {
    const i = Number(point.at.slice(3));
    return { top: anchors.words[SECTION_KEYS[i]].bottom, bottom: anchors.words[SECTION_KEYS[i + 1]].top };
  }
  const key = point.at as SectionKey;
  return point.box ? anchors.box[key] : anchors.words[key];
}

// The curve through control points can bow a little above a flat run of them,
// so with a clearance the points sit this much deeper than the clearance asks.
const CURVE_SLACK = 36;

// With a band run the line's own band stretch is replaced by the level run
// across the band (head.ts); the line starts there.
export interface ResolveOptions {
  bandRun: boolean;
  viewport: number;
  // The wave as one line: px of clearance the line's
  // return keeps below the band's box. The line then leaves the run past the
  // right edge, drops off screen to that depth and only then turns back, so no
  // stretch of it crosses the band. Absent or 0: the line as it always was.
  clearBand?: number;
  // px a gutter's points (SpinePoint.keep) sit clear of the nearest text or link on their side. Absent or 0: the points sit where they say.
  keep?: number;
}

// The rects a gutter keeps off: every text block's ink and every link and button.
const inkOf = (anchors: Anchors): Rect[] => [...anchors.blocks, ...anchors.links];

// Each run of consecutive `keep` points of one stretch moves out together to clear every rect that its stretch of the line passes
// (the run's own height, with the clearance above and below it), so the pair stays a straight pass.
function keepClear(points: { at: string; keep?: Side; x: number; y: number }[], anchors: Anchors, clearance: number) {
  const rects = inkOf(anchors);
  for (let i = 0; i < points.length; ) {
    const { at, keep } = points[i];
    let end = i + 1;
    while (end < points.length && points[end].at === at && points[end].keep === keep) end++;
    if (keep) {
      const run = points.slice(i, end);
      const top = Math.min(...run.map((p) => p.y)) - clearance;
      const bottom = Math.max(...run.map((p) => p.y)) + clearance;
      const across = rects.filter((r) => r.bottom > top && r.top < bottom);
      if (across.length) {
        const x = keep === "right" ? Math.max(...across.map((r) => r.right)) + clearance : Math.min(...across.map((r) => r.left)) - clearance;
        for (const p of run) p.x = keep === "right" ? Math.max(p.x, x) : Math.min(p.x, x);
      }
    }
    i = end;
  }
}

export function resolveSpine(def: { points: SpinePoint[] }, anchors: Anchors, opts?: ResolveOptions): Point[] {
  const resolve = (p: SpinePoint) => {
    const span = spanOf(anchors, p);
    return { at: p.at as string, keep: p.keep, x: p.x * anchors.width + (p.dx ?? 0), y: span.top + p.y * (span.bottom - span.top) + (p.dy ?? 0) };
  };
  const plain = (q: { x: number; y: number }): Point => ({ x: q.x, y: q.y });
  if (!opts?.bandRun) {
    const all = def.points.map(resolve);
    if (opts?.keep) keepClear(all, anchors, opts.keep);
    return all.map(plain);
  }
  // Points at or just under the run's line belonged to the band's own
  // stretch; the run replaces them. Points a little lower are pushed down to
  // leave the turn off the run some room.
  const line = bandRunPoints(anchors, opts.viewport)[0].y;
  const floor = opts.clearBand ? Math.max(line + 80, anchors.box.band.bottom + opts.clearBand + CURVE_SLACK) : line + 80;
  const placed = def.points
    .filter((p) => p.at !== "band")
    .map(resolve)
    .filter((q) => q.y > line + 24)
    .map((q) => ({ ...q, y: Math.max(q.y, floor) }));
  if (opts.keep) keepClear(placed, anchors, opts.keep);
  const rest = placed.map(plain);
  const exit = runExit(anchors, opts.viewport, rest[0]);
  // A quarter turn ends heading straight down past the right edge: carry on down, off screen, to the clearance before turning back.
  const last = exit[exit.length - 1];
  const drop = opts.clearBand && last && rest[0].x <= anchors.width + RUN_PAST && last.y < floor ? [{ x: last.x, y: floor }] : [];
  return [...bandRunPoints(anchors, opts.viewport), ...exit, ...drop, ...rest];
}

// "Signature line, reviewed, always on" (lab round 6), as the hero rework ships
// it: leaves the band at its right end and comes back down the right gutter
// beside the fork, dives into the cards section (the shader is opaque, so the
// line is hidden behind it for the whole section) and comes out of its bottom
// edge heading left, sweeps back across the numbers strip's clear top and runs
// down its right gutter, runs down Connect's right gutter and leaves past the
// right edge at the footer. The cards section has no words: its box is its span.
// A gutter keeps clear of the words and links beside it (SpinePoint.keep), so it
// never lands on them: where the page's words stop short of the edge it is the
// right gutter, and where they run to it (a phone) it is pushed to the edge.
export const SIGNATURE_ON_MOVES: Move[] = [
  { at: "band", kind: "arc", side: "right", reach: 0.06, slope: 0.4, centre: 0.55 },
  { at: "gap0", kind: "gutter", side: "right", reach: 0, slope: 0.6, centre: 0.5, mid: 0.955 },
  { at: "cards", kind: "through", side: "left", reach: 0.3, slope: 0.9, centre: 0.5, mid: 0.6 },
  { at: "numbers", kind: "gutter", side: "right", reach: 0, slope: 0.9, centre: 0.55, mid: 0.955 },
  { at: "connect", kind: "gutter", side: "right", reach: 0, slope: 0.6, centre: 0.5, mid: 0.955 },
  { at: "footer", kind: "arc", side: "right", reach: 0.12, slope: 0.4, centre: 0.6 },
];
export const SIGNATURE_ON: SpinePoint[] = composePoints(SIGNATURE_ON_MOVES);

// A phone's words and links fill the width, so beside them the line is only ever past the edge: the gutters above land there
// (the line peeks in at the edge), and where the page has clear air between sections the line comes in across it and goes back out.
export const SIGNATURE_PHONE_MOVES: Move[] = [
  ...SIGNATURE_ON_MOVES.filter((m) => m.at !== "numbers" && m.at !== "connect"),
  { at: "numbers", kind: "gutter", side: "right", reach: 0, slope: 0.9, centre: 0.55, mid: 0.955 },
  { at: "gap2", kind: "bay", side: "right", reach: 0.7, slope: 0.7, centre: 0.5 },
  { at: "connect", kind: "gutter", side: "right", reach: 0, slope: 0.6, centre: 0.5, mid: 0.955 },
];
export const SIGNATURE_PHONE: SpinePoint[] = composePoints(SIGNATURE_PHONE_MOVES);

// The line for a page of this width.
export const signatureFor = (width: number): SpinePoint[] => (width > 0 && width < PHONE_MAX_WIDTH ? SIGNATURE_PHONE : SIGNATURE_ON);
