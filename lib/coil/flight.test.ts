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
