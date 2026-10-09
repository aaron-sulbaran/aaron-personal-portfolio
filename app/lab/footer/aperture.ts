import { clipHalfPlane, rect, type Contour, type Pt } from "./primitives";

// The period as a shutter, pure: a square of three or four blades meeting
// at a pivot. Each blade is the wedge between two cuts (rays from the pivot
// to fixed points on the square's edge, set off the midlines so the blades
// turn like a pinwheel), moved in from both cuts by half the gap. Moving the
// pivot widens some blades and narrows the others. A blade is drawn as two
// convex halves split at its bisector and overlapping by a hair, so a wide
// blade stays whole and one nonzero fill shows no seam inside it.

export type Pivot = { x: number; y: number }; // -1 to 1 on a disc: 0 is rest at the center, 1 is the full reach

// How far the pivot can leave the center, as a share of the side.
export const APERTURE_REACH = 0.26;

const CUTS: Record<3 | 4, readonly Pt[]> = {
  3: [
    [0.55, 0],
    [1, 0.85],
    [0, 0.7],
  ],
  4: [
    [0.75, 0],
    [1, 0.75],
    [0.25, 1],
    [0, 0.25],
  ],
};

const UNIT = rect(0, 0, 1, 1);
const OVERLAP = 0.002;

export function pivotPoint(pivot: Pivot): Pt {
  const r = Math.hypot(pivot.x, pivot.y);
  const k = r > 1 ? 1 / r : 1;
  return [0.5 + pivot.x * k * APERTURE_REACH, 0.5 + pivot.y * k * APERTURE_REACH];
}

// The half-plane on the counterclockwise side of the ray from p at angle
// `deg`, moved off the ray by `inset`, as clipHalfPlane takes it.
function leftOf(p: Pt, deg: number, inset: number): [number, number, number] {
  const nx = -Math.sin((deg * Math.PI) / 180);
  const ny = Math.cos((deg * Math.PI) / 180);
  return [nx, ny, nx * p[0] + ny * p[1] + inset];
}

function rightOf(p: Pt, deg: number, inset: number): [number, number, number] {
  const [nx, ny, k] = leftOf(p, deg, -inset);
  return [-nx, -ny, -k];
}

// The blades in the unit square, y up, each a list of convex pieces.
export function apertureBlades(blades: 3 | 4, gap: number, pivot: Pivot): Contour[] {
  const p = pivotPoint(pivot);
  const cuts = CUTS[blades].map(([x, y]) => (Math.atan2(y - p[1], x - p[0]) * 180) / Math.PI);
  const half = Math.max(0, gap) / 2;
  const pieces: Contour[] = [];
  cuts.forEach((a, i) => {
    const b = cuts[(i + 1) % cuts.length];
    const span = (((b - a) % 360) + 360) % 360;
    const mid = a + span / 2;
    const first = clipHalfPlane(clipHalfPlane(UNIT, ...leftOf(p, a, half)), ...rightOf(p, mid + OVERLAP * 90, 0));
    const second = clipHalfPlane(clipHalfPlane(UNIT, ...leftOf(p, mid - OVERLAP * 90, 0)), ...rightOf(p, b, half));
    for (const piece of [first, second]) if (piece.length >= 3) pieces.push(piece);
  });
  return pieces;
}

// The blades placed in a box: x0 to x0 + w across, y0 to y0 + h up.
export function placeBlades(pieces: readonly Contour[], x0: number, y0: number, w: number, h: number): Contour[] {
  return pieces.map((c) => c.map(([x, y]) => [x0 + x * w, y0 + y * h] as Pt));
}
