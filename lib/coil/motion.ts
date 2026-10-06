import { COIL, type CoilConstants } from "./constants";

// The Coil's motion model, ported from hero lab 2's update(): the conveyor
// (idle drift and wheel input, one exponential smoothing stage, a hard speed
// cap; page scroll is no input, Aaron 2026-10-06), the stretch envelope (critically damped, never past its
// target), and the hover-jump glide. Pure: every function takes the time step
// or timestamp it needs, and the state objects are plain data the scene owns
// and steps once per frame (mutated in place, so a frame allocates nothing).
//
// "Never jagged" is the combination of the single smoothing stage and the
// cap: the offset chases its target at most spinCap cards per second.

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// CSS cubic-bezier(x1, y1, x2, y2) as an easing function of progress in [0, 1].
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

export const siteEase = cubicBezier(...COIL.siteEase);

// ---------------------------------------------------------------- conveyor

export type Glide = { from: number; to: number; startMs: number; durationMs: number };

export type Conveyor = {
  offset: number; // X: the strand's position, in cards; grows forever both ways
  target: number; // T: where the offset is heading
  velocity: number; // cards per second, last frame
  excessVelocity: number; // velocity beyond the idle drift (what stretches)
  glide: Glide | null;
};

export function createConveyor(offset = 0): Conveyor {
  return { offset, target: offset, velocity: 0, excessVelocity: 0, glide: null };
}

// The farthest the target may run ahead of the offset. With one smoothing
// stage at rate lambda, the offset then never moves faster than the cap.
export function targetLead(c: CoilConstants = COIL) {
  return c.spinCapCardsPerSecond / c.wheel.lambda;
}

// A wheel event's travel in CSS px: the dominant axis, with line and page
// delta modes converted (16px per line, a viewport per page).
export function wheelPixels(deltaX: number, deltaY: number, deltaMode: number, viewportHeight: number) {
  let delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  if (deltaMode === 1) delta *= 16;
  else if (deltaMode === 2) delta *= viewportHeight;
  return delta;
}

// Captured wheel input spins the coil: it moves the target, never the offset.
export function addWheel(conveyor: Conveyor, pixels: number, c: CoilConstants = COIL) {
  conveyor.target += pixels * c.wheel.cardsPerPixel;
  conveyor.glide = null;
}

export type ConveyorInput = {
  dt: number; // seconds since the last frame
  nowMs: number; // frame timestamp, for the glide
  // Idle drift weight: 1 at rest, 0 when reduced motion, a row focus, or the
  // unwound list holds the coil still (the lab's coilW fades it in between).
  idleWeight: number;
};

export function stepConveyor(conveyor: Conveyor, input: ConveyorInput, c: CoilConstants = COIL): Conveyor {
  const dt = clamp(input.dt, 0, c.lab.maxFrameSeconds);
  const previous = conveyor.offset;
  const idleVelocity = conveyor.glide ? 0 : c.idleCardsPerSecond * clamp(input.idleWeight, 0, 1);

  // Idle drift moves the offset and the target together, so it never opens a
  // lead: the idle offset is bounded by construction.
  conveyor.offset += idleVelocity * dt;
  conveyor.target += idleVelocity * dt;

  const lead = targetLead(c);
  conveyor.target = clamp(conveyor.target, conveyor.offset - lead, conveyor.offset + lead);

  const glide = conveyor.glide;
  if (glide) {
    const progress = siteEase(clamp((input.nowMs - glide.startMs) / glide.durationMs, 0, 1));
    conveyor.offset = glide.from + (glide.to - glide.from) * progress;
    conveyor.target = conveyor.offset;
    if (progress >= 1) conveyor.glide = null;
  } else {
    conveyor.offset += (conveyor.target - conveyor.offset) * (1 - Math.exp(-dt * c.wheel.lambda));
  }

  conveyor.velocity = dt > 0 ? (conveyor.offset - previous) / dt : 0;
  conveyor.excessVelocity = glide ? 0 : conveyor.velocity - idleVelocity;
  return conveyor;
}

// ---------------------------------------------------------------- hover-jump

// Starts the 600ms site-ease glide that brings a card to the front.
export function startGlide(conveyor: Conveyor, to: number, nowMs: number, durationMs: number = COIL.hoverJumpMs) {
  conveyor.glide = { from: conveyor.offset, to, startMs: nowMs, durationMs };
  conveyor.target = conveyor.offset;
}

// Where a hover-jump may land, in canvas px: the rows of the hero still on
// screen at the current scroll (inset so the card shows) and the pane's
// columns. A band whose top has passed its bottom (the hero scrolled away)
// collapses to its bottom edge, the part that comes back first.
export type JumpBand = { top: number; bottom: number; left: number; right: number };

// Arrival positions around each front-facing turn, in cards: the front first,
// then up to a card to either side, so a thin visible band still has a
// landing that faces the viewer.
export const JUMP_FACING_STEPS = [0, -0.5, 0.5, -1, 1] as const;

