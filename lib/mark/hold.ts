import { HOLD, type HoldConfig } from "@/lib/mark/constants";

// The mark's press and hold as pure time arithmetic: no timers, no DOM. The
// caller passes performance.now(); fill and spent are functions of the state
// and the clock, so the mark and the cursor's ring read one value. fill
// rises 0 to 1 (linear, as the loader's name fills); spent rises 0 to 1 as
// the charge leaves through the top in the discharge.
export type HoldPhase = "idle" | "filling" | "taste" | "draining" | "discharging" | "fired";
export type HoldSource = "pointer" | "key";
export type HoldState = { phase: HoldPhase; at: number; from: number; to: number; source: HoldSource; swallowClick: boolean };

export const HOLD_IDLE: HoldState = { phase: "idle", at: 0, from: 0, to: 0, source: "pointer", swallowClick: false };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const cubicIn = (t: number) => t * t * t;
const cubicOut = (t: number) => 1 - cubicIn(1 - t);
const drainMs = (from: number, c: HoldConfig) => c.drainMs * Math.max(0.3, from);
const riseMs = (s: HoldState, c: HoldConfig) => (s.to > s.from ? c.tasteRiseMs : 0);

function phaseEnd(s: HoldState, c: HoldConfig): number | null {
  if (s.phase === "filling") return s.at + (1 - s.from) * c.holdMs;
  if (s.phase === "discharging") return s.at + c.dischargeMs;
  if (s.phase === "taste") return s.at + riseMs(s, c) + c.tasteMs;
  if (s.phase === "draining") return s.at + drainMs(s.from, c);
  return null;
}

// Only a pointer hold ends in a click to swallow; a keyboard hold's keys are
// prevented, so it never produces one.
function nextPhase(s: HoldState, at: number): HoldState {
  if (s.phase === "filling") return { ...s, phase: "discharging", at, from: 1, swallowClick: s.source === "pointer" };
  if (s.phase === "discharging") return { ...s, phase: "fired", at, from: 0 };
  if (s.phase === "taste") return { ...s, phase: "draining", at, from: s.to };
  return { ...s, phase: "idle", at, from: 0, to: 0 };
}

export function advance(state: HoldState, now: number, c: HoldConfig = HOLD): HoldState {
  let s = state;
  for (let end = phaseEnd(s, c); end !== null && now >= end; end = phaseEnd(s, c)) s = nextPhase(s, end);
  return s;
}

export function sample(state: HoldState, now: number, c: HoldConfig = HOLD): { fill: number; spent: number } {
  const s = advance(state, now, c);
  const t = Math.max(0, now - s.at);
  if (s.phase === "filling") return { fill: Math.min(1, s.from + t / c.holdMs), spent: 0 };
  if (s.phase === "discharging") return { fill: 1, spent: cubicIn(clamp01(t / c.dischargeMs)) };
  if (s.phase === "taste") {
    const rise = riseMs(s, c);
    return { fill: s.from + (s.to - s.from) * (rise ? cubicOut(clamp01(t / rise)) : 1), spent: 0 };
  }
  if (s.phase === "draining") return { fill: s.from * (1 - cubicIn(clamp01(t / drainMs(s.from, c)))), spent: 0 };
  return { fill: 0, spent: 0 };
}

export function press(state: HoldState, now: number, source: HoldSource, c: HoldConfig = HOLD): HoldState {
  const s = advance(state, now, c);
  if (s.phase === "discharging" || s.phase === "fired") return s;
  return { phase: "filling", at: now, from: sample(s, now, c).fill, to: 0, source, swallowClick: false };
}

// An early release: the taste guarantees at least minFill for tasteMs.
export function release(state: HoldState, now: number, c: HoldConfig = HOLD): HoldState {
  const s = advance(state, now, c);
  if (s.phase !== "filling") return s;
  const from = sample(s, now, c).fill;
  return { ...s, phase: "taste", at: now, from, to: Math.max(from, c.minFill) };
}

// The pointer left, the browser cancelled, or Escape: drain with no taste.
export function cancel(state: HoldState, now: number, c: HoldConfig = HOLD): HoldState {
  const s = advance(state, now, c);
  if (s.phase !== "filling") return s;
  return { ...s, phase: "draining", at: now, from: sample(s, now, c).fill, to: 0 };
}

// Once the card opens: back to rest, keeping the click still to swallow.
export function settle(state: HoldState): HoldState {
  return { ...HOLD_IDLE, swallowClick: state.swallowClick };
}

export function click(state: HoldState): { state: HoldState; swallow: boolean } {
  return { state: { ...state, swallowClick: false }, swallow: state.swallowClick };
}
