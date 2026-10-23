import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { sceneMs } from "@/lib/coil/dealSpeed";
import {
  OPEN_ALL,
  basisToQuat,
  entranceClock,
  entranceHelix,
  entrancePose,
  RING_END_FADE_SLOTS,
  condenseProgress,
  curlProgress,
  ringEndFade,
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
  pinKnee,
  pullProgress,
  quatToBasis,
  slerpBasis,
  tunedConstants,
  wheelHelix,
  wheelPlacement,
  windOnset,
  windRamp,
} from "@/lib/coil/entrance";
import { ribbonAnchor, ribbonCardsPerSecond, ribbonGatherPitch, ribbonHoverPitch, gatherShare, ribbonEdge, ribbonEdgeAlpha, ribbonEdgeAlphaWorld, ribbonHelix, ribbonPitchUnits } from "@/lib/coil/ribbon";
import { coilPose, mod, poseAt, restHelix, solveGeometry, type Basis, type CoilGeometry, type HelixFrame } from "@/lib/coil/geometry";

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
function slotsOf(geo: CoilGeometry, frame: HelixFrame, ms: number, offset = 0, drift = 0) {
  const clock = entranceClock(ms, COIL, drift);
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

  it("follows slice 4d's table, with slice 5's longer rush: the Coil is unfurled by about 2.3 s after the click (the rush before the curl is 500 to 700 ms), the flatten overlaps the spin-up, the hold at the peak is 200 ms at most, and the field's opening and the slowing are over before the lift lands", () => {
    expect(TL.condenseMs).toBeGreaterThanOrEqual(500);
    expect(TL.condenseMs).toBeLessThanOrEqual(700);
    expect(TL.condenseMs + TL.pullStartMs + TL.pullMs).toBeLessThanOrEqual(2400);
    expect(TL.condenseMs + TL.pullStartMs + TL.pullMs).toBeGreaterThanOrEqual(1900);
    expect(TL.flattenStartMs).toBeLessThan(TL.upMs);
    expect(TL.flattenStartMs + TL.flattenMs).toBeGreaterThan(TL.upMs);
    expect(TL.slowStartMs - TL.upMs).toBeLessThanOrEqual(200);
    expect(TL.slowStartMs).toBeGreaterThanOrEqual(TL.upMs);
    expect(TL.openStartMs + COIL.deal.open.ms).toBeLessThanOrEqual(TL.pullStartMs + TL.pullMs);
    expect(TL.slowStartMs + TL.slowMs).toBeLessThanOrEqual(TL.pullStartMs + TL.pullMs);
    // The wheel is all but flat when the lift starts: they overlap by 150 ms at most.
    expect(TL.flattenStartMs + TL.flattenMs - TL.pullStartMs).toBeLessThanOrEqual(150);
    expect(TL.flattenStartMs + TL.flattenMs).toBeGreaterThanOrEqual(TL.pullStartMs);
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
    expect(flattenProgress(entranceClock(TL.pullStartMs))).toBeGreaterThan(0.97);
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
    const tuning = { timeline: { pullStartMs: 500, openStartMs: 700 }, open: { ms: 1500 } };
    const c = tunedConstants(tuning);
    expect(tunedConstants({ ...tuning })).toBe(c);
    expect(c.deal.timeline.pullStartMs).toBe(500);
    expect(c.deal.timeline.pullMs).toBe(TL.pullMs);
    expect(c.deal.wheel).toEqual(COIL.deal.wheel);
    const clock = entranceClock(900, c);
    expect(clock.durationS).toBeCloseTo(2.2, 9);
    expect(clock.c).toBe(c);
    expect(isRested(entranceClock(2200, c))).toBe(true);
    expect(isRested(entranceClock(2199, c))).toBe(false);
    // The functions read the clock's own constants by default.
    expect(pullProgress(clock)).toBeCloseTo(pullProgress(clock, c), 12);
    expect(pullProgress(entranceClock(800, c))).toBeGreaterThan(pullProgress(entranceClock(800)));
  });
});

