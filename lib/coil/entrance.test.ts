import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { sceneMs } from "@/lib/coil/dealSpeed";
import {
  OPEN_ALL,
  basisToQuat,
  entranceClock,
  entranceHelix,
  entranceNameAlpha,
  entrancePose,
  fieldMask,
  flattenProgress,
  inRing,
  isBeforeEntrance,
  isEntering,
  isRested,
  openProgress,
  outOfBandAlpha,
  pullCurve,
  pullHelix,
  pullPhases,
  pullProgress,
  quatToBasis,
  slerpBasis,
  tunedConstants,
  wheelHelix,
  wheelPlacement,
  wheelSlideProgress,
} from "@/lib/coil/entrance";
import { coilPose, mod, restHelix, solveGeometry, type Basis, type CoilGeometry, type HelixFrame } from "@/lib/coil/geometry";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const TL = COIL.deal.timeline;
const T = sceneMs();
const PULL_END = TL.pullStartMs + TL.pullMs;

const wide = (n: number) => solveGeometry({ width: 1440, height: 900 }, n);
const narrow = (n: number) => solveGeometry({ width: 390, height: 844 }, n);
const cases: [string, CoilGeometry][] = [
  ["wide, 14 cards", wide(14)],
  ["wide, 20 cards", wide(20)],
  ["narrow, 14 cards", narrow(14)],
  ["narrow, 20 cards", narrow(20)],
];

// Every card of the entrance at a conveyor offset, as the scene poses them.
function slotsOf(geo: CoilGeometry, frame: HelixFrame, ms: number, offset = 0, wheelIn = 1, drift = 0) {
  const clock = entranceClock(ms, COIL, wheelIn, drift);
  return Array.from({ length: geo.slotCount }, (_, j) => {
    const pose = coilPose(frame, j, offset);
    return { raw: pose, shown: entrancePose(pose, { cardCount: geo.cardCount }, clock), member: inRing(pose.u, drift, geo.cardCount) };
  });
}

