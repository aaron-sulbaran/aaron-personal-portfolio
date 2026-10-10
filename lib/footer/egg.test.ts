import { describe, expect, it } from "vitest";
import { FOOTER } from "./constants";
import {
  FIELD_RING_WIDTH,
  MAX_RIPPLES,
  REDUCED_TURN_MS,
  REST_POSE,
  RIPPLE_WIDTH,
  SETTLE_MS,
  askEgg,
  createEggState,
  eggBusy,
  eggPhases,
  eggPose,
  eggPoseAt,
  eggTotalMs,
  fieldRings,
  letterDip,
  maxHop,
  restAngle,
  rippleLifeMs,
  ringDip,
  stepEgg,
  triggerEgg,
  type EggContext,
} from "./egg";
import { eggTransform, letterTransform, periodBox } from "./frame";

// Ported from the footer lab's round 4 tests (branch lab, app/lab/footer/tests/round4.test.ts).

const E = FOOTER.egg;
const EPS = 1e-9;

describe("Aaron's egg", () => {
  it("is the round 4 preset's, exactly", () => {
    expect(E).toEqual({
      anticipationMs: 110,
      hop: 0.42,
      airMs: 520,
      turnDeg: 90,
      overshootDeg: 7,
      squash: 0.28,
      shadow: 0.34,
      rippleSpeed: 5,
      rippleLetters: 0.3,
      rippleField: 0.22,
      rippleDecay: 1.2,
    });
  });
});

describe("the period's hop", () => {
  it("lasts the anticipation, the airtime and the settle, and rests at both ends", () => {
    expect(eggTotalMs(E)).toBe(E.anticipationMs + E.airMs + SETTLE_MS);
    expect(eggTotalMs(E)).toBe(1050);
    expect(eggPose(0, E)).toBe(REST_POSE);
    expect(eggPose(-5, E)).toBe(REST_POSE);
    expect(eggPose(eggTotalMs(E), E)).toBe(REST_POSE);
    expect(eggPose(5000, E)).toBe(REST_POSE);
  });

  it("squashes before takeoff by the squash, flat on the ground", () => {
    const deepest = eggPose(0.7 * E.anticipationMs, E);
    expect(deepest.lift).toBe(0);
    expect(deepest.angle).toBe(0);
    expect(deepest.sy).toBeCloseTo(1 - E.squash, 9);
    expect(deepest.sx).toBeGreaterThan(1);
  });

  it("peaks at the apex, half turned there and turning fastest, the shadow smallest", () => {
    const { takeoff, landing } = eggPhases(E);
    const apexMs = (takeoff + landing) / 2;
    const apex = eggPose(apexMs, E);
    expect(apex.lift).toBeCloseTo(E.hop, 9);
    expect(apex.angle).toBeCloseTo((E.turnDeg + E.overshootDeg) / 2, 9);
    const rate = (t: number) => eggPose(t + 1, E).angle - eggPose(t - 1, E).angle;
    for (const t of [takeoff + 60, takeoff + 150, landing - 150, landing - 60]) expect(rate(apexMs)).toBeGreaterThan(rate(t));
    for (const t of [takeoff + 60, landing - 60]) {
      expect(eggPose(t, E).lift).toBeLessThan(apex.lift);
      expect(eggPose(t, E).shadowScale).toBeGreaterThan(apex.shadowScale);
    }
    expect(apex.shadow).toBeGreaterThan(0.3);
  });

  it("lands past the turn, squashes, and settles on the quarter turn", () => {
    const { landing, end } = eggPhases(E);
    expect(eggPose(landing - 1, E).angle).toBeGreaterThan(E.turnDeg + E.overshootDeg - 0.1);
    const impact = eggPose(landing + 50, E);
    expect(impact.sy).toBeCloseTo(1 - E.squash, 9);
    expect(impact.lift).toBe(0);
    const late = eggPose(end - 1, E);
    expect(Math.abs(late.angle - 90)).toBeLessThan(0.5);
    expect(Math.abs(late.sy - 1)).toBeLessThan(0.01);
    expect(restAngle(90)).toBe(90);
    expect(restAngle(40)).toBe(0);
    expect(restAngle(140)).toBe(180);
  });

  it("only turns in place under reduced motion", () => {
    for (let t = 1; t < REDUCED_TURN_MS; t += 20) {
      const p = eggPose(t, E, true);
      expect(p.lift).toBe(0);
      expect(p.sx).toBe(1);
      expect(p.sy).toBe(1);
      expect(p.shadow).toBe(0);
    }
    expect(eggPose(REDUCED_TURN_MS / 2, E, true).angle).toBeCloseTo(45, 9);
    expect(eggPose(REDUCED_TURN_MS, E, true)).toBe(REST_POSE);
  });

  it("holds the turned square under the word's top", () => {
    const side = FOOTER.face.stem + FOOTER.swell.amount;
    const cap = maxHop(1, side);
    expect(cap + side * Math.SQRT2).toBeLessThanOrEqual(1 - 0.02 + EPS);
    expect(E.hop).toBeLessThan(cap);
  });
});

