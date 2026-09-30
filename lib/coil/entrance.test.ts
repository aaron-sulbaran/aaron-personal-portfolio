import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  basisToQuat,
  entranceClock,
  entranceHelix,
  entranceNameAlpha,
  entrancePose,
  inBand,
  isBeforeEntrance,
  isEntering,
  isRested,
  pullPhases,
  pullProgress,
  quatToBasis,
  shutterProgress,
  shutterRank,
  slerpBasis,
} from "@/lib/coil/entrance";
import { coilPose, restHelix, solveGeometry, type Basis, type CoilGeometry, type HelixFrame } from "@/lib/coil/geometry";

const TAU = Math.PI * 2;
const T = COIL.entrance.durationMs;

const wide = (n: number) => solveGeometry({ width: 1440, height: 900 }, n);
const narrow = (n: number) => solveGeometry({ width: 390, height: 844 }, n);
const cases: [string, CoilGeometry][] = [
  ["wide, 14 cards", wide(14)],
  ["wide, 20 cards", wide(20)],
  ["narrow, 14 cards", narrow(14)],
  ["narrow, 20 cards", narrow(20)],
];

// Every card on the frame at conveyor offset 0 (the entrance holds the conveyor).
function slotsOf(geo: CoilGeometry, frame: HelixFrame, ms: number) {
  const clock = entranceClock(ms);
  return Array.from({ length: geo.slotCount }, (_, j) => {
    const pose = coilPose(frame, j, 0);
    return entrancePose(pose, { strandPosition: pose.strandPosition, cardCount: geo.cardCount }, geo, clock);
  });
}

describe("entrance clock", () => {
  it("runs 1800ms from the constants", () => {
    expect(T).toBe(1800);
    expect(entranceClock(900).elapsedS).toBeCloseTo(0.9, 9);
    expect(entranceClock(900).durationS).toBeCloseTo(1.8, 9);
    expect(isBeforeEntrance(entranceClock(-1))).toBe(true);
    expect(isEntering(entranceClock(0))).toBe(true);
    expect(isRested(entranceClock(T))).toBe(true);
    expect(isRested(entranceClock(Number.POSITIVE_INFINITY))).toBe(true);
    expect(isBeforeEntrance(entranceClock(Number.NEGATIVE_INFINITY))).toBe(true);
  });

  it("holds the closed band a beat between the last shutter and the pull", () => {
    const e = COIL.entrance;
    for (const n of [14, 20]) {
      const shutterEnds = (e.shutterStart + (n - 1) * e.shutterStagger + e.fly) * T;
      const hold = e.pullStart * T - shutterEnds;
      expect(hold).toBeGreaterThan(120);
    }
    // 20 cards: the lab's beat of about 160ms.
    expect(e.pullStart * T - (e.shutterStart + 19 * e.shutterStagger + e.fly) * T).toBeCloseTo(163.8, 1);
  });

  it("pulls on the pull curve, with the axial parting leading the winding", () => {
    expect(pullProgress(entranceClock(COIL.entrance.pullStart * T - 1))).toBe(0);
    expect(pullProgress(entranceClock(T))).toBe(1);
    let last = 0;
    for (let ms = 0; ms <= T; ms += 5) {
      const p = pullProgress(entranceClock(ms));
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      last = p;
      const { part, wind } = pullPhases(p);
      // The winding never starts before the seam has fully parted.
      if (wind > 0) expect(part).toBe(1);
    }
  });
});

