import type { Point } from "./geometry";
import { bandRunPoints, runExit } from "./head";

// The line in page-relative terms (the lab's spines.ts and compose.ts, the
// shipped subset). A point names a section (y over its words, or its box with
// `box`) or a gap (one section's last words to the next one's first), and x
// across the page, which may leave it. It starts as the level run across the band.
// fixtures/pages.json is measureAnchors' output on the real page at 1440x900,
// 1024x768 and 390x844.
export const SECTION_KEYS = ["band", "who", "numbers", "connect", "footer"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type GapKey = "gap0" | "gap1" | "gap2" | "gap3"; // gapN lies between SECTION_KEYS[N] and SECTION_KEYS[N + 1]
export interface SpinePoint {
  at: SectionKey | GapKey;
  y: number;
  x: number;
  box?: boolean;
  dx?: number;
  dy?: number;
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
  links: Rect[];
  hairlines: number[];
  line?: number; // the band's wave line, layer px
}

export const STRETCHES = ["band", "gap0", "who", "gap1", "numbers", "gap2", "connect", "gap3", "footer"] as const;
export type StretchKey = (typeof STRETCHES)[number];
export type Behaviour = "through" | "run" | "arc" | "gutter" | "pass";
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
//   gutter:  a pass down the side gutter, grazing the column. side is which.
//   pass:    one waypoint, a plain crossing. reach is its offset from centre.
// The band and the footer are measured by their whole box, the rest by
// their words, so a gap's 0 to 1 is the clear air between texts.
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

export function composePoints(moves: Move[]): SpinePoint[] {
  const ordered = moves.slice().sort((a, b) => STRETCHES.indexOf(a.at) - STRETCHES.indexOf(b.at));
  const points: SpinePoint[] = [];
  for (const m of ordered) {
    const box = m.at === "band" || m.at === "footer" ? true : undefined;
    const c = m.centre ?? 0.5;
    const h = Math.max(0.1, Math.min(0.45, m.slope / 2));
    const right = m.side === "right";
    const add = (y: number, x: number) => points.push({ at: m.at, y: round(y), x: round(x), ...(box ? { box } : {}) });
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
      add(c - h, g);
      add(c + h, g);
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

// With a band run the line's own band stretch is replaced by the level run
// across the band (head.ts); the line starts there.
export interface ResolveOptions {
  bandRun: boolean;
  viewport: number;
}

export function resolveSpine(def: { points: SpinePoint[] }, anchors: Anchors, opts?: ResolveOptions): Point[] {
  const resolve = (p: SpinePoint) => {
    const span = spanOf(anchors, p);
    return { x: p.x * anchors.width + (p.dx ?? 0), y: span.top + p.y * (span.bottom - span.top) + (p.dy ?? 0) };
  };
  if (!opts?.bandRun) return def.points.map(resolve);
  // Points at or just under the run's line belonged to the band's own
  // stretch; the run replaces them. Points a little lower are pushed down to
  // leave the turn off the run some room.
  const line = bandRunPoints(anchors, opts.viewport)[0].y;
  const rest = def.points
    .filter((p) => p.at !== "band")
    .map(resolve)
    .filter((q) => q.y > line + 24)
    .map((q) => ({ x: q.x, y: Math.max(q.y, line + 80) }));
  return [...bandRunPoints(anchors, opts.viewport), ...runExit(anchors, opts.viewport, rest[0]), ...rest];
}

// "Signature line, reviewed, always on" (lab round 6), as the sections ship it:
// enters at the band's right end, crosses to the left margin in the gap before
// Who I am, runs down the left margin beside Who I am, crosses the numbers
// strip once steeply, runs down Connect's right gutter and leaves past the
// right edge at the footer.
export const SIGNATURE_ON_MOVES: Move[] = [
  { at: "band", kind: "arc", side: "right", reach: 0.06, slope: 0.4, centre: 0.55 },
  { at: "gap0", kind: "pass", side: "left", reach: 0.5, slope: 0.4, centre: 0.3 },
  { at: "who", kind: "gutter", side: "left", reach: 0, slope: 0.8, centre: 0.45, mid: 0.015 },
  { at: "numbers", kind: "through", side: "right", reach: 0.5, slope: 0.9, centre: 0.55, mid: 0.55 },
  { at: "connect", kind: "gutter", side: "right", reach: 0, slope: 0.6, centre: 0.5, mid: 0.955 },
  { at: "footer", kind: "arc", side: "right", reach: 0.12, slope: 0.4, centre: 0.6 },
];
export const SIGNATURE_ON: SpinePoint[] = composePoints(SIGNATURE_ON_MOVES);