describe("the period's transform", () => {
  it("writes a letter at rest as translate, scale and translate back", () => {
    expect(letterTransform(100, 200, 12, 1)).toBe("translate(112.00 200.00) scale(1 1.0000) translate(-12.00 0)");
    expect(letterTransform(100, 200, 12, 0.68)).toBe("translate(112.00 200.00) scale(1 0.6800) translate(-12.00 0)");
  });

  it("turns about the period's center and lifts a turned square onto its corner", () => {
    const box = periodBox(185, 200, 15); // a 30px square sitting on the baseline at 200
    expect(box).toEqual({ cy: -15, bottomY: 0, side: 30 });
    const t = eggTransform({ ...REST_POSE, angle: 45 }, box, 100, 1);
    expect(t.liftPx).toBeCloseTo(15 * (Math.SQRT2 - 1), 9);
    expect(t.cy).toBe(-15);
    expect(eggTransform({ ...REST_POSE, angle: 90 }, box, 100, 1).liftPx).toBeCloseTo(0, 9);
    expect(letterTransform(100, 200, 15, 1, t)).toContain("rotate(45.000 0 -15.00)");
  });

  it("caps the apex under the word's top at any size", () => {
    const size = 196;
    const box = periodBox(200 - (FOOTER.face.stem * size) / 2, 200, (FOOTER.face.stem * size) / 2);
    const apex = eggPose((eggPhases(E).takeoff + eggPhases(E).landing) / 2, E);
    const t = eggTransform(apex, box, size, 1);
    const cap = maxHop(1, box.side / size + FOOTER.swell.amount) * size;
    expect(t.liftPx).toBeLessThanOrEqual(cap + box.side + EPS);
  });
});