describe.each(cases)("entrance, %s", (_label, geo) => {
  const rest = restHelix(geo);

  it("hides every card before it starts", () => {
    slotsOf(geo, entranceHelix(rest, geo, entranceClock(-1)), -1).forEach((pose) => expect(pose.alpha).toBe(0));
  });

  it("lands exactly on the rest pose", () => {
    const clock = entranceClock(T);
    expect(entranceHelix(rest, geo, clock)).toBe(rest);
    for (let j = 0; j < geo.slotCount; j++) {
      const pose = coilPose(rest, j, 0);
      expect(entrancePose(pose, { strandPosition: pose.strandPosition, cardCount: geo.cardCount }, geo, clock)).toBe(pose);
    }
  });

  it("arrives at rest continuously (no jump on the last frame)", () => {
    const frame = entranceHelix(rest, geo, entranceClock(T - 1));
    expect(frame.angStep).toBeCloseTo(rest.angStep, 4);
    expect(frame.dy).toBeCloseTo(rest.dy, 4);
    expect(frame.cardWorld).toBeCloseTo(rest.cardWorld, 4);
    expect(frame.leanRad).toBeCloseTo(rest.leanRad, 4);
    const before = slotsOf(geo, frame, T - 1);
    const after = slotsOf(geo, rest, T);
    before.forEach((pose, j) => {
      for (let k = 0; k < 3; k++) expect(pose.position[k]).toBeCloseTo(after[j].position[k], 3);
      expect(pose.alpha).toBeCloseTo(after[j].alpha, 3);
    });
  });

  it("closes into one band: every card on one turn at the band lean and size", () => {
    const ms = COIL.entrance.pullStart * T - 1;
    const frame = entranceHelix(rest, geo, entranceClock(ms));
    expect(frame.angStep).toBeCloseTo(TAU / geo.cardCount, 9);
    expect(frame.dy).toBe(0);
    expect(frame.cardWorld).toBeCloseTo(geo.bandCardWorld, 9);
    expect(frame.leanRad).toBeCloseTo((COIL.camera.bandLeanDeg * Math.PI) / 180, 9);
    const poses = slotsOf(geo, frame, ms);
    for (let j = 0; j < geo.slotCount; j++) {
      const pose = coilPose(frame, j, 0);
      if (inBand(pose.strandPosition, geo.cardCount)) {
        // Shuttered all the way into the band: the band pose itself.
        expect(poses[j]).toEqual(pose);
      } else {
        expect(poses[j].alpha).toBe(0);
      }
    }
  });

  it("starts from a stack at the helix center, square to the camera", () => {
    const ms = COIL.entrance.shutterStart * T - 1;
    const frame = entranceHelix(rest, geo, entranceClock(ms));
    slotsOf(geo, frame, ms).forEach((pose, j) => {
      const s = coilPose(frame, j, 0).strandPosition;
      if (!inBand(s, geo.cardCount)) return;
      expect(Math.hypot(pose.position[0] - geo.center[0], pose.position[1] - geo.center[1])).toBeLessThan(1e-9);
      expect(pose.basis.z[2]).toBeCloseTo(1, 9);
      expect(pose.alpha).toBeGreaterThan(0.99);
    });
  });

  // The band's ends may only sweep past each other while the parted seam
  // holds them apart. Measured on the unrolled cylinder in the cards' own
  // tilted frame (along the strand and across it), two cards are clear when
  // they are apart along (more than a card width) or across (more than a card
  // height); their distance is the larger of those two gaps.
  //
  // The winding (from windStart, once the seam has fully parted) is a clean
  // miss: the distance stays above zero at every sampled moment, for the ends
  // and every other pair that wraps a turn. While the seam parts, the ends'
  // own tilt (the cards follow the washer's slope, as in the lab) brings two
  // corners within a hair of each other for a few milliseconds; that contact
  // is bounded here and never becomes a crossing.
  it("never lets the band's ends cross, and winds them past each other cleanly", () => {
    const n = geo.cardCount;
    const first = -n / 2;
    const last = n / 2 - 1;
    let endsSwept = false;
    let minWindingDistance = Infinity;
    let partingContactMs = 0;
    let partingContactArea = 0;
    for (let ms = COIL.entrance.pullStart * T; ms <= T; ms += 0.5) {
      const clock = entranceClock(ms);
      const winding = pullPhases(pullProgress(clock)).wind > 0;
      const frame = entranceHelix(rest, geo, clock);
      const arc = frame.radius * frame.angStep;
      const length = Math.hypot(arc, frame.dy);
      let contact = false;
      for (let i = first; i <= last; i++) {
        for (let k = i + 1; k <= last; k++) {
          const turns = Math.round(((k - i) * frame.angStep) / TAU);
          if (turns === 0) continue; // the same turn: neighbors, spaced by the gap
          const alongArc = (k - i) * arc - turns * TAU * frame.radius;
          const rise = (k - i) * frame.dy;
          const along = Math.abs(arc * alongArc + frame.dy * rise) / length;
          const across = (arc * rise - frame.dy * alongArc) / length;
          // The later card never crosses to the other side of the earlier one.
          expect(across).toBeGreaterThanOrEqual(0);
          const distance = Math.max(along - COIL.cardAspect, across - 1);
          if (i === first && k === last && along < COIL.cardAspect) endsSwept = true;
          if (winding) minWindingDistance = Math.min(minWindingDistance, distance);
          else if (distance <= 0) {
            contact = true;
            partingContactArea = Math.max(partingContactArea, (COIL.cardAspect - along) * (1 - across));
          }
        }
      }
      if (contact) partingContactMs += 0.5;
    }
    expect(endsSwept).toBe(true);
    expect(minWindingDistance).toBeGreaterThan(0);
    expect(partingContactMs).toBeLessThan(20);
    expect(partingContactArea).toBeLessThan(0.0025); // of a card's 0.75: under half a percent
  });

  it("deals the band in order from the first card, 1 card per stagger", () => {
    const n = geo.cardCount;
    expect(shutterRank(0, n)).toBe(0);
    expect(shutterRank(-1, n)).toBe(n - 1);
    const at = (COIL.entrance.shutterStart + COIL.entrance.fly / 2) * T;
    for (let rank = 1; rank < n; rank++) {
      expect(shutterProgress(rank, entranceClock(at))).toBeLessThanOrEqual(shutterProgress(rank - 1, entranceClock(at)));
    }
  });
});