// The conveyor offset that brings a copy of `tile` to where the visitor can
// see it. Every candidate arrival (a strand position near a front-facing
// turn, inside the strand's unfaded window |u| <= maxU) is projected to the
// pane; the pick is the one whose center falls inside the visible band, the
// most front-facing of those, then the copy that needs the shortest glide.
// If no arrival's center is inside the band, it takes the one nearest to it.
// Returns the glide's target offset and the strand position the card lands
// on; the target is the current offset when nothing lands on the pane.
export function hoverJumpTarget(
  tile: number,
  offset: number,
  cardCount: number,
  cardsPerTurn: number,
  maxU: number,
  project: (u: number) => { x: number; y: number },
  band: JumpBand,
) {
  const top = Math.min(band.top, band.bottom);
  let best = offset;
  let bestArrival: number | null = null;
  let bestGap = Infinity;
  let bestFacing = Infinity;
  let bestDistance = Infinity;
  const turns = Math.ceil(maxU / cardsPerTurn) + 1;
  for (let k = -turns; k <= turns; k++) {
    for (const step of JUMP_FACING_STEPS) {
      const arrival = k * cardsPerTurn + step;
      if (Math.abs(arrival) > maxU) continue;
      const center = project(arrival);
      if (center.x < band.left || center.x > band.right) continue;
      const gap = center.y < top ? top - center.y : center.y > band.bottom ? center.y - band.bottom : 0;
      const copy = tile + cardCount * Math.round((arrival - offset - tile) / cardCount);
      const to = arrival - copy;
      const facing = Math.abs(step);
      const distance = Math.abs(to - offset);
      const better =
        gap < bestGap - 1e-6 ||
        (Math.abs(gap - bestGap) <= 1e-6 &&
          (facing < bestFacing || (facing === bestFacing && distance < bestDistance)));
      if (better) {
        best = to;
        bestArrival = arrival;
        bestGap = gap;
        bestFacing = facing;
        bestDistance = distance;
      }
    }
  }
  return { to: best, arrival: bestArrival };
}

// ---------------------------------------------------------------- row hold

// A book row hovered or keyboard focused holds the coil still on its card:
// the idle drift weighs 0 while held. Letting go
// waits resumeDelayMs, then eases the weight back in over resumeMs, so the
// drift never jumps. Only a real release (held to not held) starts the wait.
export type RowHold = { held: boolean; releasedAtMs: number };

export function createRowHold(): RowHold {
  return { held: false, releasedAtMs: Number.NEGATIVE_INFINITY };
}

export function setRowHold(hold: RowHold, held: boolean, nowMs: number): RowHold {
  if (hold.held && !held) hold.releasedAtMs = nowMs;
  hold.held = held;
  return hold;
}

// The weight (0 to 1) on the idle drift.
export function rowHoldWeight(hold: RowHold, nowMs: number, c: CoilConstants = COIL) {
  if (hold.held) return 0;
  const t = clamp((nowMs - hold.releasedAtMs - c.rowHold.resumeDelayMs) / c.rowHold.resumeMs, 0, 1);
  return t * t; // ease-in
}

// ---------------------------------------------------------------- stretch envelope

export type Envelope = { value: number; velocity: number };

export function createEnvelope(): Envelope {
  return { value: 0, velocity: 0 };
}

// The envelope's target for a speed beyond idle: 0 at rest, up to
// targetMax * amount when spinning hard.
export function envelopeTarget(excessVelocity: number, amount: number = COIL.stretch.amount, c: CoilConstants = COIL) {
  return clamp(Math.abs(excessVelocity) / c.lab.envelopeSpeedRef, 0, c.lab.envelopeTargetMax) * amount;
}

// One critically damped step toward the target: rises over about 1.2s,
// relaxes over about 2s. Substepped at 240Hz for stability, and it never
// passes through its target (no recoil) and never goes below zero.
export function stepEnvelope(
  envelope: Envelope,
  excessVelocity: number,
  dt: number,
  amount: number = COIL.stretch.amount,
  c: CoilConstants = COIL,
): Envelope {
  const target = envelopeTarget(excessVelocity, amount, c);
  const omega = target > envelope.value ? c.lab.envelopeRise : c.lab.envelopeRelax;
  const steps = Math.max(1, Math.ceil(clamp(dt, 0, c.lab.maxFrameSeconds) * 240));
  const h = clamp(dt, 0, c.lab.maxFrameSeconds) / steps;
  for (let i = 0; i < steps; i++) {
    const before = envelope.value - target;
    const acceleration = omega * omega * (target - envelope.value) - 2 * omega * envelope.velocity;
    envelope.velocity += acceleration * h;
    envelope.value += envelope.velocity * h;
    const after = envelope.value - target;
    if (before !== 0 && Math.sign(after) !== Math.sign(before)) {
      envelope.value = target;
      envelope.velocity = 0;
    }
  }
  if (envelope.value < 0) {
    envelope.value = 0;
    envelope.velocity = Math.max(0, envelope.velocity);
  }
  return envelope;
}

// Stretch (O3): the axial rise per card grows with the envelope, opening the
// gap between turns.
export function stretchedDy(dy: number, envelope: Envelope) {
  return dy * (1 + envelope.value);
}
