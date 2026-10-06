import { describe, expect, it } from "vitest";
import {
  FLIP_AT,
  faceOf,
  fitAspect,
  flightQuad,
  homography,
  isConvex,
  mapPoint,
  quadOffset,
  rectQuad,
  signedArea,
} from "@/lib/coil/flight";
import { cameraFor, coilPose, projectQuad, restHelix, solveGeometry, type Quad } from "@/lib/coil/geometry";

const W = 300;
const H = 400;

function expectMapsCorners(q: Quad) {
  const m = homography(q, W, H)!;
  expect(m).not.toBeNull();
  const corners = [mapPoint(m, 0, 0), mapPoint(m, W, 0), mapPoint(m, W, H), mapPoint(m, 0, H)];
  corners.forEach((c, i) => {
    expect(c.x).toBeCloseTo(q[i].x, 6);
    expect(c.y).toBeCloseTo(q[i].y, 6);
  });
}


const geo = solveGeometry({ width: 1440, height: 900 }, 14);
const camera = cameraFor({ width: 1440, height: 900 });
const helix = restHelix(geo);
const poses = Array.from({ length: geo.slotCount }, (_, j) => coilPose(helix, j, 0.3));
const bentQuads = poses.map((pose) => projectQuad(pose, camera));
// The flight's source: the bent corners, or the flat card's when those fold concave.
const cardQuads = poses.map((pose, j) => (isConvex(bentQuads[j]) ? bentQuads[j] : projectQuad({ ...pose, bend: 0 }, camera)));
const slot = rectQuad({ left: 500, top: 180, width: 390, height: 520 });

describe("homography", () => {
  it("maps the box's corners exactly onto an affine and a projective quad", () => {
    expectMapsCorners(rectQuad({ left: 12, top: 40, width: 90, height: 120 }));
    expectMapsCorners([
      { x: 100, y: 80 },
      { x: 260, y: 120 },
      { x: 240, y: 330 },
      { x: 90, y: 300 },
    ]);
    cardQuads.forEach(expectMapsCorners);
  });

  it("maps mirrored quads too (a card seen from behind)", () => {
    const back = cardQuads.find((q) => signedArea(q) < 0);
    expect(back).toBeDefined();
    expectMapsCorners(back!);
  });

  it("refuses a degenerate quad", () => {
    expect(homography([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 90 }, { x: 5, y: 90 }], W, H)).toBeNull();
  });
});

describe("flight path", () => {
  it("starts on the card and ends on the slot, exactly", () => {
    cardQuads.forEach((q) => {
      expect(quadOffset(flightQuad(q, slot, 0).quad, q)).toBe(0);
      expect(quadOffset(flightQuad(q, slot, 1).quad, slot)).toBe(0);
    });
  });

  it("falls back to the flat corners only for a card nearly edge on", () => {
    poses.forEach((pose, j) => {
      if (!isConvex(bentQuads[j])) expect(Math.abs(pose.depth)).toBeLessThan(0.4);
      expect(isConvex(cardQuads[j])).toBe(true);
    });
  });

  it("never passes through a concave or bow tie quad, and turns a back over to its front", () => {
    cardQuads.forEach((q) => {
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const { quad, face } = flightQuad(q, slot, Math.min(1, t));
        if (Math.abs(signedArea(quad)) > 1) expect(isConvex(quad)).toBe(true);
        if (faceOf(q) === "back") expect(face).toBe(t < FLIP_AT ? "back" : "front");
        else expect(face).toBe("front");
      }
    });
  });

  it("fits a 3:4 card inside a square slot", () => {
    const r = fitAspect({ left: 10, top: 20, width: 80, height: 80 }, 0.75);
    expect(r.width).toBeCloseTo(60, 9);
    expect(r.height).toBeCloseTo(80, 9);
    expect(r.left).toBeCloseTo(20, 9);
    expect(r.top).toBe(20);
  });
});

// ---- the flown card is the mesh: pose, bend and shading between the seat and the slot

import {
  RESUME_STEP_S,
  afterPause,
  flightPoseAt,
  handoff,
  poseGap,
  resumeStep,
  seatPose,
  slotPose,
  type FlightPose,
  type HandoffAction,
  type HandoffEvent,
  type HandoffState,
} from "@/lib/coil/flight";
import { createConveyor, startGlide, stepConveyor } from "@/lib/coil/motion";

const canvas = { left: 0, top: 0 };
const slotRect = { left: 500, top: 180, width: 390, height: 520 };
const seatLook = { bright: 0.05, shade: 1, sheen: 0.1, seen: 1 };
const seats: FlightPose[] = poses.map((pose) => seatPose({ ...pose, scale: pose.scale * 1.045, fade: pose.fade * 0.4 }, seatLook));
const inSlot = slotPose(camera, slotRect, canvas);
const flat = (pose: FlightPose) => projectQuad({ ...pose, bend: 0 }, camera);

