import { COIL, type CoilConstants } from "./constants";
import { helixRotation, type CoilGeometry, type HelixFrame, type Vec3 } from "./geometry";

// The first screen's ribbon (slice 4c): the 14 cards in one flat row, face up,
// drifting under the paragraphs, and what becomes of it at the click. It is
// the same strand as the wheel, the band and the helix, so one scalar, the
// strand's offset s in cards, moves all of them; the row is just the ring with
// its curvature taken away. A ring of angStep a and radius r = pitch / a
// poses a card at u on a circle; as a goes to 0 the circle is a line, and
// keeping the card at u = 0 where it is (the center moves back by r) the cards
// lie in a flat row, each `pitch` card heights from the next. That is the
// whole layout: a frame-level modifier (ribbonHelix, pure), no card of its own.
//
// The drift is a card rate (ribbonCardsPerSecond), so the strand has one
// speed across the changes of layout: the pitch changes as the gaps condense,
// and the same cards per second is then fewer pixels per second, never a
// step. The row moves left; the spin-up that follows starts from this speed
// (lib/coil/dealSpeed.ts), so the click does not step either.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// The row's pitch before the click, in card heights: the card's width and the gap.
export function ribbonPitchUnits(geo: CoilGeometry): number {
  return COIL.cardAspect + geo.ribbon.gapPx / geo.ribbon.cardPx;
}

// The closest the gaps condense to: the ring's own pitch, or wider where the
// canvas is so wide that the row's wrap, cardCount cards on, would show.
export function ribbonCondensedPitch(geo: CoilGeometry): number {
  const wrap = (geo.canvas.width + 2 * geo.ribbon.cardPx * COIL.cardAspect) / (geo.cardCount * geo.ribbon.cardPx);
  return Math.max(geo.step, wrap);
}

// The strand's speed while the ribbon drifts, in cards per second: negative, the
// row moves left (the strand's offset falls).
export function ribbonCardsPerSecond(geo: CoilGeometry, c: CoilConstants = COIL): number {
  const pitchPx = ribbonPitchUnits(geo) * geo.ribbon.cardPx;
  return -c.deal.ribbon.speedPxPerS / Math.max(1, pitchPx);
}

// The row's center in world units: the middle of the canvas across, the
// anchor's share of the canvas's height down.
export function ribbonAnchor(geo: CoilGeometry): Vec3 {
  const perPx = geo.camera.worldPerPx;
  return [0, (0.5 - geo.ribbon.anchorY) * geo.canvas.height * perPx, 0];
}

// The ribbon's frame at `gather` (0 the row as it drifts, 1 its gaps closed and
// the row gathered to the middle) and `curl` (0 flat, 1 the wheel): `wheel` is
// the frame the ring has at curl 1 (the wheel, or what it has become), and the
// frame is exactly that at curl 1. The cards keep their size through the
// gathering, then shrink to the wheel's as the row curls.
export function ribbonHelix(wheel: HelixFrame, geo: CoilGeometry, gather: number, curl: number): HelixFrame {
  if (curl >= 1) return wheel;
  const g = clamp01(gather);
  const k = clamp01(curl);
  const pitch = lerp(lerp(ribbonPitchUnits(geo), ribbonCondensedPitch(geo), g), geo.step, k);
  const angStep = Math.max(1e-5, wheel.angStep * k);
  const radius = pitch / angStep;
  const leanRad = lerp(0, wheel.leanRad, k);
  const cardWorld = lerp(geo.ribbon.cardWorld, wheel.cardWorld, k);
  // The card at u = 0 sits at the row's anchor, and glides to the wheel's near
  // side as the ring forms; the ring's center is behind it by the radius.
  const wheelFront = add(wheel.center, scale(helixRotation(wheel).z, wheel.radius * wheel.cardWorld));
  const front = mix3(ribbonAnchor(geo), wheelFront, k);
  const back = scale(helixRotation({ ...wheel, leanRad }).z, radius * cardWorld);
  return {
    ...wheel,
    angStep,
    radius,
    dy: 0,
    cardWorld,
    leanRad,
    center: [front[0] - back[0], front[1] - back[1], front[2] - back[2]],
  };
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// The row's edges fade out: a card's alpha by where its center sits across the
// canvas. `fadePx` is each edge's fade width, `halfCardPx` half a card's width:
// a card centered half a card beyond the edge is gone, one `fadePx` in is whole.
export function ribbonEdgeAlpha(xPx: number, canvasWidthPx: number, fadePx: number, halfCardPx: number): number {
  const inside = Math.min(xPx, canvasWidthPx - xPx);
  const t = clamp01((inside + halfCardPx) / Math.max(1, fadePx + halfCardPx));
  return t * t * (3 - 2 * t);
}

// What entrancePose needs to fade the row's edges: in world units, so it never
// projects. `half` is half the canvas, `fade` the fade width, `halfCard` half a card.
export type RibbonEdge = { readonly half: number; readonly fade: number; readonly halfCard: number; readonly width: number };

export function ribbonEdge(geo: CoilGeometry, c: CoilConstants = COIL): RibbonEdge {
  const perPx = geo.camera.worldPerPx;
  return {
    half: (geo.canvas.width / 2) * perPx,
    fade: c.deal.ribbon.fadeWidthPx * perPx,
    halfCard: (geo.ribbon.cardPx * COIL.cardAspect * perPx) / 2,
    width: geo.canvas.width * perPx,
  };
}

// The same fade from a card's world x (the canvas's center is 0).
export function ribbonEdgeAlphaWorld(x: number, edge: RibbonEdge): number {
  return ribbonEdgeAlpha(x + edge.half, edge.width, edge.fade, edge.halfCard);
}
