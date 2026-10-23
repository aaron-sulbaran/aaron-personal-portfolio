import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { dealMs, dealOffsetAt, dealOmega, dealSpeedOf, integrateDealSpeed, peakFor, power2InOut, power2Out, sceneMs, smoothstep, type DealSpeed } from "@/lib/coil/dealSpeed";

const T = COIL.deal.timeline;
const TOTAL = sceneMs();
const IDLE = COIL.idleCardsPerSecond;
// Any pace the strand has at the click (the curve's shape does not depend on it).
const WHEEL = 0.5;
// The ribbon's own pace: negative, the row drifts left.
const RIBBON = -0.13;

// The integral of the speed by hand: the closed form the table must match.
function closedForm(ms: number, p: DealSpeed) {
  const t = ms / 1000;
  const U = p.upMs / 1000;
  const a = p.slowStartMs / 1000;
  const L = p.slowMs / 1000;
  const up = t <= U ? U * (t / U - (1 - Math.pow(1 - t / U, 4)) / 4) : 0.75 * U + (t - U);
  const x = Math.min(1, Math.max(0, (t - a) / L));
  const down = t < a ? 0 : t <= a + L ? L * (x ** 3 - x ** 4 / 2) : L / 2 + (t - a - L);
  return p.startCardsPerSecond * t + (p.peakCardsPerSecond - p.startCardsPerSecond) * up - (p.peakCardsPerSecond - p.idleCardsPerSecond) * down;
}

