// Pure geometry for the desktop ring-arc carousel. No imports, no DOM: every
// function is a pure map of (off, progress, viewport) so the whole module is
// unit-testable in node. TileRing's scroll driver consumes it per frame.
//
// Coordinate convention: CardState.x/y are SCREEN pixels (post-projection).
// The prod stage projects from the viewport center (perspective 1400px,
// perspective-origin center), so toCollapse backs the foreshortening out
// (cxCard = (x - vw/2) / kTz), the same move the deck era made with
// slotCx = screenX / kTz. See docs/plans/ring-arc-geometry-note.md for the
// perspective-origin decision and the flight-bridge validation.

// Locked design values from the ring-arc implementation plan (section 1),
// plus the ring dimensions they must agree with (TileRing's seat math).
export const CAROUSEL = {
  /** Card count; must equal siteContent.homeTiles.length. */
  N: 20,
  /** Ring angular step in degrees (360 / N). */
  STEP_DEG: 18,
  /** Hero ring radius, vmin units; must equal TileRing's RING_RADIUS_VMIN. */
  RING_RADIUS_VMIN: 41,
  /** Native tile size in vmin; must equal TileRing's TILE_WIDTH_VMIN and its 3:4 height. */
  TILE_W_VMIN: 9,
  TILE_H_VMIN: 12,
  /** Stage perspective; must equal TileRing's RING_PERSPECTIVE_PX. */
  PERSPECTIVE_PX: 1400,
  /** Extra ring rotation played across the forced transition. */
  SPIN_DEG: 360,
  /** Spin beat: eSpin = easeInOut(clamp01(p / SPIN_WINDOW)). */
  SPIN_WINDOW: 0.62,
  /** Slide beat: eMove = easeInOut(clamp01((p - MOVE_START) / (1 - MOVE_START))). */
  MOVE_START: 0.28,
  /** Angular multiplier on STEP_DEG for settled arc spacing (27deg apart). */
  ARC_SPREAD: 1.5,
  /** Focused-card height as a fraction of viewport height. */
  ARC_CARD_SIZE: 0.35,
  /** Arc circle radius as a multiple of viewport height. */
  ARC_RADIUS_VH: 1.0,
  /** translateZ recession per card-step away from focus, px. */
  ARC_DEPTH_PX: 320,
  /** rotateX per card-step, deg, clamped to +-ARC_TILT_CLAMP. */
  ARC_TILT_DEG: 20,
  ARC_TILT_CLAMP: 24,
  /** Focused card lands at this fraction of viewport width. */
  FOCUS_X_FRAC: 0.7,
  /** Forward pop (translateZ px) and scale boost on the focused card. */
  FOCUS_POP_PX: 60,
  FOCUS_SCALE_BOOST: 0.06,
  /** Opacity fades to 0 between these angular distances from focus, deg. */
  FADE_START_DEG: 70,
  FADE_END_DEG: 110,
  /** Depth dim: opacity multiplier max(FLOOR, 1 - PER_STEP * min(|off|, MAX_STEPS)). */
  DEPTH_DIM_PER_STEP: 0.1,
  DEPTH_DIM_MAX_STEPS: 3,
  DEPTH_DIM_FLOOR: 0.55,
  /** Forced transition durations: un-scrubbable, wheel swallowed mid-flight. */
  TRANSITION_MS_FWD: 1000,
  TRANSITION_MS_REV: 900,
  /** Wheel px per card of rotation when settled over the cards. */
  WHEEL_PX_PER_CARD: 420,
  /** Idle time after the last wheel tick before rotation snaps to a card. */
  SNAP_IDLE_MS: 320,
  SNAP_MS: 450,
  /** Idle time before the carousel auto-steps, and the step tween duration. */
  AUTO_ADVANCE_MS: 4000,
  AUTO_ADVANCE_STEP_MS: 950,
  /** Arrow-key step tween duration. */
  KEY_STEP_MS: 700,
  /** Cursor right of this fraction of vw routes wheel to rotation.
   * Aaron-tuned (2026-07-03): sits just left of the settled card column
   * (~0.61vw at 1440x900) so wheel over the page text never rotates cards. */
  WHEEL_ZONE_X_FRAC: 0.58,
  /** Cards below this opacity must not be interactive. */
  HIT_OPACITY_MIN: 0.2,
} as const;