describe("the name", () => {
  it("is held by the loader, lands at the handoff, or fades up with the pull", () => {
    expect(entranceNameAlpha(entranceClock(-1), null)).toBe(0);
    expect(entranceNameAlpha(entranceClock(COIL.entrance.pullStart * T), null)).toBe(0);
    expect(entranceNameAlpha(entranceClock((1 + COIL.entrance.pullStart) * T * 0.5), null)).toBeCloseTo(0.5, 6);
    expect(entranceNameAlpha(entranceClock(T), null)).toBe(1);
    expect(entranceNameAlpha(entranceClock(500), false)).toBe(0);
    expect(entranceNameAlpha(entranceClock(500), true)).toBe(1);
  });
});

describe("rotations", () => {
  const close = (a: Basis, b: Basis) =>
    (["x", "y", "z"] as const).forEach((axis) => a[axis].forEach((v, i) => expect(v).toBeCloseTo(b[axis][i], 9)));

  it("round-trips a basis through a quaternion", () => {
    const geo = wide(14);
    for (let j = 0; j < geo.slotCount; j += 3) {
      const { basis } = coilPose(restHelix(geo), j, 0.37);
      close(quatToBasis(basisToQuat(basis)), basis);
    }
  });

  it("slerps between its ends and stays orthonormal", () => {
    const geo = wide(14);
    const a: Basis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const { basis: b } = coilPose(restHelix(geo), 5, 0);
    close(slerpBasis(a, b, 0), a);
    close(slerpBasis(a, b, 1), b);
    const mid = slerpBasis(a, b, 0.5);
    const dot = (u: readonly number[], v: readonly number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    expect(dot(mid.x, mid.x)).toBeCloseTo(1, 9);
    expect(dot(mid.x, mid.y)).toBeCloseTo(0, 9);
    expect(dot(mid.y, mid.z)).toBeCloseTo(0, 9);
  });
});