describe("the deal's easings", () => {
  it("are GSAP's power2 and a smoothstep: zero to one, the right slopes", () => {
    for (const ease of [power2Out, power2InOut, smoothstep]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      expect(ease(-3)).toBe(0);
      expect(ease(4)).toBe(1);
    }
    expect(power2Out(0.5)).toBeCloseTo(0.875, 10);
    expect(power2InOut(0.5)).toBeCloseTo(0.5, 10);
    expect(power2InOut(0.25)).toBeCloseTo(0.0625, 10);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe("the deal's clocks", () => {
  it("runs the scene's clock until the pull has landed, the field is open and the name has dissolved, and the whole deal the condense longer", () => {
    expect(TOTAL).toBe(Math.max(T.pullStartMs + T.pullMs, T.openStartMs + COIL.deal.open.ms));
    expect(dealMs()).toBe(T.condenseMs + TOTAL);
  });
});

describe("the deal's speed", () => {
  const p = dealSpeedOf(WHEEL);

  it("starts at the strand's pace, peaks, and ends at exactly the idle pace", () => {
    expect(dealOmega(0, p)).toBeCloseTo(WHEEL, 12);
    expect(dealOmega(T.upMs, p)).toBeCloseTo(T.peakCardsPerSecond, 10);
    expect(dealOmega((T.upMs + T.slowStartMs) / 2, p)).toBeCloseTo(T.peakCardsPerSecond, 10);
    expect(dealOmega(T.slowStartMs + T.slowMs, p)).toBeCloseTo(IDLE, 10);
    expect(dealOmega(TOTAL, p)).toBeCloseTo(IDLE, 10);
  });

  it("starts from whatever pace the strand has at the click, with no step, the ribbon's leftward drift included", () => {
    for (const start of [RIBBON, 0.5, 3, 11]) {
      const q = dealSpeedOf(start);
      expect(dealOmega(0, q)).toBeCloseTo(start, 12);
      expect(dealOmega(TOTAL, q)).toBeCloseTo(IDLE, 10);
      const table = integrateDealSpeed(q, TOTAL);
      expect(table[1] / 0.001).toBeCloseTo(start, 1);
    }
  });

  it("is C1: the slope is bounded everywhere and flat at every phase boundary", () => {
    const upSlope = (3 * (T.peakCardsPerSecond - WHEEL)) / (T.upMs / 1000); // power2.out's steepest, at the click
    const slowSlope = (1.5 * (T.peakCardsPerSecond - IDLE)) / (T.slowMs / 1000); // smoothstep's steepest, at its middle
    const bound = Math.max(upSlope, slowSlope) * 1.001;
    let steepest = 0;
    for (let ms = 0; ms < TOTAL; ms++) {
      const slope = Math.abs(dealOmega(ms + 1, p) - dealOmega(ms, p)) * 1000;
      steepest = Math.max(steepest, slope);
    }
    expect(steepest).toBeLessThanOrEqual(bound);
    // The slope on both sides of each join is the same, and near zero.
    for (const join of [T.upMs, T.slowStartMs, T.slowStartMs + T.slowMs]) {
      const before = ((dealOmega(join, p) - dealOmega(join - 2, p)) / 2) * 1000;
      const after = ((dealOmega(join + 2, p) - dealOmega(join, p)) / 2) * 1000;
      // Near zero against the steepest the curve gets (a share of it, so it holds whatever the ramps' lengths).
      expect(Math.abs(before), `slope before ${join}`).toBeLessThan(0.01 * bound);
      expect(Math.abs(after), `slope after ${join}`).toBeLessThan(0.01 * bound);
      expect(Math.abs(after - before)).toBeLessThan(0.01 * bound);
    }
  });

  it("reverses once, at once, from the ribbon's leftward drift: slow, then every millisecond forward", () => {
    const q = dealSpeedOf(RIBBON);
    const table = integrateDealSpeed(q, TOTAL);
    expect(dealOmega(0, q)).toBeCloseTo(RIBBON, 12);
    let turnedAt = -1;
    for (let ms = 1; ms <= TOTAL; ms++) {
      if (table[ms] > table[ms - 1]) {
        turnedAt = ms;
        break;
      }
    }
    // The spin-up is steep at its start, so the strand has reversed within a few frames.
    expect(turnedAt).toBeGreaterThan(0);
    expect(turnedAt).toBeLessThan(80);
    for (let ms = turnedAt; ms <= TOTAL; ms++) expect(table[ms]).toBeGreaterThan(table[ms - 1]);
    // The most it ever goes back is a hair of a card.
    expect(Math.min(...table)).toBeGreaterThan(-0.01);
    expect(dealOmega(TOTAL, q)).toBeCloseTo(IDLE, 10);
  });

  it("never dwells at zero: the strand moves at least the idle pace over every 40 ms", () => {
    const table = integrateDealSpeed(p, TOTAL);
    let slowest = Number.POSITIVE_INFINITY;
    for (let ms = 0; ms + 40 <= TOTAL; ms++) slowest = Math.min(slowest, table[ms + 40] - table[ms]);
    expect(slowest).toBeGreaterThanOrEqual(IDLE * 0.04 * 0.999);
    for (let ms = 0; ms <= TOTAL; ms++) expect(dealOmega(ms, p)).toBeGreaterThanOrEqual(IDLE - 1e-9);
  });

  it("integrates to the closed form (the table is Simpson at 1 ms)", () => {
    const table = integrateDealSpeed(p, TOTAL);
    expect(table.length).toBe(TOTAL + 1);
    for (const ms of [0, 100, T.upMs, 1000, T.slowStartMs, 2000, T.slowStartMs + T.slowMs, TOTAL]) {
      expect(Math.abs(dealOffsetAt(table, ms) - closedForm(ms, p)), `at ${ms}`).toBeLessThan(1e-4);
    }
    // And a start that is not the wheel's.
    const other = dealSpeedOf(7);
    const otherTable = integrateDealSpeed(other, TOTAL);
    expect(Math.abs(dealOffsetAt(otherTable, TOTAL) - closedForm(TOTAL, other))).toBeLessThan(1e-4);
  });

  it("is a lookup that never runs backward, interpolates between milliseconds and carries on at idle past its end", () => {
    const table = integrateDealSpeed(p, TOTAL);
    for (let ms = 1; ms <= TOTAL; ms++) expect(table[ms]).toBeGreaterThan(table[ms - 1]);
    expect(dealOffsetAt(table, -50)).toBe(0);
    const mid = dealOffsetAt(table, 500.5);
    expect(mid).toBeCloseTo((table[500] + table[501]) / 2, 6);
    expect(dealOffsetAt(table, TOTAL + 1000) - dealOffsetAt(table, TOTAL)).toBeCloseTo(IDLE, 6);
  });

  it("ends with the velocity the conveyor carries on with: idle, and the same step per frame", () => {
    const table = integrateDealSpeed(p, TOTAL);
    const perFrame = dealOffsetAt(table, TOTAL) - dealOffsetAt(table, TOTAL - 16.7);
    expect(perFrame / 0.0167).toBeCloseTo(IDLE, 2);
    const next = dealOffsetAt(table, TOTAL + 16.7) - dealOffsetAt(table, TOTAL);
    expect(next / 0.0167).toBeCloseTo(IDLE, 2);
  });
});

// The wagon wheel (the motion spec's risk 2): above about 0.3 card a frame the
// eye reads the turning wheel as stepping or going backward. The most the strand
// turns in one frame, over the whole deal, at any phase of the frame clock.
function mostCardsPerFrame(coarse: boolean, hz: number) {
  const table = integrateDealSpeed(dealSpeedOf(WHEEL, COIL, coarse), TOTAL);
  const frameMs = 1000 / hz;
  let most = 0;
  for (let ms = 0; ms + frameMs <= TOTAL; ms += 1) most = Math.max(most, dealOffsetAt(table, ms + frameMs) - dealOffsetAt(table, ms));
  return most;
}

describe("the wheel's turn per frame", () => {
  it("never passes 0.3 card a frame at the fine pointer's peak on a 60 Hz screen", () => {
    expect(mostCardsPerFrame(false, 60)).toBeLessThanOrEqual(0.3);
  });

  it("never passes 0.3 card a frame at the coarse peak on a phone that has dropped to 30 Hz", () => {
    expect(mostCardsPerFrame(true, 30)).toBeLessThanOrEqual(0.3 + 1e-6);
  });

  it("peaks a touch screen lower than a fine pointer, never higher", () => {
    expect(peakFor(COIL, true)).toBe(T.coarsePeakCardsPerSecond);
    expect(peakFor(COIL, true)).toBeLessThan(peakFor(COIL, false));
    expect(peakFor(COIL, false)).toBe(T.peakCardsPerSecond);
    const lab = { ...COIL, deal: { ...COIL.deal, timeline: { ...T, peakCardsPerSecond: 6 } } };
    expect(peakFor(lab, true)).toBe(6);
  });

  it("still ends at the idle pace on the coarse curve", () => {
    const table = integrateDealSpeed(dealSpeedOf(WHEEL, COIL, true), TOTAL);
    const perFrame = dealOffsetAt(table, TOTAL) - dealOffsetAt(table, TOTAL - 16.7);
    expect(perFrame / 0.0167).toBeCloseTo(IDLE, 2);
  });
});