describe.each(cases)("the wheel and the pull, %s", (_label, geo) => {
  const rest = restHelix(geo);
  // The absolute strand positions of the ring's cards at a moment.
  const idsIn = (frame: HelixFrame, ms: number, offset: number, drift = 0) =>
    slotsOf(geo, frame, ms, offset, drift)
      .filter(({ member }) => member)
      .map(({ raw }) => Math.round(raw.u - offset));

  it("is the wheel once the row has curled: the band's ring with an upright axis, a few degrees of lean and the wheel's size", () => {
    // The flatten starts over the curl; held back, the wheel is whole at the curl's end.
    const c = tunedConstants({ timeline: { flattenStartMs: TL.curlMs } });
    const frame = entranceHelix(rest, geo, entranceClock(TL.curlMs, c), c);
    const wheel = wheelPlacement(geo, c);
    expect(frame.angStep).toBeCloseTo(TAU / geo.cardCount, 12);
    expect(frame.dy).toBe(0);
    expect(frame.axisRad).toBe(0);
    expect(frame.leanRad).toBeCloseTo(COIL.deal.wheel.leanDeg * DEG, 12);
    expect(frame.cardWorld).toBeCloseTo(geo.wheelCardWorld * COIL.deal.wheel.scale, 12);
    expect(frame.center[0]).toBeCloseTo(wheel.center[0], 12);
    expect(frame.center[1]).toBeCloseTo(wheel.center[1], 12);
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
    expect(wheelHelix(band, geo, 1)).toBe(band);
    const halfway = wheelHelix(band, geo, 0.5);
    expect(halfway.leanRad).toBeCloseTo((band.leanRad + COIL.deal.wheel.leanDeg * DEG) / 2, 9);
    expect(halfway.axisRad).toBeCloseTo(band.axisRad / 2, 9);
    expect(halfway.cardWorld).toBeCloseTo((band.cardWorld + geo.wheelCardWorld * COIL.deal.wheel.scale) / 2, 12);
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
    const frame = entranceHelix(rest, geo, entranceClock(TL.curlMs));
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
  const geo = solveGeometry({ width: 880, height: 736 }, 14, COIL, { canvas: { width: 1280, height: 736 } });

  it("sits at the constants' anchor and a share of the canvas's height", () => {
    expect(geo.canvas).toEqual({ width: 1280, height: 736 });
    expect(geo.wheelAnchor).toEqual({ x: COIL.deal.wheel.anchor[0], y: COIL.deal.wheel.anchor[1] });
    const bandRadius = (14 * geo.step) / TAU;
    expect((2 * bandRadius + 0.3) * (geo.wheelCardWorld / geo.camera.worldPerPx)).toBeCloseTo(COIL.deal.wheel.diameterOfHeight * 736, 9);
  });

  it("projects to the anchor on the canvas, nudged by the lab's offsets", () => {
    const px = (frame: ReturnType<typeof wheelPlacement>) => ({
      x: 640 + frame.center[0] / geo.camera.worldPerPx,
      y: 368 - frame.center[1] / geo.camera.worldPerPx,
    });
    const at = px(wheelPlacement(geo));
    expect(at.x).toBeCloseTo(640, 9);
    expect(at.y).toBeCloseTo(368, 9);
    const nudged = tunedConstants({ wheel: { offsetX: 0.1, offsetY: 0.05, scale: 1.2 } });
    const moved = px(wheelPlacement(geo, nudged));
    expect(moved.x).toBeCloseTo(640 + 0.1 * 1280, 9);
    expect(moved.y).toBeCloseTo(368 + 0.05 * 736, 9);
    expect(wheelPlacement(geo, nudged).cardWorld).toBeCloseTo(geo.wheelCardWorld * 1.2, 12);
  });

  it("flows through the tuning: a tuned lean is the wheel's lean", () => {
    const c = tunedConstants({ wheel: { leanDeg: -25 } });
    expect(wheelPlacement(geo, c).leanRad).toBeCloseTo(-25 * DEG, 12);
    const held = tunedConstants({ wheel: { leanDeg: -25 }, timeline: { flattenStartMs: c.deal.timeline.curlMs } });
    expect(entranceHelix(restHelix(geo), geo, entranceClock(held.deal.timeline.curlMs, held), held).leanRad).toBeCloseTo(-25 * DEG, 12);
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
  const { featherPx, featherShare } = COIL.deal.open;
  const corner = Math.hypot(canvas.width / 2, canvas.height / 2);

  it("stays closed before the field starts to open, and is open from the end of the clock", () => {
    expect(fieldMask(entranceClock(-1), canvas).radius).toBe(0);
    expect(fieldMask(entranceClock(0), canvas).radius).toBe(0);
    expect(fieldMask(entranceClock(TL.openStartMs), canvas).radius).toBe(0);
    expect(fieldMask(entranceClock(T), canvas).radius).toBe(OPEN_ALL);
    expect(openProgress(entranceClock(TL.openStartMs + COIL.deal.open.ms))).toBe(1);
  });

  it("grows from the canvas's middle (under the Coil), never shrinks, and clears the farthest corner when it is full", () => {
    let last = 0;
    let lastFeather = 0;
    for (let ms = TL.openStartMs; ms <= TL.openStartMs + COIL.deal.open.ms; ms += 20) {
      const mask = fieldMask(entranceClock(ms), canvas);
      expect(mask.cx).toBe(640);
      expect(mask.cy).toBe(368);
      expect(mask.feather).toBeGreaterThanOrEqual(featherPx);
      expect(mask.feather).toBeLessThanOrEqual(featherShare * corner + 1e-9);
      expect(mask.radius).toBeGreaterThanOrEqual(last);
      // The edge only widens as the circle opens.
      expect(mask.feather).toBeGreaterThanOrEqual(lastFeather);
      last = mask.radius;
      lastFeather = mask.feather;
    }
    // The last frame before it is fully open: the edge's solid part already reaches the corner.
    const almost = fieldMask(entranceClock(TL.openStartMs + COIL.deal.open.ms - 1), canvas);
    expect(almost.radius - almost.feather).toBeGreaterThan(corner * 0.98);
  });

  it("feathers a big open disc more than a small one, so its rim never reads as a halo", () => {
    const early = fieldMask(entranceClock(TL.openStartMs + 150), canvas);
    const late = fieldMask(entranceClock(TL.openStartMs + 900), canvas);
    expect(early.feather).toBeLessThan(late.feather);
    expect(late.feather).toBeGreaterThan(late.radius * 0.1);
    expect(COIL.deal.open.topFadePx).toBeGreaterThan(0);
  });

  it("grows from another origin when it is given one, and clears the farthest corner from it", () => {
    const origin = { x: 300, y: 120 };
    const far = Math.hypot(canvas.width - origin.x, canvas.height - origin.y);
    const mask = fieldMask(entranceClock(TL.openStartMs + 400), canvas, COIL, origin);
    expect(mask.cx).toBe(300);
    expect(mask.cy).toBe(120);
    const almost = fieldMask(entranceClock(TL.openStartMs + COIL.deal.open.ms - 1), canvas, COIL, origin);
    expect(almost.radius - almost.feather).toBeGreaterThan(far * 0.98);
    expect(fieldMask(entranceClock(T), canvas, COIL, origin).radius).toBe(OPEN_ALL);
  });

  it("opens on the field's tuned start and duration", () => {
    const c = tunedConstants({ timeline: { openStartMs: 500 }, open: { ms: 1000 } });
    expect(fieldMask(entranceClock(500, c), canvas, c).radius).toBe(0);
    expect(fieldMask(entranceClock(1000, c), canvas, c).radius).toBeGreaterThan(0);
    expect(openProgress(entranceClock(1500, c))).toBe(1);
  });
});

describe("the wheel's slow-down into the stage's sticking", () => {
  const K = COIL.deal.wheel.pinKneePx;
  // The wheel's screen position over the last K px: the stage's top plus the knee (the slot's own offset is a constant).
  const screen = (x: number) => Math.max(x, 0) + pinKnee(x, K);

  it("is nothing before the knee, once the stage is stuck, and with the knee off", () => {
    expect(pinKnee(K, K)).toBe(0);
    expect(pinKnee(K * 3, K)).toBe(0);
    expect(pinKnee(0, K)).toBe(0);
    expect(pinKnee(-50, K)).toBe(0);
    expect(pinKnee(100, 0)).toBe(0);
  });

  it("holds the wheel above where it rides, never below, and brings it to the stage's top exactly as it sticks", () => {
    for (let x = 1; x < K; x += 5) expect(pinKnee(x, K), `x ${x}`).toBeLessThan(0);
    expect(screen(1e-6)).toBeCloseTo(0, 6);
    expect(screen(K - 1e-6)).toBeCloseTo(K, 3);
  });

  it("has no step in the wheel's speed: it joins the free ride at slope 1 and reaches the stage at slope 0", () => {
    const slope = (x: number) => (screen(x + 1e-3) - screen(x - 1e-3)) / 2e-3;
    expect(slope(K - 0.5)).toBeCloseTo(1, 2);
    expect(slope(0.5)).toBeLessThan(0.01);
    // The wheel covers the same distance as the page across the knee, so it has to
    // outrun it a little before it slows (by a third at the most, at 2K/3); from there
    // its speed falls steadily to zero.
    let most = 0;
    for (let x = K - 1; x > 1; x -= 4) most = Math.max(most, slope(x));
    expect(most).toBeLessThanOrEqual(4 / 3 + 1e-3);
    let last = Number.POSITIVE_INFINITY;
    for (let x = (2 * K) / 3; x > 1; x -= 4) {
      const v = slope(x);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });

  it("moves the wheel's center up by the knee, weighted by how little it has flattened", () => {
    const geo = { canvas: { width: 1280, height: 800 }, camera: { worldPerPx: 0.01 }, wheelAnchor: { x: 0.5, y: 0.5 }, wheelCardWorld: 1 } as never;
    const frame = { axisRad: 0, leanRad: 0, center: [0, 0, 0], cardWorld: 1 } as never;
    const flat = wheelHelix(frame, geo, 0.5, COIL, -40);
    const none = wheelHelix(frame, geo, 0.5, COIL, 0);
    // dy is up-negative in px; the world's y is up, so a negative dy lifts the center by dy * worldPerPx.
    expect(flat.center[1] - none.center[1]).toBeCloseTo(0.5 * 40 * 0.01, 9);
    expect(wheelHelix(frame, geo, 1, COIL, -40)).toBe(frame);
  });

  it("is carried on the clock, and is 0 where the clock has none", () => {
    expect(entranceClock(0).dyPx).toBe(0);
    expect(entranceClock(0, COIL, { dyPx: -30 }).dyPx).toBe(-30);
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

describe("the ribbon (page 1's foot)", () => {
  const OPEN = { hover: 0, rush: 0 };
  const PILE = { hover: 0, rush: 1 };
  const wideGeo = solveGeometry({ width: 1280, height: 800 }, 14, COIL, { canvas: { width: 1280, height: 800 }, ribbonCy: 620 });
  const phoneGeo = solveGeometry({ width: 390, height: 460 }, 14, COIL, { canvas: { width: 390, height: 460 }, ribbonCy: 150 });
  const rest = (geo: CoilGeometry) => restHelix(geo);

  it("takes the card's height by the canvas's width and the slot's middle as its anchor", () => {
    expect(wideGeo.ribbon.cardPx).toBe(COIL.deal.ribbon.cardHeightPx);
    expect(phoneGeo.ribbon.cardPx).toBe(COIL.deal.ribbon.cardHeightPhonePx);
    expect(wideGeo.ribbon.anchorY).toBeCloseTo(620 / 800, 12);
    expect(ribbonAnchor(wideGeo)[1] / wideGeo.camera.worldPerPx).toBeCloseTo(400 - 620, 9);
    const bare = solveGeometry({ width: 1280, height: 800 }, 14, COIL);
    expect(bare.ribbon.anchorY).toBe(COIL.deal.ribbon.anchorY);
  });

  it("keeps the row's wrap off the canvas: the gap (and the hover's tightening) grows where fourteen cards would not span it", () => {
    for (const w of [390, 1280, 1920, 2560, 3440]) {
      const geo = solveGeometry({ width: w, height: 800 }, 14, COIL, { canvas: { width: w, height: 800 } });
      const cardW = geo.ribbon.cardPx * COIL.cardAspect;
      const pitch = cardW + geo.ribbon.gapPx;
      expect(pitch * geo.cardCount, `at ${w}`).toBeGreaterThanOrEqual(w + 2 * cardW - 1e-6);
      expect(geo.ribbon.gapPx).toBeGreaterThanOrEqual(COIL.deal.ribbon.gapPx);
      expect(ribbonHoverPitch(geo) * geo.ribbon.cardPx * geo.cardCount, `the hover's pitch at ${w}`).toBeGreaterThanOrEqual(w + 2 * cardW - 1e-6);
    }
  });

  it("drifts left at the knob's px per second, as a card rate that is the same however the gaps then close", () => {
    const rate = ribbonCardsPerSecond(wideGeo);
    expect(rate).toBeLessThan(0);
    const pitchPx = ribbonPitchUnits(wideGeo) * wideGeo.ribbon.cardPx;
    expect(Math.abs(rate) * pitchPx).toBeCloseTo(COIL.deal.ribbon.speedPxPerS, 9);
    const fast = tunedConstants({ ribbon: { speedPxPerS: 40 } });
    expect(ribbonCardsPerSecond(wideGeo, fast)).toBeCloseTo(rate * 2, 12);
  });

  it("lies flat in one row at curl 0: cards a pitch apart on the anchor's line, face on, unbent", () => {
    const frame = ribbonHelix(entranceHelix(rest(wideGeo), wideGeo, entranceClock(0)), wideGeo, OPEN, 0);
    const pitchWorld = ribbonPitchUnits(wideGeo) * frame.cardWorld;
    const anchor = ribbonAnchor(wideGeo);
    for (const u of [-6, -2.5, 0, 1, 4.25]) {
      const pose = poseAt(frame, u);
      expect(pose.position[0]).toBeCloseTo(anchor[0] + u * pitchWorld, 2);
      expect(pose.position[1]).toBeCloseTo(anchor[1], 6);
      expect(Math.abs(pose.position[2])).toBeLessThan(1e-3);
      expect(pose.bend).toBeLessThan(1e-4);
      expect(pose.basis.z[2]).toBeGreaterThan(0.999999);
    }
    expect(frame.dy).toBe(0);
    expect(frame.leanRad).toBe(0);
  });

  it("closes its gaps, then curls into exactly the wheel: the frame at curl 1 is the wheel's own", () => {
    for (const geo of [wideGeo, phoneGeo]) {
      const r = rest(geo);
      const wheel = entranceHelix(r, geo, entranceClock(TL.curlMs));
      expect(ribbonHelix(wheel, geo, PILE, 1)).toBe(wheel);
      const nearly = ribbonHelix(wheel, geo, PILE, 1 - 1e-9);
      expect(nearly.angStep).toBeCloseTo(wheel.angStep, 6);
      expect(nearly.radius).toBeCloseTo(wheel.radius, 4);
      expect(nearly.cardWorld).toBeCloseTo(wheel.cardWorld, 6);
      expect(nearly.leanRad).toBeCloseTo(wheel.leanRad, 6);
      for (let k = 0; k < 3; k++) expect(nearly.center[k]).toBeCloseTo(wheel.center[k], 3);
      const gathered = ribbonHelix(wheel, geo, PILE, 0);
      const open = ribbonHelix(wheel, geo, OPEN, 0);
      expect(gathered.radius).toBeLessThan(open.radius);
      expect(gathered.cardWorld).toBe(open.cardWorld);
    }
  });

  it("moves the card at the front smoothly from the row's anchor to the wheel's near side", () => {
    const wheel = entranceHelix(rest(wideGeo), wideGeo, entranceClock(TL.curlMs));
    let last: readonly number[] | null = null;
    let worst = 0;
    for (let k = 0; k <= 1.0001; k += 0.01) {
      const frame = ribbonHelix(wheel, wideGeo, PILE, Math.min(1, k));
      const front = coilPose(frame, 7, 0).position;
      if (last) worst = Math.max(worst, Math.hypot(front[0] - last[0], front[1] - last[1], front[2] - last[2]) / wideGeo.camera.worldPerPx);
      last = front;
    }
    // Over a hundred steps the front card never jumps more than a few card heights of the whole way.
    expect(worst).toBeLessThan(wideGeo.canvas.height * 0.05);
  });

  it("fades the row's edges out, whole a fade's width in, gone half a card past the edge, and whole once curled", () => {
    expect(ribbonEdgeAlpha(640, 1280, 120, 40)).toBe(1);
    expect(ribbonEdgeAlpha(120, 1280, 120, 40)).toBe(1);
    expect(ribbonEdgeAlpha(-40, 1280, 120, 40)).toBe(0);
    expect(ribbonEdgeAlpha(1320, 1280, 120, 40)).toBe(0);
    expect(ribbonEdgeAlpha(0, 1280, 120, 40)).toBeCloseTo(0.15625, 9);
    const edge = ribbonEdge(wideGeo);
    expect(ribbonEdgeAlphaWorld(0, edge)).toBe(1);
    expect(ribbonEdgeAlphaWorld(-edge.half, edge)).toBeLessThan(0.7);
    expect(ribbonEdgeAlphaWorld(-edge.half - edge.halfCard, edge)).toBeCloseTo(0, 9);
    const pose = coilPose(restHelix(wideGeo), 0, 0);
    const out = { ...pose, position: [-edge.half, 0, 0] as const };
    const early = entrancePose(out, { cardCount: 14, edge }, entranceClock(-300));
    expect(early.alpha).toBeLessThan(1);
    const curled = entrancePose(out, { cardCount: 14, edge }, entranceClock(TL.curlMs));
    expect(curled.alpha).toBe(1);
  });

  it("rushes in on an ease out of power condensePower over condenseMs and curls on a smoothstep over curlMs, from the clock's 0", () => {
    const n = TL.condensePower;
    expect(condenseProgress(entranceClock(Number.NEGATIVE_INFINITY))).toBe(0);
    expect(condenseProgress(entranceClock(-TL.condenseMs))).toBe(0);
    expect(condenseProgress(entranceClock(-TL.condenseMs / 2))).toBeCloseTo(1 - Math.pow(0.5, n), 9);
    // An ease out: front loaded, over half the way in the first third of the time.
    expect(condenseProgress(entranceClock(-TL.condenseMs * (2 / 3)))).toBeGreaterThan(0.5);
    expect(condenseProgress(entranceClock(0))).toBe(1);
    expect(condenseProgress(entranceClock(T))).toBe(1);
    expect(curlProgress(entranceClock(-1))).toBe(0);
    expect(curlProgress(entranceClock(0))).toBe(0);
    expect(curlProgress(entranceClock(TL.curlMs / 2))).toBeCloseTo(0.5, 9);
    expect(curlProgress(entranceClock(TL.curlMs))).toBe(1);
    // The flatten starts once the curl has begun, and over the spin-up.
    expect(TL.flattenStartMs).toBeGreaterThan(0);
  });

  it("is 0 until the click whatever the pointer's anticipation did: that is the hover's own share, which the rush starts from", () => {
    const at = (ms: number) => condenseProgress(entranceClock(ms, COIL, { gather0: 0.2 }));
    expect(at(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(at(-TL.condenseMs)).toBe(0);
    expect(at(0)).toBe(1);
    // The pile's pitch is reached from the hover's pitch with no step at the click, and never goes back.
    const hover = { hover: 0.2, rush: 0 };
    const wheel = restHelix(wideGeo);
    const before = ribbonHelix(wheel, wideGeo, hover, 0);
    const atClick = ribbonHelix(wheel, wideGeo, { hover: 0.2, rush: at(-TL.condenseMs) }, 0);
    expect(atClick.radius).toBe(before.radius);
    let last = Number.POSITIVE_INFINITY;
    for (let ms = -TL.condenseMs; ms <= 0; ms += 5) {
      const radius = ribbonHelix(wheel, wideGeo, { hover: 0.2, rush: at(ms) }, 0).radius;
      expect(radius).toBeLessThanOrEqual(last + 1e-9);
      last = radius;
    }
    // With none it is the plain rush.
    expect(condenseProgress(entranceClock(-TL.condenseMs / 2))).toBeCloseTo(1 - Math.pow(0.5, TL.condensePower), 9);
  });

  it("gathers into a tight pile, far tighter than the hover's tightening and than the ring, that overlaps the cards", () => {
    for (const geo of [wideGeo, phoneGeo]) {
      const wheel = restHelix(geo);
      const piled = ribbonHelix(wheel, geo, PILE, 0);
      const pitch = ribbonGatherPitch(geo);
      expect(pitch).toBeCloseTo(COIL.deal.ribbon.gatherPitch, 12);
      expect(pitch).toBeLessThan(ribbonHoverPitch(geo) / 3);
      expect(pitch).toBeLessThan(COIL.cardAspect / 3);
      // Adjacent cards of the pile are `pitch` card heights apart across the row.
      const a = poseAt(piled, 0).position;
      const b = poseAt(piled, 1).position;
      expect(Math.hypot(b[0] - a[0], b[1] - a[1]) / piled.cardWorld).toBeCloseTo(pitch, 3);
      // A pile's row is far shorter than the canvas, the cluster of fourteen no wider than the canvas's third.
      expect(geo.cardCount * pitch * geo.ribbon.cardPx).toBeLessThan(geo.canvas.width * 0.7);
    }
    expect(gatherShare({ hover: 0.5, rush: 0.5 })).toBeCloseTo(0.75, 12);
    expect(gatherShare({ hover: 0, rush: 1 })).toBe(1);
  });

  it("stacks the pile in the strand's order by a hair of depth, in step with the rush, and nothing before the click or once curled", () => {
    const frame = ribbonHelix(restHelix(wideGeo), wideGeo, PILE, 0);
    const pose = (u: number) => coilPose(frame, u, 0);
    const lone = (u: number, clock: ReturnType<typeof entranceClock>) => entrancePose(pose(u), { cardCount: 14 }, clock);
    const clickClock = entranceClock(-TL.condenseMs / 4);
    const front = lone(3, clickClock);
    const back = lone(-3, clickClock);
    expect(front.position[2]).toBeGreaterThan(back.position[2]);
    expect(front.position[2] - back.position[2]).toBeLessThan(0.1 * front.scale);
    const before = lone(3, entranceClock(Number.NEGATIVE_INFINITY));
    expect(before.position[2]).toBe(pose(3).position[2]);
    const curled = lone(3, entranceClock(TL.curlMs));
    expect(curled.position[2]).toBe(pose(3).position[2]);
  });

  it("gathers the row toward the button: its anchor shifts across with the gaps closing, and is the ordinary row with no offset", () => {
    const wheel = restHelix(wideGeo);
    const half = { hover: 0, rush: 0.5 };
    const plain = ribbonHelix(wheel, wideGeo, half, 0.2);
    const toward = ribbonHelix(wheel, wideGeo, half, 0.2, { dxPx: 100, dyPx: 0 });
    const perPx = wideGeo.camera.worldPerPx;
    expect(toward.center[0] - plain.center[0]).toBeCloseTo(0.5 * 0.8 * 100 * perPx, 9);
    expect(ribbonHelix(wheel, wideGeo, half, 0.2, { dxPx: 0, dyPx: 0 })).toEqual(plain);
    // Nothing shifts with the gaps open, and the frame is the wheel's exactly at curl 1.
    expect(ribbonHelix(wheel, wideGeo, OPEN, 0, { dxPx: 100, dyPx: 0 }).center[0]).toBeCloseTo(ribbonHelix(wheel, wideGeo, OPEN, 0).center[0], 9);
    expect(ribbonHelix(wheel, wideGeo, PILE, 1, { dxPx: 100, dyPx: 0 })).toBe(wheel);
  });

  it("holds the row off its slot by pinKnee's offset while the stage rides the page", () => {
    const wheel = restHelix(wideGeo);
    const plain = ribbonHelix(wheel, wideGeo, OPEN, 0);
    const lifted = ribbonHelix(wheel, wideGeo, OPEN, 0, { dxPx: 0, dyPx: -40 });
    expect(lifted.center[1] - plain.center[1]).toBeCloseTo(40 * wideGeo.camera.worldPerPx, 9);
  });

  it("fades the cards at the window's two ends while the ring is open, so a swap of twins is not seen, and not at all once it has closed", () => {
    const half = 7;
    // Open ring: whole in the middle, gone at the ends, on a smooth edge a little over a slot wide.
    expect(ringEndFade(0, 14, 0)).toBe(1);
    expect(ringEndFade(half, 14, 0)).toBe(0);
    expect(ringEndFade(-half, 14, 0)).toBe(0);
    expect(ringEndFade(half - RING_END_FADE_SLOTS, 14, 0)).toBe(1);
    expect(ringEndFade(half - RING_END_FADE_SLOTS / 2, 14, 0)).toBeCloseTo(0.5, 9);
    // The gap holds the fade until the ring has all but closed, then lets it go, and it is nothing at the end.
    expect(ringEndFade(half - 0.4, 14, 0.9)).toBeLessThan(0.3);
    let last = -1;
    for (let curl = 0; curl <= 1; curl += 0.01) {
      const now = ringEndFade(half - 0.4, 14, curl);
      expect(now).toBeGreaterThanOrEqual(last - 1e-12);
      last = now;
    }
    expect(ringEndFade(half - 0.4, 14, 1)).toBe(1);
    // A card and its twin: whichever sits at an end is gone, so neither shows at the swap.
    expect(ringEndFade(half - 1e-9, 14, 0.9) * ringEndFade(-half, 14, 0.9)).toBeLessThan(0.2);
  });

  it("tunes through the lab: a longer condense and curl move the same marks", () => {
    const c = tunedConstants({ timeline: { condenseMs: 1000, curlMs: 300 } });
    expect(condenseProgress(entranceClock(-500, c), c)).toBeCloseTo(1 - Math.pow(0.5, c.deal.timeline.condensePower), 9);
    expect(curlProgress(entranceClock(150, c), c)).toBeCloseTo(0.5, 9);
  });
});

describe("the winding's onset ramp", () => {
  it("is today's kick at 0: the winding starts at full rate", () => {
    expect(windRamp(COIL)).toBe(COIL.deal.timeline.windRampMs === 0 ? 0 : windRamp(COIL));
    expect(windOnset(0.3, 0)).toBe(0.3);
  });

  it("eases the onset in on a parabola that meets the line, and still ends at 1", () => {
    for (const r of [0.05, 0.2, 0.6, 1]) {
      expect(windOnset(0, r)).toBe(0);
      expect(windOnset(1, r)).toBeCloseTo(1, 12);
      // Zero rate at the start.
      expect((windOnset(1e-6, r) - windOnset(0, r)) / 1e-6).toBeCloseTo(0, 4);
      // The rate rises to the line's and is steady from the ramp's end.
      let last = 0;
      for (let x = 0; x <= 1; x += 0.01) {
        const rate = (windOnset(x + 1e-6, r) - windOnset(x, r)) / 1e-6;
        expect(rate).toBeGreaterThanOrEqual(last - 1e-4);
        last = rate;
      }
    }
  });

  it("takes its length from windRampMs on the pull's own scale, 0 to 1", () => {
    const c = tunedConstants({ timeline: { windRampMs: 120 } });
    const { pullMs } = c.deal.timeline;
    expect(windRamp(c)).toBeCloseTo(120 / ((1 - c.entrance.windStart) * pullMs), 12);
    expect(windRamp(tunedConstants({ timeline: { windRampMs: 9999 } }))).toBe(1);
    expect(pullPhases(1, c).wind).toBeCloseTo(1, 12);
    expect(pullPhases(c.entrance.windStart, c).wind).toBe(0);
  });
});
