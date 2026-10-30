import { COIL } from "./constants";
import { bendLocal, cardPointToWorld, projectPoint, type Camera, type CardPose, type Vec2, type Vec3 } from "./geometry";

// Every card is its own card, in every frame of the deal (Aaron, 2026-10-29:
// "the cards should still have space between them and act as their own
// individual assets"). This measures it on poses, the scene's own (read through
// the ?coildebug hooks) or the pure modules': how close two cards come in 3D,
// whether they cut through each other, and whether two neighbors on the side of
// a ring that faces the camera overlap on screen. Depth occlusion (a card on the
// far side of a ring seen at an angle, behind one on the near side) is not
// measured: it is a picture of a ring, not cards merging.
//
// A card is its bent surface (lib/coil/geometry.ts bendLocal, as the vertex
// shader bends it) as a grid of triangles, fine enough that the chord's sag is
// under a thousandth of a card.

export type SeparationPose = Pick<CardPose, "u" | "position" | "basis" | "scale" | "bend" | "beta" | "alpha">;

const ACROSS = 16;
const DOWN = 4;
const EDGE_SAMPLES = 24;

type Vec = Vec3;
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec) => Math.hypot(a[0], a[1], a[2]);

type Mesh = { grid: Vec[]; triangles: [Vec, Vec, Vec][]; edges: [Vec, Vec][]; outline: Vec[]; center: Vec; reach: number };

const meshes = new WeakMap<SeparationPose, Mesh>();

function local(pose: SeparationPose, x: number, y: number): Vec {
  return cardPointToWorld(pose as CardPose, bendLocal(x, y, pose.bend, pose.beta));
}

function meshOf(pose: SeparationPose, aspect: number): Mesh {
  const cached = meshes.get(pose);
  if (cached) return cached;
  const hw = aspect / 2;
  const grid: Vec[] = [];
  for (let j = 0; j <= DOWN; j++) for (let i = 0; i <= ACROSS; i++) grid.push(local(pose, -hw + (aspect * i) / ACROSS, 0.5 - j / DOWN));
  const at = (i: number, j: number) => grid[j * (ACROSS + 1) + i];
  const triangles: [Vec, Vec, Vec][] = [];
  const edges: [Vec, Vec][] = [];
  for (let j = 0; j <= DOWN; j++) {
    for (let i = 0; i <= ACROSS; i++) {
      if (i < ACROSS) edges.push([at(i, j), at(i + 1, j)]);
      if (j < DOWN) edges.push([at(i, j), at(i, j + 1)]);
      if (i < ACROSS && j < DOWN) {
        triangles.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)]);
        triangles.push([at(i, j), at(i + 1, j + 1), at(i, j + 1)]);
        edges.push([at(i, j), at(i + 1, j + 1)]);
      }
    }
  }
  // The card's rim, finely sampled: where two cards that do not cut through
  // each other come closest (their facing edges, or an edge and a face).
  const outline: Vec[] = [];
  for (let k = 0; k < EDGE_SAMPLES; k++) {
    const s = k / EDGE_SAMPLES;
    outline.push(local(pose, -hw + aspect * s, 0.5), local(pose, hw - aspect * s, -0.5));
  }
  for (let k = 0; k < EDGE_SAMPLES / 2; k++) {
    const s = k / (EDGE_SAMPLES / 2);
    outline.push(local(pose, hw, 0.5 - s), local(pose, -hw, -0.5 + s));
  }
  const center = pose.position;
  const reach = Math.max(...grid.map((p) => length(sub(p, center))));
  const mesh = { grid, triangles, edges, outline, center, reach };
  meshes.set(pose, mesh);
  return mesh;
}

