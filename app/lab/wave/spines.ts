import type { Point } from "./spineGeometry";

// The spines, in page-relative terms so they survive content changes and any
// width. A point names an anchor and sits inside it by fractions:
//   - a section ("band", "about", "who", "up", "connect", "footer"): y runs
//     0 to 1 over the section's WORDS (the union of its [data-wave-avoid]
//     boxes), or over the whole section box with `box: true`;
//   - a gap ("gap0" to "gap4"): y runs 0 to 1 from one section's last words
//     to the next section's first words;
//   - x runs 0 to 1 across the page (the content wrapper), and may leave it:
//     -0.1 is a tenth of the width past the left edge.
// dx and dy are px nudges, used only for the hand-drawn knot.

export const SECTION_KEYS = ["band", "about", "who", "up", "connect", "footer"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type GapKey = "gap0" | "gap1" | "gap2" | "gap3" | "gap4";

export interface SpinePoint {
  at: SectionKey | GapKey;
  y: number;
  x: number;
  box?: boolean;
  dx?: number;
  dy?: number;
}

export type SpineId = "switchback" | "knot" | "through" | "calm";

export interface SpineDef {
  id: SpineId;
  label: string;
  note: string;
  points: SpinePoint[];
}

export interface Span {
  top: number;
  bottom: number;
}

export interface Anchors {
  width: number;
  box: Record<SectionKey, Span>;
  words: Record<SectionKey, Span>;
}

// The knot beside the band: three overlapping loops, each a little left of
// the last, drawn as offsets from one centre.
const knot = (dx: number, dy: number): SpinePoint => ({ at: "band", box: true, y: 0.6, x: 0.8, dx, dy });

export const SPINES: SpineDef[] = [
  {
    id: "knot",
    label: "Knot and sweep",
    note: "The reference's character: a knot of loops beside the band, then wide sweeps that leave both edges of the screen and come back.",
    points: [
      { at: "band", box: true, y: 0.2, x: 1.1 },
      knot(30, -110),
      knot(-10, -70),
      knot(-70, -10),
      knot(-20, 60),
      knot(50, 10),
      knot(0, -50),
      knot(-90, -40),
      knot(-140, 20),
      knot(-80, 75),
      knot(-10, 40),
      { at: "gap0", y: 0.75, x: 0.35 },
      { at: "about", y: 0.55, x: -0.14 },
      { at: "gap1", y: 0.55, x: 0.45 },
      { at: "who", y: 0.5, x: 1.16 },
      { at: "gap2", y: 0.55, x: 0.5 },
      { at: "up", y: 0.45, x: -0.16 },
      { at: "gap3", y: 0.5, x: 0.5 },
      { at: "connect", y: 0.5, x: 1.14 },
      { at: "gap4", y: 0.6, x: 0.4 },
      { at: "footer", box: true, y: 1, x: -0.12 },
    ],
  },
  {
    id: "switchback",
    label: "Switchback",
    note: "Straight runs across each gap on a gentle slope; every turn happens past the screen's edge, so the wave enters from one side and leaves by the other, and never sits under a paragraph.",
    points: [
      { at: "gap0", y: 0.18, x: -0.14 },
      { at: "gap0", y: 0.5, x: 0.5 },
      { at: "gap0", y: 0.82, x: 1.14 },
      { at: "about", y: 0.3, x: 1.24 },
      { at: "about", y: 0.9, x: 1.24 },
      { at: "gap1", y: 0.18, x: 1.14 },
      { at: "gap1", y: 0.5, x: 0.5 },
      { at: "gap1", y: 0.82, x: -0.14 },
      { at: "who", y: 0.3, x: -0.24 },
      { at: "who", y: 0.9, x: -0.24 },
      { at: "gap2", y: 0.18, x: -0.14 },
      { at: "gap2", y: 0.5, x: 0.5 },
      { at: "gap2", y: 0.82, x: 1.14 },
      { at: "up", y: 0.3, x: 1.24 },
      { at: "up", y: 0.9, x: 1.24 },
      { at: "gap3", y: 0.18, x: 1.14 },
      { at: "gap3", y: 0.5, x: 0.5 },
      { at: "gap3", y: 0.82, x: -0.14 },
      { at: "connect", y: 0.3, x: -0.24 },
      { at: "connect", y: 0.9, x: -0.24 },
      { at: "gap4", y: 0.18, x: -0.14 },
      { at: "gap4", y: 0.5, x: 0.5 },
      { at: "gap4", y: 0.82, x: 1.14 },
    ],
  },
  {
    id: "through",
    label: "Through the words",
    note: "Long diagonals that pass behind every text block at an angle, the wave behind the words on purpose.",
    points: [
      { at: "band", y: 0.5, x: 1.06 },
      { at: "gap0", y: 0.5, x: 0.78 },
      { at: "about", y: 0.55, x: 0.28 },
      { at: "gap1", y: 0.5, x: 0.1 },
      { at: "who", y: 0.5, x: 0.6 },
      { at: "gap2", y: 0.55, x: 0.94 },
      { at: "up", y: 0.5, x: 0.48 },
      { at: "gap3", y: 0.5, x: 0.06 },
      { at: "connect", y: 0.5, x: 0.55 },
      { at: "footer", box: true, y: 1, x: 1.08 },
    ],
  },
  {
    id: "calm",
    label: "Calm S",
    note: "Swings between the gutters and crosses the reading column only in the gaps between sections.",
    points: [
      { at: "band", y: 0.5, x: 0.96 },
      { at: "gap0", y: 0.5, x: 0.5 },
      { at: "about", y: 0.15, x: 0.04 },
      { at: "about", y: 0.85, x: 0.04 },
      { at: "gap1", y: 0.5, x: 0.5 },
      { at: "who", y: 0.15, x: 0.96 },
      { at: "who", y: 0.85, x: 0.96 },
      { at: "gap2", y: 0.5, x: 0.5 },
      { at: "up", y: 0.15, x: 0.04 },
      { at: "up", y: 0.85, x: 0.04 },
      { at: "gap3", y: 0.5, x: 0.5 },
      { at: "connect", y: 0.15, x: 0.96 },
      { at: "connect", y: 0.85, x: 0.96 },
      { at: "gap4", y: 0.5, x: 0.5 },
      { at: "footer", box: true, y: 1, x: -0.06 },
    ],
  },
];

export function spineById(id: SpineId): SpineDef {
  return SPINES.find((s) => s.id === id) ?? SPINES[0];
}

function spanOf(anchors: Anchors, point: SpinePoint): Span {
  if (point.at.startsWith("gap")) {
    const i = Number(point.at.slice(3));
    return { top: anchors.words[SECTION_KEYS[i]].bottom, bottom: anchors.words[SECTION_KEYS[i + 1]].top };
  }
  const key = point.at as SectionKey;
  return point.box ? anchors.box[key] : anchors.words[key];
}

export function resolveSpine(def: SpineDef, anchors: Anchors): Point[] {
  return def.points.map((p) => {
    const span = spanOf(anchors, p);
    return { x: p.x * anchors.width + (p.dx ?? 0), y: span.top + p.y * (span.bottom - span.top) + (p.dy ?? 0) };
  });
}
