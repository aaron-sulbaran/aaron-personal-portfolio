import { COIL, type CoilConstants } from "./constants";

// The Coil's one parametric system, ported from hero lab 2 (solveGeometry,
// coilPose, the slot loop, the silhouette, picking) as pure math with no three
// import, so it is unit-tested here and consumed by the scene in slice 3.
//
// Units. The helix lives in "card units" (a card is 1 tall and `aspect` wide);
// `cardWorld` scales card units into world units, and the camera maps world
// units to CSS pixels. The world origin is the canvas center; +x right, +y up,
// +z toward the camera, which sits on +z looking down -z.
//
// The strand. N real cards repeat forever along the helix; M slots (M even,
// M >= N) form a window that slides with the conveyor offset. Each slot shows
// the card at its absolute strand position mod N, so textures only swap at
// the wrap, where the end fade has already hidden the slot.

export type Vec2 = { readonly x: number; readonly y: number };
export type Vec3 = readonly [number, number, number];
// The card's local axes in world space: x along its width, y along its
// height, z out of its front face. Orthonormal and right handed.
export type Basis = { readonly x: Vec3; readonly y: Vec3; readonly z: Vec3 };
export type Viewport = { readonly width: number; readonly height: number };
// Four points in CSS pixels, in card order: top left, top right, bottom right,
// bottom left (as the front face reads).
export type Quad = readonly [Vec2, Vec2, Vec2, Vec2];
export type CanvasRect = { readonly left: number; readonly top: number };

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep01 = (x: number) => x * x * (3 - 2 * x);
// Modulo that stays in [0, n) for negative values.
export const mod = (a: number, n: number) => ((a % n) + n) % n;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => scale3(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

// ---------------------------------------------------------------- camera

export type Camera = {
  readonly fovDeg: number;
  readonly distance: number;
  // Canvas size in CSS pixels (the canvas is sized from its container).
  readonly width: number;
  readonly height: number;
  // World units per CSS pixel on the z = 0 plane.
  readonly worldPerPx: number;
};

export function cameraFor(viewport: Viewport, c: CoilConstants = COIL): Camera {
  const halfFov = (c.camera.fovDeg * DEG) / 2;
  const distance = c.lab.viewHalfHeight / Math.tan(halfFov);
  return {
    fovDeg: c.camera.fovDeg,
    distance,
    width: viewport.width,
    height: viewport.height,
    worldPerPx: (2 * distance * Math.tan(halfFov)) / viewport.height,
  };
}

// World point to CSS pixels, offset by the canvas rect's viewport origin.
export function projectPoint(camera: Camera, p: Vec3, rect: CanvasRect = { left: 0, top: 0 }): Vec2 {
  const t = Math.tan((camera.fovDeg * DEG) / 2);
  const depth = camera.distance - p[2];
  const ndcY = p[1] / (depth * t);
  const ndcX = p[0] / (depth * t * (camera.width / camera.height));
  return {
    x: rect.left + ((ndcX + 1) / 2) * camera.width,
    y: rect.top + ((1 - ndcY) / 2) * camera.height,
  };
}

// Canvas pixel to the world point on the plane z = `z` (the inverse of
// projectPoint for points on that plane). Pixels are canvas-relative.
export function unprojectToPlane(camera: Camera, x: number, y: number, z = 0): Vec3 {
  const t = Math.tan((camera.fovDeg * DEG) / 2);
  const depth = camera.distance - z;
  const ndcX = (x / camera.width) * 2 - 1;
  const ndcY = 1 - (y / camera.height) * 2;
  return [ndcX * depth * t * (camera.width / camera.height), ndcY * depth * t, z];
}

export type Ray = { readonly origin: Vec3; readonly direction: Vec3 };

// The picking ray through a canvas pixel.
export function rayThrough(camera: Camera, x: number, y: number): Ray {
  const origin: Vec3 = [0, 0, camera.distance];
  return { origin, direction: normalize(sub(unprojectToPlane(camera, x, y, 0), origin)) };
}

// ---------------------------------------------------------------- solve

export type CoilGeometry = {
  readonly viewport: Viewport;
  readonly camera: Camera;
  readonly cardCount: number; // N, real cards on the strand
  readonly narrow: boolean;
  readonly axisRad: number; // screen angle of the helix axis from vertical
  readonly leanRad: number;
  readonly cosLean: number;
  readonly cardsPerTurn: number;
  readonly step: number; // arc per card: width plus the neighbor gap
  readonly radius: number; // card units
  readonly pitch: number; // card heights per turn: 1 + turn gap
  readonly dy: number; // axial rise per card
  readonly angStep: number; // radians per card
  readonly slotCount: number; // M, even and at least N
  readonly need: number; // slots needed to span the pane
  readonly repeats: number; // visible copies beyond N
  readonly spans: boolean; // both strand ends sit outside the pane
  readonly cardPx: number; // card height in CSS px
  readonly cardWorld: number; // world units per card unit
  readonly bandCardWorld: number; // the closed entrance band's card size
  readonly axisDir: Vec2; // the axis on screen, toward the top left (y down)
  readonly axisPerp: Vec2;
};

// Distance from the pane center to its edge along (dx, dy).
function chord(dx: number, dy: number, w: number, h: number) {
  const a = Math.abs(dx) > 1e-4 ? w / Math.abs(dx) : Infinity;
  const b = Math.abs(dy) > 1e-4 ? h / Math.abs(dy) : Infinity;
  return Math.min(a, b);
}

export function isNarrow(viewport: Viewport, c: CoilConstants = COIL) {
  return viewport.width / viewport.height < c.narrow.aspectBelow;
}

export function solveGeometry(viewport: Viewport, cardCount: number, c: CoilConstants = COIL): CoilGeometry {
  const W = viewport.width;
  const H = viewport.height;
  const camera = cameraFor(viewport, c);
  const narrow = isNarrow(viewport, c);
  // On a narrow pane the diagonal relaxes toward vertical with fewer cards per turn.
  const axisDeg = narrow ? c.axisDeg * c.narrow.axisFactor : c.axisDeg;
  const cardsPerTurn = narrow ? Math.min(c.cardsPerTurn, c.narrow.maxCardsPerTurn) : c.cardsPerTurn;
  const axisRad = axisDeg * DEG;
  const leanRad = c.camera.leanDeg * DEG;
  const cosLean = Math.cos(leanRad);
  const step = c.cardAspect + c.neighborGap;
  const radius = (cardsPerTurn * step) / TAU;
  const pitch = 1 + c.turnGap;
  const dy = pitch / cardsPerTurn;
  const axisDir = { x: -Math.sin(axisRad), y: -Math.cos(axisRad) };
  const axisPerp = { x: Math.cos(axisRad), y: -Math.sin(axisRad) };
  const perpChord = chord(axisPerp.x, axisPerp.y, W, H);

  const kTarget = H * c.cardHeightFrac;
  const kPerp = (0.5 * perpChord * (narrow ? 0.98 : 0.94)) / (radius + 0.42);
  let cardPx = Math.min(kTarget, kPerp);

  // Half the axial span (px) that puts both strand ends outside the pane.
  const halfSpanFor = (k: number) => {
    const half = (radius + 0.4) * k;
    const inner = 0.6 * k;
    const margin = 4;
    const outside = (t: number) => {
      for (const sign of [1, -1]) {
        for (let i = 0; i <= 10; i++) {
          const s = -half + (2 * half * i) / 10;
          const x = W / 2 + sign * (t - inner) * axisDir.x + s * axisPerp.x;
          const y = H / 2 + sign * (t - inner) * axisDir.y + s * axisPerp.y;
          if (x > -margin && x < W + margin && y > -margin && y < H + margin) return false;
        }
      }
      return true;
    };
    let lo = 0;
    let hi = 6000;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (outside(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  const slotsFor = (k: number) => Math.ceil((2 * halfSpanFor(k)) / (dy * k * cosLean)) + 2;

  let need = slotsFor(cardPx);
  let spans = true;
  let slotCount: number;
  if (c.strandFit === "exact") {
    // No repeats: grow the cards until N slots span the pane, or give up spanning.
    if (need > cardCount) {
      if (slotsFor(kPerp) > cardCount) {
        cardPx = kPerp;
        spans = false;
      } else {
        let lo = cardPx;
        let hi = kPerp;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (slotsFor(mid) <= cardCount) hi = mid;
          else lo = mid;
        }
        cardPx = hi;
      }
      need = slotsFor(cardPx);
    }
    slotCount = cardCount;
  } else {
    slotCount = Math.max(cardCount, need);
  }
  // Even, so the window is symmetric about the center slot.
  if (slotCount % 2 === 1) slotCount += 1;

  // The entrance's closed band: every card on one turn, sized to fit across the pane.
  const bandRadius = (cardCount * step) / TAU;
  const bandPx = Math.min(cardPx, (0.84 * perpChord) / (2 * bandRadius + 0.6));

  return {
    viewport,
    camera,
    cardCount,
    narrow,
    axisRad,
    leanRad,
    cosLean,
    cardsPerTurn,
    step,
    radius,
    pitch,
    dy,
    angStep: step / radius,
    slotCount,
    need,
    repeats: Math.max(0, Math.min(need, slotCount) - cardCount),
    spans,
    cardPx,
    cardWorld: cardPx * camera.worldPerPx,
    bandCardWorld: bandPx * camera.worldPerPx,
    axisDir,
    axisPerp,
  };
}

// ---------------------------------------------------------------- helix

// Per-frame helix parameters: the rest geometry, possibly modified by the
// entrance, the stretch envelope, or the unwind. Modifiers return a new frame.
export type HelixFrame = {
  readonly angStep: number;
  readonly radius: number;
  readonly dy: number;
  readonly cardWorld: number;
  readonly axisRad: number;
  readonly leanRad: number;
  readonly curvature: number;
  readonly center: Vec3;
  readonly slotCount: number;
  readonly recede: number; // how far the back of the coil recedes into the field
};

export function restHelix(geo: CoilGeometry, recede: number = COIL.lab.recedeLight, c: CoilConstants = COIL): HelixFrame {
  return {
    angStep: geo.angStep,
    radius: geo.radius,
    dy: geo.dy,
    cardWorld: geo.cardWorld,
    axisRad: geo.axisRad,
    leanRad: geo.leanRad,
    curvature: c.curvature,
    center: [0, 0, 0],
    slotCount: geo.slotCount,
    recede,
  };
}

// The helix's orientation: Rz(axis) * Rx(lean), as three columns.
export function helixRotation(frame: HelixFrame): Basis {
  const ca = Math.cos(frame.axisRad);
  const sa = Math.sin(frame.axisRad);
  const cl = Math.cos(frame.leanRad);
  const sl = Math.sin(frame.leanRad);
  return {
    x: [ca, sa, 0],
    y: [-sa * cl, ca * cl, sl],
    z: [sa * sl, -ca * sl, cl],
  };
}

const rotate = (r: Basis, v: Vec3): Vec3 => add(add(scale3(r.x, v[0]), scale3(r.y, v[1])), scale3(r.z, v[2]));

export type CardPose = {
  readonly u: number; // continuous strand position relative to the window
  readonly position: Vec3; // card center, world units
  readonly basis: Basis;
  readonly scale: number; // world units per card unit
  readonly bend: number; // 1 / bend radius in card units (0 is flat)
  readonly beta: number; // the helix axis angle within the card's plane
  readonly depth: number; // +1 facing the camera side of the axis, -1 behind
  readonly fade: number; // how far it recedes into the field (0 none)
  readonly alpha: number;
};

// The card at continuous strand position u. The card's top edge follows the
// spring (its x axis is the helix tangent) and its front faces outward.
export function poseAt(frame: HelixFrame, u: number): CardPose {
  const theta = u * frame.angStep;
  const r = frame.radius;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const local: Vec3 = [r * sin, u * frame.dy, r * cos];
  const arc = Math.max(1e-4, r * frame.angStep);
  const slope = frame.dy / arc;
  const normal: Vec3 = [sin, 0, cos];
  const tangent = normalize([cos, slope, -sin]);
  const up = cross(normal, tangent);
  const rot = helixRotation(frame);
  const depth = cos;
  return {
    u,
    position: add(scale3(rotate(rot, local), frame.cardWorld), frame.center),
    basis: { x: rotate(rot, tangent), y: rotate(rot, up), z: rotate(rot, normal) },
    scale: frame.cardWorld,
    bend: frame.curvature / Math.max(0.05, r),
    beta: Math.atan(slope),
    depth,
    fade: frame.recede * Math.pow(clamp01((1 - depth) / 2), 1.25),
    alpha: 1,
  };
}

// Where slot j sits on the strand, in [-M/2, M/2), for conveyor offset X.
export function slotU(slot: number, offset: number, slotCount: number) {
  return slot + offset - slotCount * Math.floor((slot + offset + slotCount / 2) / slotCount);
}

// Slot j's absolute strand position (an integer, any sign).
export function strandPosition(slot: number, offset: number, slotCount: number) {
  return Math.round(slotU(slot, offset, slotCount) - offset);
}

// Which of the N cards slot j shows: its absolute strand position mod N.
export function strandIndex(slot: number, offset: number, cardCount: number, slotCount: number) {
  return mod(strandPosition(slot, offset, slotCount), cardCount);
}

// The strand ends fade out over the last slots, so the wrap is never seen.
export function endFade(u: number, slotCount: number, fadeSlots: number = COIL.lab.endFadeSlots) {
  return smoothstep01(clamp01((slotCount / 2 - Math.abs(u)) / fadeSlots));
}

export type SlotPose = CardPose & {
  readonly slot: number;
  readonly strandPosition: number;
};

// Slot j's pose for conveyor offset X, with the end fade in alpha.
export function coilPose(frame: HelixFrame, slot: number, offset: number): SlotPose {
  const u = slotU(slot, offset, frame.slotCount);
  const pose = poseAt(frame, u);
  return {
    ...pose,
    alpha: endFade(u, frame.slotCount),
    slot,
    strandPosition: Math.round(u - offset),
  };
}

// ---------------------------------------------------------------- the bent card

// A point on the card in card units (x across, y up, centered) after the
// vertex bend: wrapped onto a cylinder coaxial with the helix (an isometric
// bend), so its edges follow the spring. Mirrors the card vertex shader.
export function bendLocal(x: number, y: number, bend: number, beta: number): Vec3 {
  if (Math.abs(bend) <= 1e-4) return [x, y, 0];
  const axis = { x: Math.sin(beta), y: Math.cos(beta) };
  const perp = { x: axis.y, y: -axis.x };
  const along = x * axis.x + y * axis.y;
  const across = x * perp.x + y * perp.y;
  const a = across * bend;
  const s = Math.sin(a) / bend;
  return [axis.x * along + perp.x * s, axis.y * along + perp.y * s, (Math.cos(a) - 1) / bend];
}

export function cardPointToWorld(pose: CardPose, local: Vec3): Vec3 {
  return add(pose.position, scale3(rotate(pose.basis, local), pose.scale));
}

// The card's four bent corners in CSS pixels (viewport coordinates when the
// canvas rect's origin is passed): the flight source and home quad.
export function projectQuad(
  pose: CardPose,
  camera: Camera,
  rect: CanvasRect = { left: 0, top: 0 },
  aspect: number = COIL.cardAspect,
): Quad {
  const hw = aspect / 2;
  const corner = (x: number, y: number) =>
    projectPoint(camera, cardPointToWorld(pose, bendLocal(x, y, pose.bend, pose.beta)), rect);
  return [corner(-hw, 0.5), corner(hw, 0.5), corner(hw, -0.5), corner(-hw, -0.5)];
}

// ---------------------------------------------------------------- picking

export type CardHit = { readonly distance: number; readonly local: Vec2 };

// Ray against the card's flat plane (the lab's picking: off by about 5 percent
// of a card at curvature 0.7, fine for hover). Null on a miss.
export function cardHit(pose: CardPose, ray: Ray, aspect: number = COIL.cardAspect): CardHit | null {
  const normal = pose.basis.z;
  const denom = dot(ray.direction, normal);
  if (Math.abs(denom) < 1e-9) return null;
  const distance = dot(sub(pose.position, ray.origin), normal) / denom;
  if (distance <= 0) return null;
  const offset = sub(add(ray.origin, scale3(ray.direction, distance)), pose.position);
  const x = dot(offset, pose.basis.x) / pose.scale;
  const y = dot(offset, pose.basis.y) / pose.scale;
  if (Math.abs(x) > aspect / 2 || Math.abs(y) > 0.5) return null;
  return { distance, local: { x, y } };
}

// The nearest visible card under the ray, as an index into `poses`, or -1.
// Faded cards (alpha at or under `minAlpha`) are never picked.
export function pickCard(poses: readonly CardPose[], ray: Ray, minAlpha = 0.5, aspect: number = COIL.cardAspect) {
  let best = -1;
  let bestDistance = Infinity;
  poses.forEach((pose, i) => {
    if (pose.alpha <= minAlpha) return;
    const hit = cardHit(pose, ray, aspect);
    if (hit && hit.distance < bestDistance) {
      best = i;
      bestDistance = hit.distance;
    }
  });
  return best;
}

// ---------------------------------------------------------------- silhouette

// The helix's projected hull: its screen axis (a point and a unit direction)
// and the half width that covers every visible card.
export type Silhouette = {
  readonly ax: number;
  readonly ay: number;
  readonly dx: number;
  readonly dy: number;
  readonly half: number;
};

export function silhouette(
  frame: HelixFrame,
  camera: Camera,
  poses: readonly CardPose[],
  rect: CanvasRect = { left: 0, top: 0 },
): Silhouette {
  const a = projectPoint(camera, frame.center, rect);
  const along = add(frame.center, scale3(helixRotation(frame).y, frame.cardWorld));
  const b = projectPoint(camera, along, rect);
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dx = (b.x - a.x) / length;
  const dy = (b.y - a.y) / length;
  let half = 0;
  poses.forEach((pose) => {
    if (pose.alpha <= 0.5) return;
    const p = projectPoint(camera, pose.position, rect);
    const distance = Math.abs((p.x - a.x) * -dy + (p.y - a.y) * dx);
    half = Math.max(half, distance + (pose.scale / camera.worldPerPx) * 0.45);
  });
  return { ax: a.x, ay: a.y, dx, dy, half };
}

export function insideSilhouette(sil: Silhouette, x: number, y: number, margin = 8) {
  const distance = Math.abs((x - sil.ax) * -sil.dy + (y - sil.ay) * sil.dx);
  return distance <= sil.half + margin;
}