export type Viewport = { vw: number; vh: number; vmin: number };

// x/y in screen px, z is translateZ px, scale is the pre-projection
// multiplier, rotZ is the card's ABSOLUTE Z rotation in degrees.
export type CardState = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotZ: number;
  rotX: number;
  opacity: number;
};

// Mirrors TileRing's CardCollapse: rotZ is a DELTA on the seat tangent
// (flight reads homeTangentDeg = seat.rotate + rotZ); dx/dy are the wrapper
// translation with scale + rotation backed out so the card rotates about its
// own center. rotY stays 0 in the arc.
export type CollapseOffsets = {
  dx: number;
  dy: number;
  scale: number;
  rotZ: number;
  rotX: number;
  rotY: number;
  tz: number;
};

export type SeatPx = { seatX: number; seatY: number; rotateDeg: number };

const DEG = Math.PI / 180;

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Signed card-unit offset of card i from the focused position, in [-N/2, N/2).
export function wrap(i: number, rotation: number): number {
  const h = CAROUSEL.N / 2;
  return ((((i - rotation + h) % CAROUSEL.N) + CAROUSEL.N) % CAROUSEL.N) - h;
}

// Normalize an angle to (-180, 180].
export function norm180(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

// Shortest signed angular delta from `fromDeg` to `toDeg`; never exceeds 180
// in magnitude, so lerped rotations never spin the long way around.
export function shortestDeltaDeg(fromDeg: number, toDeg: number): number {
  return norm180(toDeg - fromDeg);
}

export function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

// The two-beat transition clocks over the LINEAR progress p in [0,1]: spin
// drives ring rotation over the front 62%, move drives position/scale/depth/
// opacity over the back 72%; the overlap reads as spin-up then pull-away.
export function spinEase(p: number): number {
  return easeInOutCubic(clamp01(p / CAROUSEL.SPIN_WINDOW));
}

export function moveEase(p: number): number {
  return easeInOutCubic(clamp01((p - CAROUSEL.MOVE_START) / (1 - CAROUSEL.MOVE_START)));
}

// Hero-ring seat with the forced-transition spin folded in. At eSpin 0 this
// reproduces TileRing's seats exactly (scale 1, rotZ = seat tangent, z 0), so
// the converter emits an identity collapse and the entrance hands off clean.
export function heroSeat(off: number, eSpin: number, vp: Viewport): CardState {
  const phi = -90 - CAROUSEL.SPIN_DEG * eSpin + off * CAROUSEL.STEP_DEG;
  const r0 = (CAROUSEL.RING_RADIUS_VMIN / 100) * vp.vmin;
  return {
    x: vp.vw / 2 + Math.cos(phi * DEG) * r0,
    y: vp.vh / 2 + Math.sin(phi * DEG) * r0,
    z: 0,
    scale: 1,
    rotZ: phi + 90,
    rotX: 0,
    opacity: 1,
  };
}

// Near-center tilt easing (Aaron's wheel-radius model, 2026-07-03). The
// rotational components (rotX tilt, rotZ roll) used to ramp LINEARLY with
// off, so a card 0.3 steps from focus still carried ~6deg of tilt and the
// idle settle animated those degrees away all at once, which read as the
// card visibly snapping upright. This ramp has ZERO slope at the center and
// rejoins the linear ramp with matching value AND slope at |off| = 1
// (t^2(2-t) is C1 at both ends), so a card flattens out on approach and the
// settle's residual motion is translation, not rotation. Settled integer
// slots (off 0, +-1, +-2 ...) are numerically unchanged.
export function tiltRamp(off: number): number {
  const a = Math.abs(off);
  if (a >= 1) return off;
  return Math.sign(off) * a * a * (2 - a);
}

// Settled arc slot: the focused card at (0.70vw, vh/2), neighbors receding
// along a circle whose center sits ARC_RADIUS_VH * vh off the right edge.
// Focused scale = (ARC_CARD_SIZE * vh) / (TILE_H_VMIN/100 * vmin px), i.e.
// the native 12vmin card grown until it stands 35% of the viewport tall.
export function arcSlot(off: number, vp: Viewport): CardState {
  const R = CAROUSEL.ARC_RADIUS_VH * vp.vh;
  const phi = 180 + off * CAROUSEL.STEP_DEG * CAROUSEL.ARC_SPREAD;
  // EVERY focus-proximity term shares the ONE tiltRamp shaping (the wheel-
  // radius model): not just the rotations, but the depth recede, the forward
  // pop, the scale boost, and the depth dim. The raw |off| forms all had a
  // V-shaped kink peaking exactly at the center, so a card crossing focus
  // popped/grew/brightened mechanically, reading as a separate "featured"
  // state snapping in. aoS has zero slope at the center and is identical to
  // |off| from one step out, so all settled slots are numerically unchanged.
  const aoS = Math.abs(tiltRamp(off));
  const aDeg = Math.abs(off * CAROUSEL.STEP_DEG * CAROUSEL.ARC_SPREAD);
  const focus = Math.max(0, 1 - aoS);
  const nativeH = (CAROUSEL.TILE_H_VMIN / 100) * vp.vmin;
  const fade =
    aDeg > CAROUSEL.FADE_END_DEG
      ? 0
      : clamp01(1 - (aDeg - CAROUSEL.FADE_START_DEG) / (CAROUSEL.FADE_END_DEG - CAROUSEL.FADE_START_DEG));
  const dim = Math.max(
    CAROUSEL.DEPTH_DIM_FLOOR,
    1 - CAROUSEL.DEPTH_DIM_PER_STEP * Math.min(aoS, CAROUSEL.DEPTH_DIM_MAX_STEPS),
  );
  const eased = tiltRamp(off);
  const tilt = eased * CAROUSEL.ARC_TILT_DEG;
  return {
    x: CAROUSEL.FOCUS_X_FRAC * vp.vw + R + Math.cos(phi * DEG) * R,
    y: vp.vh / 2 + Math.sin(phi * DEG) * R,
    z: -aoS * CAROUSEL.ARC_DEPTH_PX + focus * CAROUSEL.FOCUS_POP_PX,
    scale: ((CAROUSEL.ARC_CARD_SIZE * vp.vh) / nativeH) * (1 + CAROUSEL.FOCUS_SCALE_BOOST * focus),
    rotZ: eased * CAROUSEL.STEP_DEG * CAROUSEL.ARC_SPREAD * 0.5,
    rotX: Math.max(-CAROUSEL.ARC_TILT_CLAMP, Math.min(CAROUSEL.ARC_TILT_CLAMP, tilt)),
    opacity: fade * dim,
  };
}

// Per-frame interpolation in target-state space: linear everywhere except
// rotZ, which travels the shortest angular path.
export function lerpState(a: CardState, b: CardState, e: number): CardState {
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    z: a.z + (b.z - a.z) * e,
    scale: a.scale + (b.scale - a.scale) * e,
    rotZ: a.rotZ + shortestDeltaDeg(a.rotZ, b.rotZ) * e,
    rotX: a.rotX + (b.rotX - a.rotX) * e,
    opacity: a.opacity + (b.opacity - a.opacity) * e,
  };
}