describe("entrance clock", () => {
  it("runs until the pull has landed and the field is open", () => {
    expect(T).toBe(Math.max(TL.pullStartMs + TL.pullMs, TL.openStartMs + COIL.deal.open.ms));
    expect(entranceClock(900).elapsedS).toBeCloseTo(0.9, 9);
    expect(entranceClock(900).durationS).toBeCloseTo(T / 1000, 9);
    expect(isBeforeEntrance(entranceClock(-1))).toBe(true);
    expect(isEntering(entranceClock(0))).toBe(true);
    expect(isRested(entranceClock(T))).toBe(true);
    expect(isRested(entranceClock(T - 1))).toBe(false);
    expect(isRested(entranceClock(Number.POSITIVE_INFINITY))).toBe(true);
    expect(isBeforeEntrance(entranceClock(Number.NEGATIVE_INFINITY))).toBe(true);
  });

  it("follows the spec's table: the flatten overlaps the lift by 150 ms, the lift lands before the field is fully open", () => {
    expect(TL.flattenStartMs + TL.flattenMs - TL.pullStartMs).toBe(150);
    expect(TL.pullStartMs + TL.pullMs).toBeLessThan(TL.openStartMs + COIL.deal.open.ms);
    expect(TL.slowStartMs).toBeGreaterThan(TL.upMs);
    expect(TL.slowStartMs + TL.slowMs).toBeLessThanOrEqual(TL.pullStartMs + TL.pullMs);
  });

  it("pulls on the pull curve, with the axial parting leading the winding", () => {
    expect(pullProgress(entranceClock(TL.pullStartMs - 1))).toBe(0);
    expect(pullProgress(entranceClock(TL.pullStartMs))).toBe(0);
    expect(pullProgress(entranceClock(PULL_END))).toBe(1);
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

  it("flattens the wheel into the band on power2.inOut, and is nearly there when the lift starts", () => {
    expect(flattenProgress(entranceClock(-5))).toBe(0);
    expect(flattenProgress(entranceClock(TL.flattenStartMs))).toBe(0);
    expect(flattenProgress(entranceClock(TL.flattenStartMs + TL.flattenMs / 2))).toBeCloseTo(0.5, 9);
    expect(flattenProgress(entranceClock(TL.flattenStartMs + TL.flattenMs))).toBe(1);
    expect(flattenProgress(entranceClock(TL.pullStartMs))).toBeGreaterThan(0.99);
    // No dwell: the flatten ends with zero slope while the lift has begun, so
    // the two never both stand still.
    const slope = (ms: number) => flattenProgress(entranceClock(ms + 1)) - flattenProgress(entranceClock(ms));
    expect(slope(TL.flattenStartMs + TL.flattenMs - 1)).toBeLessThan(1e-4);
  });
});

describe("tuned constants (the deal's lab)", () => {
  it("is COIL itself when nothing is tuned or the values are the defaults", () => {
    const same = { timeline: { ...COIL.deal.timeline }, wheel: { ...COIL.deal.wheel, anchor: undefined }, open: { ms: COIL.deal.open.ms, reach: COIL.deal.open.reach } };
    expect(tunedConstants(undefined)).toBe(COIL);
    expect(tunedConstants({ timeline: { upMs: COIL.deal.timeline.upMs } })).toBe(COIL);
    expect(tunedConstants(same as never)).not.toBeUndefined();
    expect(entranceClock(0, tunedConstants({ open: { ms: COIL.deal.open.ms } })).c).toBeUndefined();
  });

  it("memoizes a tuned set and runs the whole deal on its timeline", () => {
    const tuning = { timeline: { pullStartMs: 1800, openStartMs: 2000 }, open: { ms: 2000 } };
    const c = tunedConstants(tuning);
    expect(tunedConstants({ ...tuning })).toBe(c);
    expect(c.deal.timeline.pullStartMs).toBe(1800);
    expect(c.deal.timeline.pullMs).toBe(TL.pullMs);
    expect(c.deal.wheel).toEqual(COIL.deal.wheel);
    const clock = entranceClock(1900, c);
    expect(clock.durationS).toBeCloseTo(4, 9);
    expect(clock.c).toBe(c);
    expect(isRested(entranceClock(4000, c))).toBe(true);
    expect(isRested(entranceClock(3999, c))).toBe(false);
    // The functions read the clock's own constants by default.
    expect(pullProgress(clock)).toBeCloseTo(pullProgress(clock, c), 12);
    expect(pullProgress(entranceClock(2300, c))).toBeGreaterThan(pullProgress(entranceClock(2300)));
  });
});

describe.each(cases)("the wheel and the pull, %s", (_label, geo) => {
  const rest = restHelix(geo);
  // The absolute strand positions of the ring's cards at a moment.
  const idsIn = (frame: HelixFrame, ms: number, offset: number, drift = 0) =>
    slotsOf(geo, frame, ms, offset, 1, drift)
      .filter(({ member }) => member)
      .map(({ raw }) => Math.round(raw.u - offset));

  it("starts as the wheel: the band's ring with an upright axis, a few degrees of lean and the slot's size", () => {
    const frame = entranceHelix(rest, geo, entranceClock(-1));
    const wheel = wheelPlacement(geo);
    expect(frame.angStep).toBeCloseTo(TAU / geo.cardCount, 12);
    expect(frame.dy).toBe(0);
    expect(frame.axisRad).toBe(0);
    expect(frame.leanRad).toBeCloseTo(COIL.deal.wheel.leanDeg * DEG, 12);
    expect(frame.cardWorld).toBeCloseTo(geo.wheelCardWorld * COIL.deal.wheel.scale, 12);
    expect(frame.center).toEqual(wheel.center);
  });

  it("lands exactly on the rest pose", () => {
    const clock = entranceClock(T);
    expect(entranceHelix(rest, geo, clock)).toBe(rest);
    for (let j = 0; j < geo.slotCount; j++) {
      const pose = coilPose(rest, j, 0);
      expect(entrancePose(pose, { cardCount: geo.cardCount }, clock)).toBe(pose);
    }
  });

  it("arrives at rest continuously (no jump on the last frame)", () => {
    const frame = entranceHelix(rest, geo, entranceClock(T - 1));
    expect(frame.angStep).toBeCloseTo(rest.angStep, 4);
    expect(frame.dy).toBeCloseTo(rest.dy, 4);
    expect(frame.cardWorld).toBeCloseTo(rest.cardWorld, 4);
    expect(frame.leanRad).toBeCloseTo(rest.leanRad, 4);
    expect(frame.axisRad).toBeCloseTo(rest.axisRad, 4);
    slotsOf(geo, frame, T - 1).forEach(({ shown }, j) => {
      const after = coilPose(rest, j, 0);
      for (let k = 0; k < 3; k++) expect(shown.position[k]).toBeCloseTo(after.position[k], 3);
      expect(shown.alpha).toBeCloseTo(after.alpha, 3);
    });
  });

  it("is the band, not yet lifted, once flattened: every card on one turn at the band lean and size", () => {
    const band = pullHelix(rest, geo, 0);
    expect(band.angStep).toBeCloseTo(TAU / geo.cardCount, 9);
    expect(band.dy).toBe(0);
    expect(band.cardWorld).toBeCloseTo(geo.bandCardWorld, 9);
    expect(band.leanRad).toBeCloseTo(COIL.camera.bandLeanDeg * DEG, 9);
    // The wheel at flatten 1 is that band, untouched.
    expect(wheelHelix(band, geo, 1, 1)).toBe(band);
    const halfway = wheelHelix(band, geo, 0.5, 1);
    expect(halfway.leanRad).toBeCloseTo((band.leanRad + COIL.deal.wheel.leanDeg * DEG) / 2, 9);
    expect(halfway.axisRad).toBeCloseTo(band.axisRad / 2, 9);
    expect(halfway.cardWorld).toBeCloseTo((band.cardWorld + geo.wheelCardWorld) / 2, 12);
  });

  it("has exactly the ring's cards, each once, at any offset of the turning strand", () => {
    const frame = entranceHelix(rest, geo, entranceClock(0));
    for (const offset of [0, 0.3, 5.5, 13.9, 100.2, -37.7]) {
      const ids = idsIn(frame, 0, offset);
      expect(ids.length, `offset ${offset}`).toBe(geo.cardCount);
      expect(new Set(ids.map((id) => mod(id, geo.cardCount))).size, `offset ${offset}`).toBe(geo.cardCount);
      // The copies outside it wait hidden.
      slotsOf(geo, frame, 0, offset).forEach(({ member, shown }) => {
        if (!member) expect(shown.alpha).toBe(0);
      });
    }
  });

  it("poses a card and its twin one turn away at the same place, so crossing the window's edge is not seen", () => {
    const frame = entranceHelix(rest, geo, entranceClock(0));
    const poses = Array.from({ length: geo.slotCount }, (_, j) => coilPose(frame, j, 0.37));
    let pairs = 0;
    for (const a of poses) {
      const twin = poses.find((b) => Math.abs(b.u - a.u - geo.cardCount) < 1e-9);
      if (!twin) continue;
      pairs++;
      for (let k = 0; k < 3; k++) expect(twin.position[k]).toBeCloseTo(a.position[k], 9);
      expect(twin.fade).toBeCloseTo(a.fade, 9);
      expect(twin.depth).toBeCloseTo(a.depth, 9);
      expect(mod(twin.strandPosition, geo.cardCount)).toBe(mod(a.strandPosition, geo.cardCount));
    }
    // (A pane that needs no repeats has no twins: the strand is the ring.)
    if (geo.slotCount >= geo.cardCount * 1.5) expect(pairs).toBeGreaterThan(0);
  });

  it("keeps the ring's cards in it while the band opens, however far the strand turns", () => {
    const startMs = TL.pullStartMs - 1;
    const offset0 = 5.37;
    const first = idsIn(entranceHelix(rest, geo, entranceClock(startMs)), startMs, offset0);
    expect(first.length).toBe(geo.cardCount);
    // The strand turns by `drift` cards through the first part of the pull.
    const ms = TL.pullStartMs + 150;
    expect(outOfBandAlpha(pullProgress(entranceClock(ms)))).toBe(0);
    const drift = 2.3;
    const room = geo.slotCount / 2 - (geo.cardCount / 2 + drift + 1);
    if (room > 0) {
      const later = idsIn(entranceHelix(rest, geo, entranceClock(ms)), ms, offset0 + drift, drift);
      expect([...later].sort((a, b) => a - b)).toEqual([...first].sort((a, b) => a - b));
    }
  });

  it("waits hidden until the wheel has slid in, then shows the ring", () => {
    const hidden = slotsOf(geo, entranceHelix(rest, geo, entranceClock(0, COIL, 0)), 0, 0, 0);
    hidden.forEach(({ shown }) => expect(shown.alpha).toBe(0));
    const half = slotsOf(geo, entranceHelix(rest, geo, entranceClock(0, COIL, 0.5)), 0, 0, 0.5);
    half.forEach(({ raw, shown, member }) => expect(shown.alpha).toBeCloseTo(member ? raw.alpha * 0.5 : 0, 9));
  });

  it("hides the copies outside the ring until late in the pull, and fades them in as the pull nears its end", () => {
    const early = slotsOf(geo, entranceHelix(rest, geo, entranceClock(1000)), 1000);
    early.forEach(({ member, shown }) => {
      if (!member) expect(shown.alpha).toBe(0);
    });
    const late = slotsOf(geo, entranceHelix(rest, geo, entranceClock(PULL_END - 5)), PULL_END - 5);
    late.forEach(({ raw, shown }) => expect(shown.alpha).toBeCloseTo(raw.alpha, 1));
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
    for (let ms = TL.pullStartMs; ms <= TL.pullStartMs + TL.pullMs; ms += 0.5) {
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
  }, 20000);});

describe("the wheel's place", () => {
  const slotted = solveGeometry({ width: 880, height: 736 }, 14, COIL, { canvas: { width: 1280, height: 736 }, wheelSlot: { cx: 640, cy: 380, diameter: 320 } });
  const unslotted = solveGeometry({ width: 880, height: 736 }, 14, COIL, { canvas: { width: 1280, height: 736 } });

  it("takes the slot's center and size as shares of the canvas, independent of scroll", () => {
    expect(slotted.canvas).toEqual({ width: 1280, height: 736 });
    expect(slotted.wheelAnchor.x).toBeCloseTo(0.5, 12);
    expect(slotted.wheelAnchor.y).toBeCloseTo(380 / 736, 12);
    // The ring's width edge to edge, in px, is the slot's diameter.
    const bandRadius = (14 * slotted.step) / TAU;
    expect((2 * bandRadius + 0.3) * (slotted.wheelCardWorld / slotted.camera.worldPerPx)).toBeCloseTo(320, 9);
  });

  it("falls back to the constants' anchor and a share of the canvas's height where the page has no slot", () => {
    expect(unslotted.wheelAnchor).toEqual({ x: COIL.deal.wheel.anchor[0], y: COIL.deal.wheel.anchor[1] });
    const bandRadius = (14 * unslotted.step) / TAU;
    expect((2 * bandRadius + 0.3) * (unslotted.wheelCardWorld / unslotted.camera.worldPerPx)).toBeCloseTo(COIL.deal.wheel.diameterOfHeight * 736, 9);
  });

  it("projects to the anchor on the canvas, nudged by the lab's offsets", () => {
    const px = (frame: ReturnType<typeof wheelPlacement>) => ({
      x: 640 + frame.center[0] / slotted.camera.worldPerPx,
      y: 368 - frame.center[1] / slotted.camera.worldPerPx,
    });
    const at = px(wheelPlacement(slotted));
    expect(at.x).toBeCloseTo(640, 9);
    expect(at.y).toBeCloseTo(380, 9);
    const nudged = tunedConstants({ wheel: { offsetX: 0.1, offsetY: 0.05, scale: 1.2 } });
    const moved = px(wheelPlacement(slotted, nudged));
    expect(moved.x).toBeCloseTo(640 + 0.1 * 1280, 9);
    expect(moved.y).toBeCloseTo(380 + 0.05 * 736, 9);
    expect(wheelPlacement(slotted, nudged).cardWorld).toBeCloseTo(slotted.wheelCardWorld * 1.2, 12);
  });

  it("slides in from the right by slideFrom of the canvas, on the site's ease", () => {
    const band = pullHelix(restHelix(slotted), slotted, 0);
    const seated = wheelHelix(band, slotted, 0, 1);
    const away = wheelHelix(band, slotted, 0, 0);
    expect((away.center[0] - seated.center[0]) / slotted.camera.worldPerPx).toBeCloseTo(COIL.deal.wheel.slideFrom * 1280, 9);
    expect(away.center[1]).toBe(seated.center[1]);
    expect(wheelSlideProgress(0)).toBe(0);
    expect(wheelSlideProgress(COIL.deal.wheel.slideMs)).toBe(1);
    expect(wheelSlideProgress(COIL.deal.wheel.slideMs / 2)).toBeGreaterThan(0.5);
  });

  it("flows through the tuning: a tuned lean is the wheel's lean", () => {
    const c = tunedConstants({ wheel: { leanDeg: -25 } });
    expect(wheelPlacement(slotted, c).leanRad).toBeCloseTo(-25 * DEG, 12);
    expect(entranceHelix(restHelix(slotted), slotted, entranceClock(-1, c)).leanRad).toBeCloseTo(-25 * DEG, 12);
  });
});

describe("the ring's cards", () => {
  it("are the n consecutive positions of the window, shifted by the strand's drift", () => {
    expect(inRing(-7, 0, 14)).toBe(true);
    expect(inRing(6.99, 0, 14)).toBe(true);
    expect(inRing(7, 0, 14)).toBe(false);
    expect(inRing(-7.01, 0, 14)).toBe(false);
    expect(inRing(9, 2.3, 14)).toBe(true);
    expect(inRing(-5, 2.3, 14)).toBe(false);
  });
});

describe("the field's mask", () => {
  const canvas = { width: 1280, height: 736 };
  const { featherPx } = COIL.deal.open;
  const corner = Math.hypot(canvas.width / 2, canvas.height);

  it("is closed before the field starts to open, and open from the end of the clock", () => {
    expect(fieldMask(entranceClock(-1), canvas).radius).toBe(0);
    expect(fieldMask(entranceClock(0), canvas).radius).toBe(0);
    expect(fieldMask(entranceClock(TL.openStartMs), canvas).radius).toBe(0);
    expect(fieldMask(entranceClock(T), canvas).radius).toBe(OPEN_ALL);
    expect(openProgress(entranceClock(TL.openStartMs + COIL.deal.open.ms))).toBe(1);
  });

  it("grows from the top center, never shrinks, and clears the farthest corner when it is full", () => {
    let last = 0;
    for (let ms = TL.openStartMs; ms <= TL.openStartMs + COIL.deal.open.ms; ms += 20) {
      const mask = fieldMask(entranceClock(ms), canvas);
      expect(mask.cx).toBe(640);
      expect(mask.cy).toBe(0);
      expect(mask.feather).toBe(featherPx);
      expect(mask.radius).toBeGreaterThanOrEqual(last);
      last = mask.radius;
    }
    // The last frame before it is fully open: the edge's solid part already reaches the corner.
    const almost = fieldMask(entranceClock(TL.openStartMs + COIL.deal.open.ms - 1), canvas);
    expect(almost.radius - almost.feather).toBeGreaterThan(corner * 0.98);
  });

  it("opens on the field's tuned start and duration", () => {
    const c = tunedConstants({ timeline: { openStartMs: 500 }, open: { ms: 1000 } });
    expect(fieldMask(entranceClock(500, c), canvas, c).radius).toBe(0);
    expect(fieldMask(entranceClock(1000, c), canvas, c).radius).toBeGreaterThan(0);
    expect(openProgress(entranceClock(1500, c))).toBe(1);
  });
});

describe("the name", () => {
  it("is held by the loader, lands at the handoff, or fades up with the pull", () => {
    expect(entranceNameAlpha(entranceClock(-1), null)).toBe(0);
    expect(entranceNameAlpha(entranceClock(TL.pullStartMs), null)).toBe(0);
    expect(entranceNameAlpha(entranceClock((TL.pullStartMs + T) / 2), null)).toBeCloseTo(0.5, 6);
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


describe("the pull as a value", () => {
  it("is the rest frame itself at pull 1, so the coil at rest is untouched", () => {
    for (const [, geo] of cases) {
      const rest = restHelix(geo);
      expect(pullHelix(rest, geo, 1)).toBe(rest);
      expect(pullHelix(rest, geo, 1.2)).toBe(rest);
    }
  });
  it("closes the band at pull 0: every card on one turn, no rise, the band's size and lean", () => {
    for (const [, geo] of cases) {
      const band = pullHelix(restHelix(geo), geo, 0);
      expect(band.angStep).toBeCloseTo(TAU / geo.cardCount, 12);
      expect(band.dy).toBe(0);
      expect(band.cardWorld).toBe(geo.bandCardWorld);
      expect(band.leanRad).toBeCloseTo((COIL.camera.bandLeanDeg * Math.PI) / 180, 12);
    }
  });
  it("is the whole frame once the wheel has flattened (the lift's frame, exactly)", () => {
    for (const [, geo] of cases) {
      const rest = restHelix(geo);
      for (let ms = TL.flattenStartMs + TL.flattenMs; ms <= T; ms += 25) {
        const clock = entranceClock(ms);
        expect(entranceHelix(rest, geo, clock)).toEqual(pullHelix(rest, geo, pullProgress(clock)));
      }
    }
  });
  it("fades the copies outside the band in over pull 0.35 to 0.9", () => {
    expect([outOfBandAlpha(0), outOfBandAlpha(0.35), outOfBandAlpha(0.9), outOfBandAlpha(1)]).toEqual([0, 0, 1, 1]);
    expect(outOfBandAlpha(0.625)).toBeCloseTo(0.5, 9);
  });
  it("the pull curve is the entrance's cubic-bezier(0.55, 0, 0.25, 1)", () => {
    expect(COIL.entrance.pullCurve).toEqual([0.55, 0, 0.25, 1]);
    const curve = pullCurve(COIL);
    expect(curve(0)).toBeCloseTo(0, 9);
    expect(curve(1)).toBeCloseTo(1, 9);
    expect(curve(0.5)).toBeCloseTo(0.6856, 3);
  });
});