describe("slot pose", () => {
  it("projects exactly onto the slot's 3:4 rect, flat and facing the camera", () => {
    const want = rectQuad(fitAspect(slotRect, 0.75));
    expect(quadOffset(projectQuad(inSlot, camera), want)).toBeLessThan(1e-9);
    expect(inSlot.bend).toBe(0);
    expect(inSlot.basis).toEqual({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
  });

  it("follows the canvas when the hero has scrolled", () => {
    const scrolled = slotPose(camera, slotRect, { left: 0, top: -300 });
    const want = rectQuad(fitAspect(slotRect, 0.75));
    expect(quadOffset(projectQuad(scrolled, camera, { left: 0, top: -300 }), want)).toBeLessThan(1e-9);
  });

  it("has none of the coil's shading, and its own soft edge, whole", () => {
    expect(inSlot).toMatchObject({ fade: 0, bright: 0, shade: 0, sheen: 0, seam: 0, seen: 0, soft: 1, reveal: 1, alpha: 1 });
  });
});

describe("seat pose", () => {
  it("is the rendered pose with the coil's shading, hard edged and covered as in the coil", () => {
    const seat = seats[3];
    expect(seat).toMatchObject({ ...seatLook, seam: 1, soft: 0, reveal: 0 });
    expect(seat.scale).toBe(poses[3].scale * 1.045);
    expect(seat.bend).toBe(poses[3].bend);
  });
});

describe("flight pose", () => {
  it("is the seat at 0 and the slot at 1, the very same values", () => {
    seats.forEach((seat) => {
      expect(flightPoseAt(seat, inSlot, 0)).toBe(seat);
      expect(flightPoseAt(seat, inSlot, 1)).toBe(inSlot);
      expect(poseGap(flightPoseAt(seat, inSlot, 0), seat)).toBe(0);
    });
  });

  it("leaves the seat without a step: the first instant moves nothing", () => {
    seats.forEach((seat) => {
      const near = flightPoseAt(seat, inSlot, 1e-5);
      expect(quadOffset(projectQuad(near, camera), projectQuad(seat, camera))).toBeLessThan(0.05);
      expect(poseGap(near, seat)).toBeLessThan(1e-3);
    });
  });

  it("arrives in the slot without a step", () => {
    seats.forEach((seat) => {
      const near = flightPoseAt(seat, inSlot, 1 - 1e-5);
      expect(quadOffset(projectQuad(near, camera), projectQuad(inSlot, camera))).toBeLessThan(0.05);
      expect(poseGap(near, inSlot)).toBeLessThan(1e-3);
    });
  });

  it("flattens the bend and releases the shading, the lift and the seam all the way, never back", () => {
    const seat = seats[2];
    let last = flightPoseAt(seat, inSlot, 0);
    for (let e = 0.02; e <= 1.0001; e += 0.02) {
      const pose = flightPoseAt(seat, inSlot, Math.min(1, e));
      (["bend", "fade", "bright", "shade", "sheen", "seam", "seen"] as const).forEach((key) => {
        expect(pose[key]).toBeLessThanOrEqual(last[key] + 1e-12);
      });
      expect(pose.soft).toBeGreaterThanOrEqual(last.soft - 1e-12);
      expect(pose.reveal).toBeGreaterThanOrEqual(last.reveal - 1e-12);
      last = pose;
    }
    expect(last).toMatchObject({ bend: 0, fade: 0, bright: 0, shade: 0, sheen: 0, seam: 0, seen: 0, soft: 1, reveal: 1 });
  });

  it("is whole (clear of the cards that covered it) well before it arrives", () => {
    expect(flightPoseAt(seats[2], inSlot, 0.5).reveal).toBe(1);
    expect(flightPoseAt(seats[2], inSlot, 0.25).reveal).toBeGreaterThan(0);
    expect(flightPoseAt(seats[2], inSlot, 0.25).reveal).toBeLessThan(1);
  });

  it("keeps a true rotation all the way (no shear, no mirror)", () => {
    const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    seats.forEach((seat) => {
      for (let e = 0; e <= 1.0001; e += 0.05) {
        const { basis } = flightPoseAt(seat, inSlot, Math.min(1, e));
        expect(dot3(basis.x, basis.x)).toBeCloseTo(1, 9);
        expect(dot3(basis.y, basis.y)).toBeCloseTo(1, 9);
        expect(dot3(basis.x, basis.y)).toBeCloseTo(0, 9);
        const cross = [
          basis.x[1] * basis.y[2] - basis.x[2] * basis.y[1],
          basis.x[2] * basis.y[0] - basis.x[0] * basis.y[2],
          basis.x[0] * basis.y[1] - basis.x[1] * basis.y[0],
        ];
        expect(dot3(cross, basis.z)).toBeCloseTo(1, 9);
      }
    });
  });

  it("turns a card seen from behind over once, onto its front", () => {
    const back = seats.find((seat) => signedArea(flat(seat)) < 0);
    expect(back).toBeDefined();
    let flips = 0;
    let sign = Math.sign(signedArea(flat(back!)));
    for (let e = 0.01; e <= 1.0001; e += 0.01) {
      const next = Math.sign(signedArea(flat(flightPoseAt(back!, inSlot, Math.min(1, e)))));
      if (next !== 0 && next !== sign) {
        flips += 1;
        sign = next;
      }
    }
    expect(flips).toBe(1);
    expect(sign).toBe(1);
  });

  it("moves a little at a time: no frame of a 520ms flight jumps the card", () => {
    // Even steps of the eased progress; the largest corner step stays a small
    // share of the whole path.
    seats.forEach((seat) => {
      const whole = quadOffset(flat(seat), flat(inSlot));
      let last = flat(seat);
      let worst = 0;
      for (let i = 1; i <= 100; i++) {
        const next = flat(flightPoseAt(seat, inSlot, i / 100));
        worst = Math.max(worst, quadOffset(next, last));
        last = next;
      }
      expect(worst).toBeLessThan(Math.max(8, whole * 0.06));
    });
  });
});

describe("pose gap", () => {
  it("is zero only when the flown card is exactly the seat", () => {
    const seat = seats[1];
    expect(poseGap(seat, { ...seat })).toBe(0);
    expect(poseGap(seat, { ...seat, bright: seat.bright + 0.01 })).toBeCloseTo(0.01, 12);
    expect(poseGap(seat, { ...seat, bend: seat.bend - 0.2 })).toBeCloseTo(0.2, 12);
    expect(poseGap(seat, { ...seat, scale: seat.scale * 1.01 })).toBeGreaterThan(0);
  });
});

describe("handoff", () => {
  const run = (events: HandoffEvent[]) => {
    let state: HandoffState = "rest";
    const frames: HandoffAction[][] = [];
    events.forEach((event) => {
      const next = handoff(state, event);
      state = next.state;
      frames.push([...next.actions]);
    });
    return { state, frames };
  };

  it("draws the flown card before the mesh hides, in one frame", () => {
    expect(run(["open"]).frames).toEqual([["draw-card", "hide-mesh"]]);
  });

  it("shows the mesh before the flown card clears, in one frame, and resumes on the next", () => {
    const { state, frames } = run(["open", "arrive", "close", "land", "frame"]);
    expect(frames).toEqual([["draw-card", "hide-mesh"], [], [], ["show-mesh", "clear-card"], ["resume"]]);
    expect(state).toBe("rest");
  });

  it("never resumes the scene on the frame the mesh shows", () => {
    const { frames } = run(["open", "close", "land", "frame", "frame"]);
    frames.forEach((actions) => {
      if (actions.includes("show-mesh")) expect(actions).not.toContain("resume");
    });
    expect(frames[4]).toEqual([]);
  });

  it("closes from mid flight as from the slot", () => {
    expect(run(["open", "close"]).state).toBe("home");
    expect(run(["open", "arrive", "close"]).state).toBe("home");
  });

  it("ignores what cannot happen: no landing before a close, no second open", () => {
    expect(run(["land"])).toEqual({ state: "rest", frames: [[]] });
    expect(run(["open", "land"]).state).toBe("out");
    expect(run(["open", "open"]).frames[1]).toEqual([]);
    expect(run(["frame"])).toEqual({ state: "rest", frames: [[]] });
  });

  it("puts the mesh back when the flight is torn down part way", () => {
    const partWay: HandoffEvent[][] = [["open"], ["open", "arrive"], ["open", "close"]];
    partWay.forEach((events) => {
      const { state, frames } = run([...events, "abort", "frame"]);
      expect(frames[frames.length - 2]).toEqual(["show-mesh", "clear-card"]);
      expect(frames[frames.length - 1]).toEqual(["resume"]);
      expect(state).toBe("rest");
    });
  });
});

describe("resume", () => {
  it("steps the first frame after a freeze by one frame at most", () => {
    expect(resumeStep(1.251)).toBe(RESUME_STEP_S);
    expect(resumeStep(0.008)).toBe(0.008);
    expect(resumeStep(-1)).toBe(0);
    expect(RESUME_STEP_S).toBeCloseTo(1 / 60, 9);
  });

  it("holds a glide where the freeze caught it", () => {
    const conveyor = createConveyor(2);
    startGlide(conveyor, 6, 1000);
    stepConveyor(conveyor, { dt: 1 / 60, nowMs: 1100, idleWeight: 1 });
    const caught = conveyor.offset;
    expect(caught).toBeGreaterThan(2);
    expect(caught).toBeLessThan(6);
    // Frozen at 1100 for 1250ms: the next frame is one frame on, not 1250ms on.
    conveyor.glide = afterPause(conveyor.glide, 1250);
    stepConveyor(conveyor, { dt: 1 / 60, nowMs: 1100 + 1250 + 16, idleWeight: 1 });
    expect(conveyor.offset - caught).toBeGreaterThan(0);
    expect(conveyor.offset - caught).toBeLessThan(0.6);
    expect(conveyor.glide).not.toBeNull();
    expect(afterPause(null, 500)).toBeNull();
  });
});
