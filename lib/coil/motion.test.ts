import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { mod, poseAt, projectPoint, restHelix, solveGeometry } from "@/lib/coil/geometry";
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

  // The real rest helix at 1440x900 (the review's pane): whole turns of 8
  // cards project to y 936, 407 and -58, so only the center turn's front is
  // ever on the pane, at its middle.
  const geo = solveGeometry({ width: 1440, height: 900 }, 14);
  const frame = restHelix(geo);
  const N = geo.cardCount;
  const cpt = geo.cardsPerTurn;
  const maxU = geo.slotCount / 2 - COIL.lab.endFadeSlots;
  const project = (u: number) => projectPoint(geo.camera, poseAt(frame, u).position);
  const pane = { left: 54, right: 1386 };
  // The landing is a copy of the tile: the result's offset puts strand
  // position (arrival - to), which is that tile mod N, at the arrival.
  const landing = (tile: number, offset: number, band: typeof pane & { top: number; bottom: number }) => {
    const { to, arrival } = hoverJumpTarget(tile, offset, N, cpt, maxU, project, band);
    expect(arrival).not.toBeNull();
    const copy = (arrival as number) - to;
    expect(copy).toBeCloseTo(Math.round(copy), 9);
    expect(mod(Math.round(copy), N)).toBe(tile);
    return { to, u: arrival as number };
  };

  it("lands the copy whose center falls inside the visible band, front-facing when it can", () => {
    // Hero fully on screen: the front of the center turn.
    const full = { ...pane, top: 54, bottom: 720 };
    for (const [tile, offset] of [[0, 0], [5, -17.3], [13, 40.6], [7, -3.9]]) {
      expect(landing(tile, offset, full).u).toBe(0);
    }
    // Scrolled 450px: only the lower half shows, and the center turn (y 407)
    // is off screen, so a card near the front lands inside the band instead.
    const lower = { ...pane, top: 504, bottom: 720 };
    for (const [tile, offset] of [[0, 0], [5, -17.3], [13, 40.6]]) {
      const { u } = landing(tile, offset, lower);
      const y = project(u).y;
      expect(y).toBeGreaterThanOrEqual(504);
      expect(y).toBeLessThanOrEqual(720);
      expect(Math.abs(u - cpt * Math.round(u / cpt))).toBeLessThanOrEqual(1);
    }
  });

  it("takes the shortest glide among copies that land equally well", () => {
    const full = { ...pane, top: 54, bottom: 720 };
    const offset = 3.2;
    const { to } = landing(2, offset, full);
    // Copies of tile 2 sit 14 apart, so the u = 0 arrival is reached from
    // offset 3.2 by the nearest of -2, 12, -16: -2.
    expect(to).toBe(-2);
  });

  it("glides to the landing nearest the band when none is inside it", () => {
    // The hero has scrolled off the top: the band collapses to its bottom edge.
    const gone = { ...pane, top: 1400, bottom: 720 };
    const { u } = landing(4, 0, gone);
    const best = Math.abs(project(u).y - 720);
    for (let k = -2; k <= 2; k++) {
      for (const step of [0, -0.5, 0.5, -1, 1]) {
        const v = k * cpt + step;
        if (Math.abs(v) > maxU) continue;
        const p = project(v);
        if (p.x < pane.left || p.x > pane.right) continue;
        expect(Math.abs(p.y - 720)).toBeGreaterThanOrEqual(best - 1e-9);
      }
    }
  });

  it("stays put when no landing is on the pane", () => {
    const nowhere = { top: 0, bottom: 900, left: 5000, right: 6000 };
    expect(hoverJumpTarget(3, 7.25, N, cpt, maxU, project, nowhere)).toEqual({ to: 7.25, arrival: null });
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
