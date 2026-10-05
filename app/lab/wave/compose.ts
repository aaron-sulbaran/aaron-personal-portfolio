import type { SpinePoint } from "./spines";

// Composing a spine stretch by stretch. The page is eleven stretches in
// order (the band, then each gap and section down to the footer); each gets
// at most one behaviour, and the behaviours turn into ordinary page-relative
// points, so a composed spine copies out exactly like a hand-written one.
//
// Behaviours (side, reach and slope mean slightly different things per kind):
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
// their words (spines.ts), so a gap's 0 to 1 is the clear air between texts.

export const STRETCHES = ["band", "gap0", "about", "gap1", "who", "gap2", "up", "gap3", "connect", "gap4", "footer"] as const;
export type StretchKey = (typeof STRETCHES)[number];
export type Behaviour = "through" | "run" | "arc" | "gutter" | "pass";
export type Side = "left" | "right";

export interface Move {
  at: StretchKey;
  kind: Behaviour;
  side: Side;
  reach: number;
  slope: number;
  centre?: number; // 0..1 inside the stretch, default 0.5
}

export const BEHAVIOURS: { id: Behaviour; label: string }[] = [
  { id: "through", label: "Through" },
  { id: "run", label: "Run off" },
  { id: "arc", label: "Off screen" },
  { id: "gutter", label: "Gutter" },
  { id: "pass", label: "Pass" },
];

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
      const a = 0.5 - m.reach / 2;
      const b = 0.5 + m.reach / 2;
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
      const g = right ? 0.965 : 0.035;
      add(c - h, g);
      add(c + h, g);
    } else {
      add(c, right ? 0.5 + m.reach / 2 : 0.5 - m.reach / 2);
    }
  }
  return points;
}

// The authored irregular spines, as moves. Stretches left out are free air:
// the curve just carries on between its neighbours.
export const AUTHORED: { id: string; label: string; note: string; moves: Move[] }[] = [
  {
    id: "signature",
    label: "Signature line",
    note: "Starts off screen right, dives through About, leaves wide past Who I am, comes back to graze Up to now, and exits behind Connect.",
    moves: [
      { at: "band", kind: "arc", side: "right", reach: 0.14, slope: 0.6 },
      { at: "about", kind: "through", side: "left", reach: 0.72, slope: 0.7 },
      { at: "gap1", kind: "run", side: "left", reach: 0.22, slope: 0.5 },
      { at: "who", kind: "arc", side: "left", reach: 0.26, slope: 0.7 },
      { at: "gap2", kind: "pass", side: "left", reach: 0.2, slope: 0.4 },
      { at: "up", kind: "gutter", side: "right", reach: 0, slope: 0.6, centre: 0.45 },
      { at: "gap3", kind: "pass", side: "right", reach: 0.84, slope: 0.4 },
      { at: "connect", kind: "through", side: "left", reach: 0.5, slope: 0.8 },
      { at: "gap4", kind: "run", side: "left", reach: 0.18, slope: 0.6 },
    ],
  },
  {
    id: "margin",
    label: "Margin note",
    note: "Quiet at the top: a short excursion past the right edge beside About, one steep dive back through Who I am, a long absence off the left past Up to now, then back in from the left behind Connect and out to the right.",
    moves: [
      { at: "band", kind: "pass", side: "right", reach: 0.7, slope: 0.4, centre: 0.7 },
      { at: "gap0", kind: "run", side: "right", reach: 0.1, slope: 0.4 },
      { at: "about", kind: "arc", side: "right", reach: 0.08, slope: 0.5 },
      { at: "who", kind: "through", side: "left", reach: 0.6, slope: 0.8, centre: 0.55 },
      { at: "gap2", kind: "run", side: "left", reach: 0.3, slope: 0.5 },
      { at: "up", kind: "arc", side: "left", reach: 0.32, slope: 0.6 },
      { at: "connect", kind: "through", side: "right", reach: 0.62, slope: 0.75, centre: 0.55 },
      { at: "gap4", kind: "run", side: "right", reach: 0.16, slope: 0.4 },
    ],
  },
  {
    id: "bloom",
    label: "Late bloom",
    note: "Barely there early (it slips in from the left and grazes About), then grows: a long shallow crossing of Who I am, gone past Up to now, and a steep last pass through Connect.",
    moves: [
      { at: "band", kind: "arc", side: "left", reach: 0.12, slope: 0.6 },
      { at: "about", kind: "gutter", side: "left", reach: 0, slope: 0.7 },
      { at: "gap1", kind: "pass", side: "left", reach: 0.92, slope: 0.4 },
      { at: "who", kind: "through", side: "right", reach: 0.55, slope: 0.5, centre: 0.45 },
      { at: "gap2", kind: "pass", side: "right", reach: 0.8, slope: 0.4 },
      { at: "up", kind: "arc", side: "right", reach: 0.22, slope: 0.7 },
      { at: "connect", kind: "through", side: "left", reach: 0.7, slope: 0.9 },
      { at: "gap4", kind: "run", side: "left", reach: 0.2, slope: 0.5 },
    ],
  },
];