// The closest point of triangle abc to p, as a distance (Ericson, Real-Time
// Collision Detection 5.1.5).
function pointTriangle(p: Vec, a: Vec, b: Vec, c: Vec): number {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return length(ap);
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return length(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return length(sub(p, [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]));
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return length(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return length(sub(p, [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const bc = sub(c, b);
    return length(sub(p, [b[0] + bc[0] * w, b[1] + bc[1] * w, b[2] + bc[2] * w]));
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return length(sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}

// Segment pq crosses triangle abc (Moller and Trumbore, bounded to the segment).
function segmentCrosses(p: Vec, q: Vec, a: Vec, b: Vec, c: Vec): boolean {
  const d = sub(q, p);
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const h = cross(d, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const f = 1 / det;
  const s = sub(p, a);
  const u = f * dot(s, h);
  if (u < 0 || u > 1) return false;
  const qv = cross(s, e1);
  const v = f * dot(d, qv);
  if (v < 0 || u + v > 1) return false;
  const t = f * dot(e2, qv);
  return t > 0 && t < 1;
}

function meshDistance(points: Vec[], mesh: Mesh): number {
  let best = Infinity;
  for (const p of points) {
    // A point farther from the card's middle than its reach plus the best so far cannot improve it.
    if (length(sub(p, mesh.center)) - mesh.reach > best) continue;
    for (const [a, b, c] of mesh.triangles) best = Math.min(best, pointTriangle(p, a, b, c));
  }
  return best;
}

function cutsThrough(a: Mesh, b: Mesh): boolean {
  for (const [p, q] of a.edges) for (const [x, y, z] of b.triangles) if (segmentCrosses(p, q, x, y, z)) return true;
  return false;
}

export type PairGap = {
  // The least distance between the two cards' surfaces, as a share of the
  // narrower card's width; 0 when they cut through each other.
  gap: number;
  intersect: boolean;
};

// How far apart two cards are in 3D. Pairs whose bounding spheres are more than
// `farShare` of a card's width apart are not measured (their gap is reported as
// that much): no card's neighbor is ever that close to touching.
export function pairGap(a: SeparationPose, b: SeparationPose, aspect: number = COIL.cardAspect, farShare = 0.5): PairGap {
  const width = aspect * Math.min(a.scale, b.scale);
  const ma = meshOf(a, aspect);
  const mb = meshOf(b, aspect);
  const apart = length(sub(ma.center, mb.center)) - ma.reach - mb.reach;
  if (apart > farShare * width) return { gap: apart / width, intersect: false };
  const near = Math.min(meshDistance(ma.outline, mb), meshDistance(mb.outline, ma));
  // Two cards that cut through each other meet along a curve that ends on one's rim,
  // so a rim this far from the other card (past the rim samples' spacing) cannot.
  if (near > CLEAR_OF_CUT * Math.min(a.scale, b.scale)) return { gap: near / width, intersect: false };
  if (cutsThrough(ma, mb) || cutsThrough(mb, ma)) return { gap: 0, intersect: true };
  return { gap: near / width, intersect: false };
}

// Card heights: well over the rim samples' spacing (a twelfth of a card's height down its sides).
const CLEAR_OF_CUT = 0.12;

// ---------------------------------------------------------------- on screen

// The card's bent outline in CSS px, as drawn.
export function screenOutline(pose: SeparationPose, camera: Camera, aspect: number = COIL.cardAspect): Vec2[] {
  const hw = aspect / 2;
  const points: Vec2[] = [];
  const at = (x: number, y: number) => projectPoint(camera, local(pose, x, y));
  for (let k = 0; k < EDGE_SAMPLES; k++) points.push(at(-hw + (aspect * k) / EDGE_SAMPLES, 0.5));
  for (let k = 0; k < EDGE_SAMPLES / 2; k++) points.push(at(hw, 0.5 - k / (EDGE_SAMPLES / 2)));
  for (let k = 0; k < EDGE_SAMPLES; k++) points.push(at(hw - (aspect * k) / EDGE_SAMPLES, -0.5));
  for (let k = 0; k < EDGE_SAMPLES / 2; k++) points.push(at(-hw, -0.5 + k / (EDGE_SAMPLES / 2)));
  return points;
}

// How squarely the card's front faces the camera, at its middle: the cosine of
// the angle between its normal and the way to the camera (1 face on, 0 edge on,
// negative from behind).
export function facing(pose: SeparationPose, camera: Camera): number {
  const toCamera: Vec = sub([0, 0, camera.distance], pose.position);
  return dot(pose.basis.z, toCamera) / (length(toCamera) || 1);
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const side = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function inside(p: Vec2, polygon: Vec2[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function pointSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * ex + (p.y - a.y) * ey) / (ex * ex + ey * ey || 1)));
  return Math.hypot(a.x + ex * t - p.x, a.y + ey * t - p.y);
}

export type ScreenGap = { overlap: boolean; px: number };

// Two outlines on screen: whether they overlap, and if not, how many px apart.
export function screenGap(a: Vec2[], b: Vec2[]): ScreenGap {
  for (let i = 0; i < a.length; i++) {
    const [p, q] = [a[i], a[(i + 1) % a.length]];
    for (let j = 0; j < b.length; j++) if (segmentsCross(p, q, b[j], b[(j + 1) % b.length])) return { overlap: true, px: 0 };
  }
  if (inside(a[0], b) || inside(b[0], a)) return { overlap: true, px: 0 };
  let px = Infinity;
  for (const p of a) for (let j = 0; j < b.length; j++) px = Math.min(px, pointSegment(p, b[j], b[(j + 1) % b.length]));
  for (const p of b) for (let j = 0; j < a.length; j++) px = Math.min(px, pointSegment(p, a[j], a[(j + 1) % a.length]));
  return { overlap: false, px };
}

// ---------------------------------------------------------------- a frame

export type FrameSeparation = {
  // The least 3D gap between any two shown cards, as a share of a card's width,
  // and the pair (their strand positions).
  minGap: number;
  minGapPair: [number, number] | null;
  // Pairs of shown cards that cut through each other.
  intersections: [number, number][];
  // Neighbors on the strand (or across a closed ring's seam) that both face the
  // camera (NEAR_FACING) and overlap on screen.
  screenOverlaps: [number, number][];
  // The least on-screen gap between such neighbors, CSS px.
  minScreenPx: number;
  shown: number;
};

// The least gap between two cards, as a share of a card's width, in any frame
// of the deal: about 6 percent (Aaron's review of 2026-10-29 asked for visible
// space between every two cards; the motion brief put the floor at about 6
// percent of a card's width). The rested Coil's own neighbors are about 15
// percent apart (COIL.neighborGap along a helix that rises), so the floor only
// binds while the deal packs the cards: the condense, the curl and the ring.
export const MIN_GAP_SHARE = 0.06;

// The near side of a ring or a coil, for the on-screen check: a card whose front
// faces the camera at least this squarely (about 75 degrees from face on). A bent
// card closer to edge on than that is turning away round the silhouette, where it
// is a sliver over its neighbor's edge however far apart they are in 3D: depth
// occlusion, as on the far side of a ring.
export const NEAR_FACING = 0.25;

// Every pair of cards shown (alpha over `minAlpha`) in one frame. Neighbors are
// the cards one strand position apart, and the two ends of a closed ring of
// `cardCount` (cardCount - 1 apart), the pair the ring's seam joins.
export function frameSeparation(
  poses: readonly SeparationPose[],
  camera: Camera,
  {
    cardCount = 14,
    minAlpha = 0.02,
    aspect = COIL.cardAspect,
    nearFacing = NEAR_FACING,
  }: { cardCount?: number; minAlpha?: number; aspect?: number; nearFacing?: number } = {},
): FrameSeparation {
  const shown = poses.filter((p) => p.alpha > minAlpha).sort((a, b) => a.u - b.u);
  let minGap = Infinity;
  let minGapPair: [number, number] | null = null;
  const intersections: [number, number][] = [];
  const screenOverlaps: [number, number][] = [];
  let minScreenPx = Infinity;
  const outlines = new Map<SeparationPose, Vec2[]>();
  const outline = (p: SeparationPose) => {
    let o = outlines.get(p);
    if (!o) outlines.set(p, (o = screenOutline(p, camera, aspect)));
    return o;
  };
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const [a, b] = [shown[i], shown[j]];
      const { gap, intersect } = pairGap(a, b, aspect);
      if (gap < minGap) {
        minGap = gap;
        minGapPair = [a.u, b.u];
      }
      if (intersect) intersections.push([a.u, b.u]);
      const apart = Math.round(Math.abs(b.u - a.u));
      const neighbors = apart === 1 || apart === cardCount - 1;
      if (!neighbors || facing(a, camera) < nearFacing || facing(b, camera) < nearFacing) continue;
      const s = screenGap(outline(a), outline(b));
      if (s.overlap) screenOverlaps.push([a.u, b.u]);
      minScreenPx = Math.min(minScreenPx, s.px);
    }
  }
  return { minGap, minGapPair, intersections, screenOverlaps, minScreenPx, shown: shown.length };
}