// One card's full state at linear transition progress p.
export function cardState(off: number, p: number, vp: Viewport): CardState {
  return lerpState(heroSeat(off, spinEase(p), vp), arcSlot(off, vp), moveEase(p));
}

// Target state -> CardCollapse in exact deck-era semantics, plus the plane
// center (cxCard/cyCard) the DOM transform needs. The screen position is
// divided by kTz so the stage's center-origin perspective projects it back to
// exactly state.x/y; computeHomeRect then reproduces the same rect.
export function toCollapse(
  state: CardState,
  seat: SeatPx,
  vp: Viewport,
): { c: CollapseOffsets; cxCard: number; cyCard: number } {
  const kTz = CAROUSEL.PERSPECTIVE_PX / (CAROUSEL.PERSPECTIVE_PX - state.z);
  const cxCard = (state.x - vp.vw / 2) / kTz;
  const cyCard = (state.y - vp.vh / 2) / kTz;
  const rotZ = norm180(state.rotZ - seat.rotateDeg);
  const cos = Math.cos(rotZ * DEG);
  const sin = Math.sin(rotZ * DEG);
  return {
    c: {
      dx: cxCard - state.scale * (cos * seat.seatX - sin * seat.seatY),
      dy: cyCard - state.scale * (sin * seat.seatX + cos * seat.seatY),
      scale: state.scale,
      rotZ,
      rotX: state.rotX,
      rotY: 0,
      tz: state.z,
    },
    cxCard,
    cyCard,
  };
}