// A small seeded generator (mulberry32): the same seed always gives the same line.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenParams {
  through: number; // 0..1, how often a section is crossed through its words rather than skipped off screen
  uneven: number; // 0..1, how much arc sizes, slopes and positions vary
  offscreen: number; // 0..1, how far past the edges the line travels
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isGap = (key: string) => key.startsWith("gap");

// One candidate line: a pure function of the seed, the knobs and the page's
// stretches as an abstract, ordered list (the first and last are the ends,
// gaps sit between sections). No DOM, no clock, no Math.random: the same
// inputs always give the same moves. Rule checking (spineRules.ts) is a
// separate pure step against a measured page.
export function generateLine(seed: number, p: GenParams, stretches: readonly StretchKey[] = STRETCHES): Move[] {
  const r = rng(seed);
  const jitter = (spread: number) => (r() - 0.5) * 2 * spread * p.uneven;
  const pickSide = (): Side => (r() < 0.5 ? "left" : "right");
  const flip = (side: Side): Side => (side === "right" ? "left" : "right");
  const outReach = () => clamp(0.06 + p.offscreen * (0.12 + 0.3 * r()), 0.05, 0.45);
  const first = stretches[0];
  const last = stretches[stretches.length - 1];
  const moves: Move[] = [];

  // The opening: half the lines slip in from off screen, half start on a waypoint.
  let side = pickSide();
  if (r() < 0.55) moves.push({ at: first, kind: "arc", side, reach: outReach(), slope: 0.6 });
  else moves.push({ at: first, kind: "pass", side, reach: clamp(0.5 + jitter(0.3), 0.1, 0.9), slope: 0.4, centre: 0.65 });

  for (let i = 1; i < stretches.length - 1; i++) {
    const at = stretches[i];
    if (isGap(at)) continue;
    let move: Move;
    if (r() < p.through) {
      // Cross away from wherever the line arrives, so it never doubles back.
      side = flip(side);
      move = {
        at,
        kind: "through",
        side,
        reach: clamp(0.55 + jitter(0.3), 0.25, 0.8),
        slope: clamp(0.7 + jitter(0.3), 0.45, 0.9),
        centre: clamp(0.5 + jitter(0.15), 0.35, 0.65),
      };
    } else {
      if (r() >= 0.85) side = flip(side);
      move = { at, kind: r() < 0.9 ? "arc" : "gutter", side, reach: outReach(), slope: clamp(0.6 + jitter(0.3), 0.3, 0.9) };
    }
    // The gap before it: a run off the edge into an off-screen stretch, a
    // waypoint, or nothing.
    const gap = stretches[i - 1];
    const g = r();
    if (isGap(gap)) {
      if (move.kind === "arc" && g < 0.6) {
        moves.push({ at: gap, kind: "run", side: move.side, reach: move.reach * 0.7, slope: 0.5 });
      } else if (g < 0.45) {
        // A waypoint that leads into the next move from behind its direction
        // of travel, so the line arrives already heading the right way.
        // Before an off-screen or gutter stretch, the waypoint sits on the
        // way to that side, never across the page from it.
        const toward = move.side === "right" ? 0.75 + jitter(0.15) : 0.25 + jitter(0.15);
        const lead = move.kind === "through" ? (move.side === "right" ? 0.5 - move.reach / 2 - 0.12 : 0.5 + move.reach / 2 + 0.12) : toward;
        const x = clamp(lead, 0.05, 0.95);
        moves.push({ at: gap, kind: "pass", side: x >= 0.5 ? "right" : "left", reach: Math.abs(x - 0.5) * 2, slope: 0.4 });
      }
    }
    moves.push(move);
  }

  // The ending leaves by an edge, usually the side it is already on.
  const exit = r() < 0.8 ? side : flip(side);
  const beforeLast = stretches[stretches.length - 2];
  if (isGap(beforeLast) && r() < 0.6) moves.push({ at: beforeLast, kind: "run", side: exit, reach: outReach(), slope: 0.5 });
  else moves.push({ at: last, kind: "arc", side: exit, reach: outReach(), slope: 0.4, centre: 0.7 });
  return moves;
}

// The seeds tried after a failed one: a fixed scramble, so a seed's line is reproducible.
export function derivedSeed(seed: number, attempt: number): number {
  if (attempt === 0) return seed >>> 0;
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(attempt, 0xc2b2ae35)) >>> 0;
}