describe("the ripple", () => {
  it("dents most at its wavefront, less as it fades", () => {
    const t = 0.4;
    const front = E.rippleSpeed * t;
    expect(ringDip(front, t, E)).toBeCloseTo(E.rippleLetters * Math.exp(-E.rippleDecay * t), 9);
    expect(ringDip(front + RIPPLE_WIDTH, t, E)).toBeLessThan(ringDip(front, t, E));
    expect(ringDip(front - RIPPLE_WIDTH, t, E)).toBeLessThan(ringDip(front, t, E));
    expect(ringDip(E.rippleSpeed * 0.8, 0.8, E)).toBeLessThan(ringDip(front, t, E));
    expect(ringDip(1, -0.1, E)).toBe(0);
    expect(FIELD_RING_WIDTH).toBeLessThan(RIPPLE_WIDTH);
  });

  it("reaches the nearest letters first", () => {
    const ripples = [{ x: 0, y: 0, t0: 0 }];
    const unit = 100;
    const at = (x: number, ms: number) => letterDip(x, 0, ripples, ms, unit, E);
    const firstDent = (x: number) => {
      for (let ms = 0; ms < 3000; ms += 5) if (at(x, ms) > 0.1) return ms;
      return Infinity;
    };
    expect(firstDent(50)).toBeLessThan(firstDent(150));
    expect(firstDent(150)).toBeLessThan(firstDent(300));
    expect(at(0, 0)).toBeLessThanOrEqual(0.9);
  });

  it("lives until it fades or has passed the far corner, the sooner", () => {
    expect(rippleLifeMs(E, 0.5)).toBeCloseTo((1000 * (0.5 + 2 * RIPPLE_WIDTH)) / E.rippleSpeed, 9);
    expect(rippleLifeMs({ ...E, rippleDecay: 6 }, 100)).toBeCloseTo((1000 * Math.log(200)) / 6, 9);
  });

  it("hands the field its newest rings, in px, pushing outward as they fade", () => {
    const ripples = [0, 100, 200].map((t0) => ({ x: 500, y: 300, t0 }));
    const rings = fieldRings(ripples, E, 600, 100);
    expect(rings).toHaveLength(MAX_RIPPLES);
    expect(rings[1].radius).toBeCloseTo(0.4 * E.rippleSpeed * 100, 9);
    expect(rings[1].push).toBeCloseTo(E.rippleField * 100 * Math.exp(-E.rippleDecay * 0.4), 9);
    expect(rings[0].shine).toBeLessThanOrEqual(0.85);
    expect(fieldRings([{ x: 0, y: 0, t0: 1000 }], E, 900, 100)[0]).toMatchObject({ push: 0, shine: 0 });
  });
});

describe("the queue", () => {
  const ctx: EggContext = { e: E, reduced: false, landing: { x: 500, y: 300 }, unitPx: 100 };
  const life = 5000;

  it("runs one egg, queues one more, drops the third, and starts the queued one when the first ends", () => {
    const s = createEggState();
    triggerEgg(s, 0, ctx);
    triggerEgg(s, 10, ctx);
    triggerEgg(s, 20, ctx);
    expect(s.queued).toBe(true);
    stepEgg(s, eggTotalMs(E), ctx, life);
    expect(s.run).not.toBeNull();
    expect(s.queued).toBe(false);
    stepEgg(s, 2 * eggTotalMs(E), ctx, life);
    expect(s.run).toBeNull();
    expect(eggPoseAt(s, 2 * eggTotalMs(E) + 300, E)).toBe(REST_POSE);
  });

  it("takes the button's asks on the next frame, five clicks making two hops", () => {
    const s = createEggState();
    for (let i = 0; i < 5; i++) askEgg(s);
    expect(eggBusy(s)).toBe(true);
    stepEgg(s, 0, ctx, life);
    expect(s.pending).toBe(0);
    expect(s.run).not.toBeNull();
    expect(s.queued).toBe(true);
  });

  it("launches its ripple at the landing, from where the period lands, and goes idle after", () => {
    const s = createEggState();
    askEgg(s);
    stepEgg(s, 1000, ctx, life);
    expect(s.ripples).toHaveLength(0);
    stepEgg(s, 1000 + eggPhases(E).landing + 5, ctx, life);
    expect(s.ripples).toEqual([{ x: 500, y: 300, t0: 1000 + eggPhases(E).landing }]);
    stepEgg(s, 1000 + eggPhases(E).landing + life + 1, ctx, life);
    expect(s.ripples).toHaveLength(0);
    expect(eggBusy(s)).toBe(false);
  });

  it("makes no ripple and no hop under reduced motion", () => {
    const s = createEggState();
    const still = { ...ctx, reduced: true };
    askEgg(s);
    stepEgg(s, 0, still, life);
    stepEgg(s, 1000, still, life);
    expect(s.ripples).toHaveLength(0);
    expect(eggPoseAt(s, 100, E).lift).toBe(0);
  });
});