// DOM transform for the card's 0x0 wrapper: the deck convention with rotateX
// in the rotateY slot (the arc tilts on X; rotY stays 0).
export function collapseTransform(
  cxCard: number,
  cyCard: number,
  c: CollapseOffsets,
  seat: SeatPx,
): string {
  return `translate(${cxCard}px, ${cyCard}px) translateZ(${c.tz}px) rotateX(${c.rotX}deg) scale(${c.scale}) rotate(${c.rotZ}deg) translate(${-seat.seatX}px, ${-seat.seatY}px)`;
}

// Test-only mirror of TileRing's computeHomeRect projection (screen center of
// the card plus its on-screen size), so round-trip tests need no DOM.
export function projectCollapse(
  c: CollapseOffsets,
  seat: SeatPx,
  vp: Viewport,
): { cx: number; cy: number; w: number; h: number } {
  const rz = c.rotZ * DEG;
  const rotatedX = Math.cos(rz) * seat.seatX - Math.sin(rz) * seat.seatY;
  const rotatedY = Math.sin(rz) * seat.seatX + Math.cos(rz) * seat.seatY;
  const kTz = CAROUSEL.PERSPECTIVE_PX / (CAROUSEL.PERSPECTIVE_PX - c.tz);
  return {
    cx: vp.vw / 2 + (c.dx + c.scale * rotatedX) * kTz,
    cy: vp.vh / 2 + (c.dy + c.scale * rotatedY) * kTz,
    w: (CAROUSEL.TILE_W_VMIN / 100) * vp.vmin * c.scale * kTz,
    h: (CAROUSEL.TILE_H_VMIN / 100) * vp.vmin * c.scale * kTz,
  };
}

// Vertical screen extent of one card: projected height about the card's
// center, axis-aligned. rotZ/rotX are ignored (a tilted card's true box is
// slightly taller); good enough for the scroll-routing reach zone.
export function cardSpan(
  state: CardState,
  vp: Viewport,
): { top: number; bottom: number } {
  const kTz = CAROUSEL.PERSPECTIVE_PX / (CAROUSEL.PERSPECTIVE_PX - state.z);
  const h = (CAROUSEL.TILE_H_VMIN / 100) * vp.vmin * state.scale * kTz;
  return { top: state.y - h / 2, bottom: state.y + h / 2 };
}

// Union of cardSpan over every card at or above the interactive opacity
// floor, in stage coordinates (equal to viewport coordinates while the pin
// is engaged; the driver re-anchors with the section's post-release offset).
// Null when no card clears the floor (defensive; real arc geometry always
// keeps several cards inside the fade window).
export function visibleSpan(
  p: number,
  rotation: number,
  vp: Viewport,
): { top: number; bottom: number } | null {
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < CAROUSEL.N; i++) {
    const state = cardState(wrap(i, rotation), p, vp);
    if (clamp01(state.opacity) < CAROUSEL.HIT_OPACITY_MIN) continue;
    const s = cardSpan(state, vp);
    if (s.top < top) top = s.top;
    if (s.bottom > bottom) bottom = s.bottom;
  }
  return top === Infinity ? null : { top, bottom };
}
