import type { FooterSettings } from "./settings";

// The period's Easter egg, pure (round 4). Clicked, the period squashes,
// hops with a quarter turn whose speed peaks at the apex, lands past upright
// in a squash, and settles square; a soft shadow on the baseline shrinks and
// fades as it rises. At the landing a ripple runs out from where it landed:
// each letter dips as the wavefront passes (the press spring carries it, so
// it reads as the press's dent travelling outward) and the field's ring
// moves with it. Times in ms unless a name says s; lengths in units (the
// ascender height).

export type EggShape = FooterSettings["egg"];

// After touchdown: the squash and the overshoot settle over this.
export const SETTLE_MS = 420;
// Reduced motion: no hop, no ripple; the period turns in place over this.
export const REDUCED_TURN_MS = 320;
// The ripple's half width in the letters (a dent as wide as the press's),
// and in the field (a narrower crest, so it reads as a ring), in units.
export const RIPPLE_WIDTH = 0.6;
export const FIELD_RING_WIDTH = 0.3;
// How far the field's crest leans toward the glow, per unit of push.
export const FIELD_SHINE = 3;
// "Anywhere": the hop waits for the ring to reach the period, at most this.
export const MAX_HOP_DELAY_MS = 700;

// lift: units the period's bottom sits above the baseline. angle: degrees,
// counterclockwise on screen. sx, sy: its scale about its bottom center.
// shadow: the shadow's share of its full opacity; shadowScale: its width's.
export type EggPose = { lift: number; angle: number; sx: number; sy: number; shadow: number; shadowScale: number };
export const REST_POSE: EggPose = Object.freeze({ lift: 0, angle: 0, sx: 1, sy: 1, shadow: 0, shadowScale: 1 });

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOutSine = (u: number) => (1 - Math.cos(Math.PI * clamp01(u))) / 2;
const easeOutQuad = (u: number) => 1 - (1 - u) * (1 - u);

export function eggPhases(e: EggShape) {
  const takeoff = Math.max(0, e.anticipationMs);
  const landing = takeoff + Math.max(1, e.airMs);
  return { takeoff, landing, end: landing + SETTLE_MS };
}

export function eggTotalMs(e: EggShape): number {
  return eggPhases(e).end;
}

// The angle the period comes to rest at: the nearest quarter turn to the
// turn asked for, so a square at rest is the square it started as.
export function restAngle(turnDeg: number): number {
  return Math.round(turnDeg / 90) * 90;
}

// How far the impact's squash has gone (0 to 1 to a small rebound and back
// to 0) `ms` after touchdown: in over 50ms, then damped with one rebound.
const IMPACT_MS = 50;
function impact(ms: number): number {
  if (ms <= 0) return 0;
  if (ms < IMPACT_MS) return easeOutQuad(ms / IMPACT_MS);
  const t = ms - IMPACT_MS;
  return Math.exp(-t / 90) * Math.cos((2 * Math.PI * t) / 260);
}

// The squash before takeoff (0 to 1 over 70 percent, then released into the
// takeoff's stretch, -0.35, so the hop leaves stretched).
const STRETCH = 0.35;
function anticipation(u: number): number {
  if (u < 0.7) return easeOutQuad(u / 0.7);
  const v = (u - 0.7) / 0.3;
  return 1 - (1 + STRETCH) * v * v;
}

export function eggPose(ms: number, e: EggShape, reduced = false): EggPose {
  if (reduced) {
    if (ms <= 0 || ms >= REDUCED_TURN_MS) return REST_POSE;
    return { ...REST_POSE, angle: restAngle(e.turnDeg) * easeInOutSine(ms / REDUCED_TURN_MS) };
  }
  const { takeoff, landing, end } = eggPhases(e);
  if (ms <= 0 || ms >= end) return REST_POSE;
  const fadeIn = clamp01(ms / 60);
  const fadeOut = clamp01((end - ms) / 160);
  const envelope = Math.min(fadeIn, fadeOut);
  if (ms < takeoff) {
    const k = anticipation(ms / takeoff);
    return { lift: 0, angle: 0, sx: 1 + e.squash * 0.6 * k, sy: 1 - e.squash * k, shadow: envelope, shadowScale: 1 };
  }
  const turn = e.turnDeg + e.overshootDeg;
  if (ms < landing) {
    const u = (ms - takeoff) / (landing - takeoff);
    const height = 4 * u * (1 - u);
    // Stretched along the fall, round at the apex.
    const v = Math.pow(Math.abs(1 - 2 * u), 1.5);
    return {
      lift: e.hop * height,
      angle: turn * easeInOutSine(u),
      sx: 1 - e.squash * 0.12 * v,
      sy: 1 + e.squash * STRETCH * v,
      shadow: envelope * (1 - 0.55 * height),
      shadowScale: 1 - 0.4 * height,
    };
  }
  const after = ms - landing;
  const k = impact(after);
  const rest = restAngle(e.turnDeg);
  const swing = Math.exp(-after / 110) * Math.cos((2 * Math.PI * after) / 300);
  return {
    lift: 0,
    angle: rest + (turn - rest) * swing,
    sx: 1 + e.squash * 0.6 * k,
    sy: 1 - e.squash * k,
    shadow: envelope,
    shadowScale: 1,
  };
}

