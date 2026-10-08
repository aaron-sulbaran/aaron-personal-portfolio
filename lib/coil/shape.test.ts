import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { pullCurve, pullHelix } from "@/lib/coil/entrance";
import { coilPose, mod, poseAt, restHelix, solveGeometry, type CoilGeometry } from "@/lib/coil/geometry";
import { latchPositions } from "@/lib/coil/unwind";
import { bandCopy, createShapeClock, isSwitching, shapePose, shapePull, stepShapeClock } from "@/lib/coil/shape";
describe("toggle timing", () => {
  it("plays over the entrance's pull: (1 - pullStart) of its 1800ms, 756ms", () => {
    expect(COIL.toggle.durationMs).toBe(Math.round((1 - COIL.entrance.pullStart) * COIL.entrance.durationMs));
    expect(COIL.toggle.durationMs).toBe(756);
  });
  it("trails the capsule's second edge by Aaron's 99ms", () => expect(COIL.toggle.trailingDelayMs).toBe(99));
});
const panes = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
const cases: CoilGeometry[] = panes.flatMap((pane) => [14, 20].map((n) => solveGeometry(pane, n)));
const OFFSETS = [0, 3, -7, 0.25, 3.4, -7.49, 41.3, -120.8];
describe("shape clock", () => {
  it("starts at its shape, at rest (a scene rebuilt in the band starts there)", () => {
    expect([createShapeClock("coil").progress, createShapeClock("band").progress]).toEqual([1, 0]);
    expect([shapePull(createShapeClock("coil")), shapePull(createShapeClock("band"))]).toEqual([1, 0]);
  });
  it("reaches the band in 756ms of frames and not before", () => {
    const clock = createShapeClock("coil");
    for (let i = 0; i < 45; i++) stepShapeClock(clock, "band", 1 / 60);
    expect(clock.progress).toBeGreaterThan(0);
    stepShapeClock(clock, "band", 1 / 60);
    expect(clock.progress).toBe(0);
  });
  it("reads the pose through the entrance's pull curve", () => {
    for (const progress of [0.1, 0.3, 0.5, 0.9]) expect(shapePull({ progress })).toBeCloseTo(pullCurve(COIL)(progress), 12);
  });
  it("turns around mid-switch from where it is", () => {
    const clock = createShapeClock("coil");
    stepShapeClock(clock, "band", 0.3);
    const mid = clock.progress;
    expect(mid).toBeCloseTo(1 - 300 / 756, 12);
    stepShapeClock(clock, "coil", 1 / 60);
    expect(clock.progress - mid).toBeCloseTo(1000 / 60 / 756, 12);
    stepShapeClock(clock, "coil", 0.3);
    expect(clock.progress).toBe(1);
  });
  it("holds on a still frame or a stopped scene (no time passes)", () => expect(stepShapeClock({ progress: 0.4 }, "band", 0).progress).toBe(0.4));
});
describe("the band's cards", () => {
  const bandSlots = (geo: CoilGeometry, offset: number) => {
    const frame = pullHelix(restHelix(geo), geo, 0);
    return Array.from({ length: geo.slotCount }, (_, j) => coilPose(frame, j, offset)).filter((pose) => bandCopy(pose.u, geo.cardCount));
  };
  // Needs two spare slots (M >= N + 2): with M == N the window's end copy falls outside the slots or
  // under the strand-end fade. Today's 14 cards give M >= 16 on every pane; the 20-card narrow cases do not.
  it("shows one copy of each card, the copy the unwind latches, all drawn", () => {
    for (const geo of cases.filter((g) => g.slotCount >= g.cardCount + 2)) {
      for (const offset of OFFSETS) {
        const shown = bandSlots(geo, offset);
        expect(new Set(shown.map((pose) => mod(pose.strandPosition, geo.cardCount))).size).toBe(geo.cardCount);
        expect(shown.filter((pose) => pose.alpha > 0.01).length).toBe(geo.cardCount);
        const latched = latchPositions(offset, geo.cardCount).sort((a, b) => a - b);
        expect(shown.map((pose) => pose.strandPosition).sort((a, b) => a - b)).toEqual(latched);
      }
    }
  });
  it("hands each card to its copy at the same spot on the ring, so the turning band never pops", () => {
    for (const geo of cases) {
      const frame = pullHelix(restHelix(geo), geo, 0);
      const leaving = poseAt(frame, geo.cardCount / 2 - 1e-9).position;
      const arriving = poseAt(frame, -geo.cardCount / 2 - 1e-9).position;
      expect(Math.hypot(leaving[0] - arriving[0], leaving[1] - arriving[1], leaving[2] - arriving[2])).toBeLessThan(1e-6);
    }
  });
  it("mid-switch the seam's two ends sit apart, so the strand must hold", () => {
    for (const geo of cases) for (const pull of [0.05, 0.2, 0.5, 0.8]) {
      const frame = pullHelix(restHelix(geo), geo, pull);
      const a = poseAt(frame, geo.cardCount / 2 - 1e-9).position;
      const b = poseAt(frame, -geo.cardCount / 2 - 1e-9).position;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(1e-3);
    }
    expect([0, 0.3, 1].map((progress) => isSwitching({ progress }))).toEqual([false, true, false]);
  });
  it("leaves every pose alone at pull 1, and hides the other copies at pull 0", () => {
    const geo = cases[0];
    const frame = pullHelix(restHelix(geo), geo, 0);
    for (let j = 0; j < geo.slotCount; j++) {
      const pose = coilPose(frame, j, 3.4);
      expect(shapePose(pose, geo.cardCount, 1)).toBe(pose);
      expect(shapePose(pose, geo.cardCount, 0).alpha).toBe(bandCopy(pose.u, geo.cardCount) ? pose.alpha : 0);
    }
  });
});
