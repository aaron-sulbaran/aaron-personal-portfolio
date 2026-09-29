import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { mod } from "@/lib/coil/geometry";
import {
  addWheel,
  createConveyor,
  createEnvelope,
  cubicBezier,
  envelopeTarget,
  hoverJumpTarget,
  siteEase,
  startGlide,
  stepConveyor,
  stepEnvelope,
  stretchedDy,
  targetLead,
  wheelPixels,
} from "@/lib/coil/motion";

// Deterministic pseudo-random frame times, 1/240s to a stalled 0.25s.
function frames(count: number, seed = 7) {
  let s = seed;
  return Array.from({ length: count }, () => {
    s = (s * 16807) % 2147483647;
    const r = s / 2147483647;
    return r < 0.02 ? 0.25 : 1 / 240 + r * (1 / 30);
  });
}

const rest = { idleWeight: 1, pageScrollPx: 0 };

describe("conveyor", () => {
  it("holds the speed cap under any wheel flood", () => {
    const conveyor = createConveyor();
    let now = 0;
    let top = 0;
    for (const dt of frames(4000)) {
      addWheel(conveyor, 5000);
      now += dt * 1000;
      stepConveyor(conveyor, { ...rest, dt, nowMs: now });
      top = Math.max(top, Math.abs(conveyor.velocity));
      expect(Math.abs(conveyor.velocity)).toBeLessThanOrEqual(COIL.spinCapCardsPerSecond + COIL.idleCardsPerSecond + 1e-9);
      expect(Math.abs(conveyor.target - conveyor.offset)).toBeLessThanOrEqual(targetLead() + 1e-9);
    }
    expect(top).toBeGreaterThan(COIL.spinCapCardsPerSecond * 0.9);
  });

  it("stays under half a card per frame at 60fps, both directions", () => {
    const conveyor = createConveyor();
    for (let i = 0; i < 600; i++) {
      addWheel(conveyor, i < 300 ? 4000 : -4000);
      const before = conveyor.offset;
      stepConveyor(conveyor, { ...rest, dt: 1 / 60, nowMs: i * 16.7 });
      expect(Math.abs(conveyor.offset - before)).toBeLessThan(0.5);
    }
  });

  it("keeps idle drift bounded: exact idle speed, no lead, clamped stalls", () => {
    const conveyor = createConveyor(-3.2);
    let expected = -3.2;
    let now = 0;
    for (const dt of frames(10000, 11)) {
      now += dt * 1000;
      stepConveyor(conveyor, { ...rest, dt, nowMs: now });
      expected += COIL.idleCardsPerSecond * Math.min(dt, COIL.lab.maxFrameSeconds);
      expect(conveyor.target).toBeCloseTo(conveyor.offset, 9);
      expect(conveyor.velocity).toBeLessThanOrEqual(COIL.idleCardsPerSecond + 1e-9);
      expect(conveyor.excessVelocity).toBeCloseTo(0, 6);
    }
    expect(conveyor.offset).toBeCloseTo(expected, 6);
  });

  it("stops idling at zero weight and turns gently with page scroll", () => {
    const conveyor = createConveyor();
    stepConveyor(conveyor, { dt: 1 / 60, nowMs: 16, idleWeight: 0, pageScrollPx: 0 });
    expect(conveyor.offset).toBe(0);
    for (let i = 0; i < 240; i++) stepConveyor(conveyor, { dt: 1 / 60, nowMs: i * 16, idleWeight: 0, pageScrollPx: i === 0 ? 150 : 0 });
    expect(conveyor.offset).toBeCloseTo(1, 3);
  });

  it("converts wheel delta modes on the dominant axis", () => {
    expect(wheelPixels(0, 100, 0, 900)).toBe(100);
    expect(wheelPixels(-40, 10, 0, 900)).toBe(-40);
    expect(wheelPixels(0, 3, 1, 900)).toBe(48);
    expect(wheelPixels(0, 1, 2, 900)).toBe(900);
  });
});

