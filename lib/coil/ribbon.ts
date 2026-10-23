import { COIL, type CoilConstants } from "./constants";
import { helixRotation, type CoilGeometry, type HelixFrame, type Vec3 } from "./geometry";

// The ribbon at page 1's foot (slices 4c and 4d): the 14 cards in one flat row,
// face up, drifting left above "Deal me in", and what becomes of it at the click. It is
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

// The closest the gaps tighten to under the hover's anticipation: the ring's own
// pitch, or wider where the canvas is so wide that the row's wrap, cardCount
// cards on, would show. (The click's gather goes tighter than this: below.)
export function ribbonHoverPitch(geo: CoilGeometry): number {
  const wrap = (geo.canvas.width + 2 * geo.ribbon.cardPx * COIL.cardAspect) / (geo.cardCount * geo.ribbon.cardPx);
  return Math.max(geo.step, wrap);
}

// The pile the click gathers the row into, in card heights between one card and
// the next: a fraction of a card's width, so each card lies mostly over the one
// before it, like a deck being squared up (slice 5; Aaron: "bunch tightly around
// its center, overlapping"). The row is then much shorter than the canvas; its
// two ends fade out (ringEndFade) so the strand's wrap is never seen, and the
// cards keep their order by a hair of depth (entrancePose's stack), so the
// overlap never flickers. Never wider than the row was.
export function ribbonGatherPitch(geo: CoilGeometry, c: CoilConstants = COIL): number {
  return Math.min(ribbonPitchUnits(geo), Math.max(0.02, c.deal.ribbon.gatherPitch));
}

// The strand's speed while the ribbon drifts, in cards per second: negative, the
// row moves left (the strand's offset falls). `anticipation` (0 to 1) is how far
// the pointer's hover over "Deal me in" has taken hold: the row eases faster by
// up to hoverSpeedFactor times.
export function ribbonCardsPerSecond(geo: CoilGeometry, c: CoilConstants = COIL, anticipation = 0): number {
  const pitchPx = ribbonPitchUnits(geo) * geo.ribbon.cardPx;
  const r = c.deal.ribbon;
  const faster = 1 + (r.hoverSpeedFactor - 1) * clamp01(anticipation);
  return (-r.speedPxPerS * faster) / Math.max(1, pitchPx);
}

// How much of the way to the hover's pitch the hover has already taken the
// row: the gaps tighten a little toward the button, hoverTighten of the way at
// full anticipation (the click's gather then starts from there).
export function ribbonAnticipatedGather(anticipation: number, c: CoilConstants = COIL): number {
  return clamp01(anticipation) * c.deal.ribbon.hoverTighten;
}

// How far the hover has taken hold after `dtS` more seconds toward `target`
// (1 over the button, 0 off it): an exponential approach on hoverEaseMs, the
// same rate each way, whatever the frame rate.
export function easeAnticipation(level: number, target: number, dtS: number, c: CoilConstants = COIL): number {
  const tau = Math.max(1, c.deal.ribbon.hoverEaseMs) / 1000;
  return level + (target - level) * (1 - Math.exp(-Math.max(0, dtS) / tau));
}

// The row's center in world units: the middle of the canvas across, the
// anchor's share of the canvas's height down.
export function ribbonAnchor(geo: CoilGeometry): Vec3 {
  const perPx = geo.camera.worldPerPx;
  return [0, (0.5 - geo.ribbon.anchorY) * geo.canvas.height * perPx, 0];
}

// Where the row sits while the stage rides the page and the click gathers it:
// `dxPx` is how far the button sits from the canvas's middle across (the row
// gathers toward it, in step with the gaps closing), `dyPx` how far pinKnee has
// it off its slot (up is negative).
export type RowOffset = { dxPx: number; dyPx: number };

// How far the row has gathered: `hover` is the anticipation's share of the way to
// the hover's pitch (0 to 1, what the pointer over the button did), `rush` the
// click's progress to the tight pile (0 until the click).
export type Gather = { hover: number; rush: number };

// The share of the way to the button the row has taken, for its sideways travel:
// the hover's, then the rush's on top of it.
export function gatherShare({ hover, rush }: Gather): number {
  const h = clamp01(hover);
  return h + (1 - h) * clamp01(rush);
}

// The ribbon's frame at `gather` (the row as it drifts, then the pointer's
// tightening, then the click's rush into a tight pile gathered to the button)
// and `curl` (0 flat, 1 the wheel): `wheel` is the frame the ring has at curl 1
// (the wheel, or what it has become), and the frame is exactly that at curl 1.
// The cards keep their size through the gathering, then shrink to the wheel's
// as the row curls.
export function ribbonHelix(
  wheel: HelixFrame,
  geo: CoilGeometry,
  gather: Gather,
  curl: number,
  offset: RowOffset = { dxPx: 0, dyPx: 0 },
  c: CoilConstants = COIL,
): HelixFrame {
  if (curl >= 1) return wheel;
  const g = gatherShare(gather);
  const k = clamp01(curl);
  const hovered = lerp(ribbonPitchUnits(geo), ribbonHoverPitch(geo), clamp01(gather.hover));
  const pitch = lerp(lerp(hovered, ribbonGatherPitch(geo, c), clamp01(gather.rush)), geo.step, k);
  const angStep = Math.max(1e-5, wheel.angStep * k);
  const radius = pitch / angStep;
  const leanRad = lerp(0, wheel.leanRad, k);
  const cardWorld = lerp(geo.ribbon.cardWorld, wheel.cardWorld, k);
  // The card at u = 0 sits at the row's anchor, and glides to the wheel's near
  // side as the ring forms; the ring's center is behind it by the radius.
  const wheelFront = add(wheel.center, scale(helixRotation(wheel).z, wheel.radius * wheel.cardWorld));
  const perPx = geo.camera.worldPerPx;
  const row = add(ribbonAnchor(geo), [offset.dxPx * g * perPx, -offset.dyPx * perPx, 0]);
  const front = mix3(row, wheelFront, k);
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