// How high the period's bottom may hop so its turned square stays under the
// word's top: a hole above the paper cover would show no field.
export function maxHop(inkTop: number, side: number, margin = 0.02): number {
  return Math.max(0, inkTop - side * Math.SQRT2 - margin);
}

// ---- the ripple ----

export type Ripple = { readonly x: number; readonly y: number; readonly t0: number }; // stage px, and its start, ms

export function rippleRadius(seconds: number, speed: number): number {
  return Math.max(0, seconds) * speed;
}

export function rippleAmp(seconds: number, decay: number): number {
  return Math.exp(-Math.max(0, decay) * Math.max(0, seconds));
}

// The dent a ripple puts in a letter `distance` units from its start, as a
// share of its height: a ring of RIPPLE_WIDTH around the wavefront.
export function ringDip(distance: number, seconds: number, e: EggShape): number {
  if (seconds < 0) return 0;
  const x = (distance - rippleRadius(seconds, e.rippleSpeed)) / RIPPLE_WIDTH;
  return e.rippleLetters * rippleAmp(seconds, e.rippleDecay) * Math.exp(-x * x);
}

// Every live ripple's dent at a point (stage px), held under 0.9.
export function letterDip(x: number, y: number, ripples: readonly Ripple[], now: number, unitPx: number, e: EggShape): number {
  if (unitPx <= 0) return 0;
  let dip = 0;
  for (const r of ripples) dip += ringDip(Math.hypot(x - r.x, y - r.y) / unitPx, (now - r.t0) / 1000, e);
  return Math.min(0.9, dip);
}

// How long a ripple lives: until it has faded to under half a percent, or
// its ring has passed `reach` units (the stage's far corner), sooner of the two.
export function rippleLifeMs(e: EggShape, reach: number): number {
  const faded = Math.log(200) / Math.max(0.01, e.rippleDecay);
  const passed = (reach + 2 * RIPPLE_WIDTH) / Math.max(0.01, e.rippleSpeed);
  return 1000 * Math.min(faded, passed);
}

// ---- the queue ----

export type EggRequest = { readonly kind: "period" } | { readonly kind: "point"; readonly x: number; readonly y: number };

type EggRun = { hopAt: number; end: number; rippleAt: number | null; reduced: boolean };

export type EggState = {
  run: EggRun | null;
  queued: EggRequest | null;
  ripples: Ripple[];
  pending: EggRequest[]; // asked for since the last frame (the button, the panel, a click)
};

export type EggContext = {
  e: EggShape;
  reduced: boolean;
  landing: { x: number; y: number }; // stage px: the period's bottom center at rest
  unitPx: number;
};

export function createEggState(): EggState {
  return { run: null, queued: null, ripples: [], pending: [] };
}

function start(state: EggState, request: EggRequest, now: number, ctx: EggContext) {
  if (ctx.reduced) {
    state.run = { hopAt: now, end: now + REDUCED_TURN_MS, rippleAt: null, reduced: true };
    return;
  }
  if (request.kind === "point") {
    state.ripples.push({ x: request.x, y: request.y, t0: now });
    const distance = Math.hypot(request.x - ctx.landing.x, request.y - ctx.landing.y) / Math.max(1, ctx.unitPx);
    const delay = Math.min(MAX_HOP_DELAY_MS, (1000 * distance) / Math.max(0.01, ctx.e.rippleSpeed));
    state.run = { hopAt: now + delay, end: now + delay + eggTotalMs(ctx.e), rippleAt: null, reduced: false };
    return;
  }
  state.run = { hopAt: now, end: now + eggTotalMs(ctx.e), rippleAt: now + eggPhases(ctx.e).landing, reduced: false };
}

// A click while the egg runs queues one more, never two.
export function triggerEgg(state: EggState, request: EggRequest, now: number, ctx: EggContext) {
  if (state.run) {
    if (!state.queued) state.queued = request;
    return;
  }
  start(state, request, now, ctx);
}

// Once a frame: the pending asks, the landing's ripple, the next queued egg,
// and the ripples that have run their course.
export function stepEgg(state: EggState, now: number, ctx: EggContext, rippleLife: number) {
  for (const request of state.pending.splice(0)) triggerEgg(state, request, now, ctx);
  const run = state.run;
  if (run && run.rippleAt !== null && now >= run.rippleAt) {
    state.ripples.push({ x: ctx.landing.x, y: ctx.landing.y, t0: run.rippleAt });
    run.rippleAt = null;
  }
  if (run && now >= run.end) {
    state.run = null;
    const next = state.queued;
    state.queued = null;
    if (next) start(state, next, now, ctx);
  }
  if (ctx.reduced) state.ripples.length = 0;
  else state.ripples = state.ripples.filter((r) => now - r.t0 < rippleLife);
}

export function eggPoseAt(state: EggState, now: number, e: EggShape): EggPose {
  const run = state.run;
  return run ? eggPose(now - run.hopAt, e, run.reduced) : REST_POSE;
}
