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
import { buildGlyph, glyphPose } from "./face";
import { eggTransform, letterTransform, periodBox, periodFrame, shadowEllipse, type EggTransform } from "./frame";
import { footerGeometry, wordRest } from "./geometry";
import { bounds } from "./primitives";

// Ported from the footer lab's round 4 tests (branch lab, app/lab/footer/tests/round4.test.ts).

const E = FOOTER.egg;
const EPS = 1e-9;
const TEXT = "build.stuff";

type Pt = readonly [number, number];
const turn = ([x, y]: Pt, deg: number, cx: number, cy: number): Pt => {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};

// An SVG transform list applied to a point, its last function first, as SVG applies them.
function applySvg(transform: string, p: Pt): Pt {
  const ops = [...transform.matchAll(/(translate|scale|rotate)\(([^)]*)\)/g)].map((m) => ({ op: m[1], a: m[2].trim().split(/\s+/).map(Number) }));
  return ops.reduceRight<Pt>((q, { op, a }) => {
    if (op === "translate") return [q[0] + a[0], q[1] + (a[1] ?? 0)];
    if (op === "scale") return [q[0] * a[0], q[1] * (a[1] ?? a[0])];
    return turn(q, a[0], a[1] ?? 0, a[2] ?? 0);
  }, p);
}

// letterTransform's chain with an egg and no press, in full precision (its string rounds to hundredths of a px).
function placeExact(p: Pt, x: number, y: number, pivot: number, t: EggTransform): Pt {
  const q = turn([p[0] - pivot, p[1]], t.angle, 0, t.cy);
  return [x + pivot + q[0] * t.sx, y - t.liftPx + t.bottomY + (q[1] - t.bottomY) * t.sy];
}

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

  it("is the rest box at swell 0, so a period at rest is written as before", () => {
    const p = [...TEXT].indexOf(".");
    for (const width of [390, 1440]) {
      const geo = footerGeometry(TEXT, width, 600, 180);
      const rest = wordRest(TEXT, geo);
      const { box, half } = periodFrame(0, geo.size, geo.baselineY);
      expect(half).toBe(rest.halfWidths[p]);
      expect(box).toEqual(periodBox(rest.centers[p].y, geo.baselineY, rest.halfWidths[p]));
    }
  });

  it("turns a swollen period about its own center, its lowest corner on the baseline and never under it", () => {
    const size = 196; // a unit at 1440
    const baselineY = 500;
    const { box, half } = periodFrame(1, size, baselineY);
    // The square as drawn at the swell's reach, px in its letter's space (y down, the baseline at 0).
    const g = bounds(buildGlyph(".", glyphPose(FOOTER.face, FOOTER.swell.amount, 1, 1)).contours);
    const corners: Pt[] = [
      [g.x0 * size, -g.y0 * size],
      [g.x1 * size, -g.y0 * size],
      [g.x0 * size, -g.y1 * size],
      [g.x1 * size, -g.y1 * size],
    ];
    for (let angle = 0; angle <= E.turnDeg + E.overshootDeg; angle += 0.5) {
      const t = eggTransform({ ...REST_POSE, angle }, box, size, 1);
      const exact = corners.map((c) => placeExact(c, 100, baselineY, half, t));
      const lowest = (Math.max(...exact.map((q) => q[1])) - baselineY) / size;
      expect(Math.abs(lowest), `${angle} degrees`).toBeLessThanOrEqual(1e-6);
      // The written transform draws the same square (to its string's precision).
      const written = letterTransform(100, baselineY, half, 1, t);
      corners.forEach((c, i) => {
        const q = applySvg(written, c);
        expect(q[0]).toBeCloseTo(exact[i][0], 1);
        expect(q[1]).toBeCloseTo(exact[i][1], 1);
      });
    }
    expect(2 * half).toBeCloseTo((FOOTER.face.stem + FOOTER.swell.amount) * size, 9);
  });

  it("lays the shadow under the period from the lab's shares, its ry floored, its opacity the pose's share", () => {
    const S = FOOTER.eggShadow;
    const box = periodBox(185, 200, 15); // a 30px square sitting on the baseline at 200
    const rest = shadowEllipse(box, REST_POSE, 112, 200);
    expect(rest.cx).toBe(112);
    expect(rest.cy).toBeCloseTo(200 + S.drop * 30, 9);
    expect(rest.rx).toBeCloseTo(S.rx * 30, 9);
    expect(rest.ry).toBeCloseTo(S.ry * 30, 9);
    expect(rest.opacity).toBe(0);
    expect(shadowEllipse(periodBox(199, 200, 1), REST_POSE, 0, 200).ry).toBe(S.minRyPx); // a 2px period: 0.32px, floored
    const air = shadowEllipse(box, { ...REST_POSE, shadow: 0.5, shadowScale: 0.6 }, 112, 200);
    expect(air.opacity).toBeCloseTo(E.shadow * 0.5, 9);
    expect(air.rx).toBeCloseTo(S.rx * 30 * 0.6, 9);
    expect(air.ry).toBeCloseTo(S.ry * 30 * 0.6, 9);
    expect(air.cy).toBe(rest.cy);
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

  it("ends a hop at once when reduced motion comes on mid-air, the queued one too; a later ask only turns", () => {
    const s = createEggState();
    askEgg(s);
    askEgg(s); // a second click, queued
    stepEgg(s, 0, ctx, life);
    const midAir = (eggPhases(E).takeoff + eggPhases(E).landing) / 2;
    stepEgg(s, midAir, ctx, life);
    expect(eggPoseAt(s, midAir, E).lift).toBeGreaterThan(0);
    const still = { ...ctx, reduced: true };
    stepEgg(s, midAir + 16, still, life);
    expect(eggPoseAt(s, midAir + 16, E)).toBe(REST_POSE);
    expect(eggBusy(s)).toBe(false);
    askEgg(s);
    stepEgg(s, midAir + 100, still, life);
    const turning = eggPoseAt(s, midAir + 100 + REDUCED_TURN_MS / 2, E);
    expect(turning.lift).toBe(0);
    expect(turning.angle).toBeCloseTo(45, 9);
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