describe("hover-jump glide", () => {
  it("reaches its target within tolerance at the duration, without overshoot", () => {
    const conveyor = createConveyor(2.4);
    startGlide(conveyor, 9.75, 1000);
    let last = conveyor.offset;
    for (let t = 1000; t <= 1000 + COIL.hoverJumpMs; t += 1000 / 60) {
      stepConveyor(conveyor, { ...rest, dt: 1 / 60, nowMs: t });
      expect(conveyor.offset).toBeGreaterThanOrEqual(last - 1e-12);
      expect(conveyor.offset).toBeLessThanOrEqual(9.75 + 1e-9);
      last = conveyor.offset;
    }
    stepConveyor(conveyor, { ...rest, dt: 1 / 60, nowMs: 1000 + COIL.hoverJumpMs + 1 });
    expect(conveyor.offset).toBeCloseTo(9.75, 6);
    expect(conveyor.glide).toBeNull();
  });

  it("is cancelled by captured wheel input", () => {
    const conveyor = createConveyor();
    startGlide(conveyor, 5, 0);
    addWheel(conveyor, 100);
    expect(conveyor.glide).toBeNull();
  });

  it("brings the nearest copy of the tile to a front-facing whole turn near the row's height", () => {
    const N = 14;
    const cpt = 8;
    for (const [tile, offset, uAt] of [
      [0, 0, 0],
      [5, -17.3, 4.1],
      [13, 40.6, -9.5],
      [7, -3.9, 12],
    ]) {
      const to = hoverJumpTarget(tile, offset, N, uAt, cpt);
      // The copy that lands: some strand position p with p mod N = tile, at u = p + to.
      const arrival = Math.round(uAt / cpt) * cpt;
      const candidates = [-cpt, 0, cpt].map((k) => arrival + k);
      const landed = candidates.find((u) => Math.abs(u - to - Math.round(u - to)) < 1e-9 && mod(Math.round(u - to), N) === tile);
      expect(landed).toBeDefined();
      expect(Math.abs(to - offset)).toBeLessThanOrEqual(N / 2 + cpt);
    }
  });
});

describe("stretch envelope", () => {
  it("rises in about 1.2s and relaxes in about 2s, never above its target or below zero", () => {
    const envelope = createEnvelope();
    const fast = 30;
    const target = envelopeTarget(fast);
    expect(target).toBeCloseTo(COIL.lab.envelopeTargetMax * COIL.stretch.amount, 12);
    let t = 0;
    let at12 = 0;
    while (t < 4) {
      stepEnvelope(envelope, fast, 1 / 60);
      t += 1 / 60;
      if (Math.abs(t - 1.2) < 1 / 120) at12 = envelope.value;
      expect(envelope.value).toBeLessThanOrEqual(target + 1e-12);
      expect(envelope.value).toBeGreaterThanOrEqual(0);
    }
    expect(at12 / target).toBeGreaterThan(0.75);
    let previous = envelope.value;
    let at2 = 0;
    for (t = 0; t < 5; t += 1 / 60) {
      stepEnvelope(envelope, 0, 1 / 60);
      if (Math.abs(t - 2) < 1 / 120) at2 = envelope.value;
      expect(envelope.value).toBeLessThanOrEqual(previous + 1e-12);
      expect(envelope.value).toBeGreaterThanOrEqual(0);
      previous = envelope.value;
    }
    expect(at2 / target).toBeLessThan(0.25);
  });

  it("never overshoots under erratic input and odd frame times", () => {
    const envelope = createEnvelope();
    let s = 3;
    for (const dt of frames(6000, 5)) {
      s = (s * 48271) % 2147483647;
      const speed = ((s / 2147483647) * 2 - 1) * 25;
      const target = envelopeTarget(speed);
      const before = envelope.value;
      stepEnvelope(envelope, speed, dt);
      expect(envelope.value).toBeGreaterThanOrEqual(0);
      if (before <= target) expect(envelope.value).toBeLessThanOrEqual(target + 1e-12);
      else expect(envelope.value).toBeGreaterThanOrEqual(target - 1e-12);
    }
  });

  it("opens the turn gap by 1 + envelope", () => {
    expect(stretchedDy(0.3125, { value: 0, velocity: 0 })).toBe(0.3125);
    expect(stretchedDy(0.3125, { value: 0.5, velocity: 0 })).toBeCloseTo(0.46875, 12);
  });
});

describe("easing", () => {
  it("the site ease runs 0 to 1 with no overshoot and matches linear at the ends", () => {
    let last = 0;
    for (let x = 0; x <= 1.0001; x += 0.01) {
      const y = siteEase(x);
      expect(y).toBeGreaterThanOrEqual(last - 1e-9);
      expect(y).toBeLessThanOrEqual(1);
      last = y;
    }
    expect(siteEase(0)).toBe(0);
    expect(siteEase(1)).toBe(1);
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 4);
  });
});
