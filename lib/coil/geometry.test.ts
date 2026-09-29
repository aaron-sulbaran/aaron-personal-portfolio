import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  cameraFor,
  cardHit,
  coilPose,
  endFade,
  insideSilhouette,
  mod,
  pickCard,
  poseAt,
  projectPoint,
  projectQuad,
  rayThrough,
  restHelix,
  silhouette,
  slotU,
  solveGeometry,
  strandIndex,
  strandPosition,
  unprojectToPlane,
  type CardPose,
  type Vec3,
} from "@/lib/coil/geometry";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const STRAND = 14;

const distance3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("strand indexing", () => {
  it("maps every slot to its absolute position mod N, for negative offsets too", () => {
    const M = 30;
    for (const offset of [-1000.25, -57.5, -13.999, -0.4, 0, 0.49, 3.5, 812.75]) {
      for (let slot = 0; slot < M; slot++) {
        const u = slotU(slot, offset, M);
        expect(u).toBeGreaterThanOrEqual(-M / 2);
        expect(u).toBeLessThan(M / 2);
        const position = strandPosition(slot, offset, M);
        expect(Number.isInteger(position)).toBe(true);
        expect(position).toBeCloseTo(u - offset, 9);
        const index = strandIndex(slot, offset, STRAND, M);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(STRAND);
        expect(index).toBe(mod(position, STRAND));
      }
    }
  });

  it("covers a contiguous run of strand positions with no gaps or duplicates", () => {
    const M = 28;
    for (const offset of [-41.3, -7, 0.25, 19.9]) {
      const positions = Array.from({ length: M }, (_, slot) => strandPosition(slot, offset, M)).sort((a, b) => a - b);
      for (let i = 1; i < M; i++) expect(positions[i] - positions[i - 1]).toBe(1);
    }
  });

  it("negative modulo stays in range", () => {
    expect(mod(-1, 14)).toBe(13);
    expect(mod(-14, 14)).toBe(0);
    expect(mod(-15, 14)).toBe(13);
  });
});

describe("solveGeometry", () => {
  const viewports = [
    DESKTOP,
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1080 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    PHONE,
    { width: 360, height: 640 },
  ];

  it("gives an even slot count of at least N for every viewport and strand size", () => {
    for (const viewport of viewports) {
      for (const n of [5, 13, 14, 15, 20, 29]) {
        const geo = solveGeometry(viewport, n);
        expect(geo.slotCount % 2).toBe(0);
        expect(geo.slotCount).toBeGreaterThanOrEqual(n);
        expect(geo.slotCount).toBeGreaterThanOrEqual(geo.need - 1);
      }
    }
  });

  it("uses the picked wide composition on a desktop pane", () => {
    const geo = solveGeometry(DESKTOP, STRAND);
    expect(geo.narrow).toBe(false);
    expect(geo.axisRad).toBeCloseTo((COIL.axisDeg * Math.PI) / 180, 12);
    expect(geo.cardsPerTurn).toBe(COIL.cardsPerTurn);
    expect(geo.cardPx).toBeLessThanOrEqual(DESKTOP.height * COIL.cardHeightFrac + 1e-9);
    expect(geo.pitch).toBeCloseTo(1 + COIL.turnGap, 12);
    expect(geo.spans).toBe(true);
  });

  it("relaxes toward vertical with fewer cards per turn under 0.8 width to height", () => {
    const geo = solveGeometry(PHONE, STRAND);
    expect(geo.narrow).toBe(true);
    expect(geo.axisRad).toBeCloseTo((COIL.axisDeg * COIL.narrow.axisFactor * Math.PI) / 180, 12);
    expect(geo.cardsPerTurn).toBe(COIL.narrow.maxCardsPerTurn);
    // Tablet portrait composes narrow, landscape wide.
    expect(solveGeometry({ width: 768, height: 1024 }, STRAND).narrow).toBe(true);
    expect(solveGeometry({ width: 1024, height: 768 }, STRAND).narrow).toBe(false);
  });

  it("points the axis toward the top left on screen", () => {
    const geo = solveGeometry(DESKTOP, STRAND);
    expect(geo.axisDir.x).toBeLessThan(0);
    expect(geo.axisDir.y).toBeLessThan(0);
    expect(geo.axisDir.x * geo.axisPerp.x + geo.axisDir.y * geo.axisPerp.y).toBeCloseTo(0, 12);
  });
});

describe("coilPose", () => {
  const geo = solveGeometry(DESKTOP, STRAND);
  const frame = restHelix(geo);
  const M = frame.slotCount;

  it("is continuous along the strand", () => {
    for (let u = -M / 2; u < M / 2; u += 0.37) {
      const a = poseAt(frame, u);
      const b = poseAt(frame, u + 1e-4);
      expect(distance3(a.position, b.position)).toBeLessThan(1e-3 * frame.cardWorld * 10);
      expect(distance3(a.basis.z, b.basis.z)).toBeLessThan(1e-2);
    }
  });

  it("keeps an orthonormal, right-handed basis", () => {
    for (const u of [-9.2, -1, 0, 0.5, 3.3, 11.9]) {
      const { basis } = poseAt(frame, u);
      const d = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      expect(d(basis.x, basis.x)).toBeCloseTo(1, 9);
      expect(d(basis.y, basis.y)).toBeCloseTo(1, 9);
      expect(d(basis.z, basis.z)).toBeCloseTo(1, 9);
      expect(d(basis.x, basis.y)).toBeCloseTo(0, 9);
      expect(d(basis.y, basis.z)).toBeCloseTo(0, 9);
      const cx: Vec3 = [
        basis.x[1] * basis.y[2] - basis.x[2] * basis.y[1],
        basis.x[2] * basis.y[0] - basis.x[0] * basis.y[2],
        basis.x[0] * basis.y[1] - basis.x[1] * basis.y[0],
      ];
      expect(distance3(cx, basis.z)).toBeLessThan(1e-9);
    }
  });

  it("does not jump across the wrap: the wrapping slot is invisible and every strand card holds its pose", () => {
    // Slot 0 wraps when slot + offset + M/2 crosses a multiple of M.
    const wrapAt = M / 2;
    const before = wrapAt - 1e-6;
    const after = wrapAt + 1e-6;
    const wrapping = coilPose(frame, 0, before);
    const wrapped = coilPose(frame, 0, after);
    expect(wrapping.u).toBeCloseTo(M / 2, 4);
    expect(wrapped.u).toBeCloseTo(-M / 2, 4);
    expect(wrapping.alpha).toBeLessThan(1e-6);
    expect(wrapped.alpha).toBeLessThan(1e-6);

    const byPosition = (offset: number) => {
      const map = new Map<number, ReturnType<typeof coilPose>>();
      for (let slot = 0; slot < M; slot++) {
        const pose = coilPose(frame, slot, offset);
        map.set(pose.strandPosition, pose);
      }
      return map;
    };
    const a = byPosition(before);
    const b = byPosition(after);
    let shared = 0;
    a.forEach((pose, position) => {
      const other = b.get(position);
      if (!other) {
        expect(pose.alpha).toBeLessThan(1e-6);
        return;
      }
      shared += 1;
      expect(distance3(pose.position, other.position)).toBeLessThan(1e-4);
      expect(Math.abs(pose.alpha - other.alpha)).toBeLessThan(1e-4);
    });
    expect(shared).toBe(M - 1);
  });

  it("fades only at the strand ends", () => {
    expect(endFade(0, M)).toBe(1);
    expect(endFade(M / 2 - 1, M)).toBe(1);
    expect(endFade(M / 2, M)).toBe(0);
    expect(endFade(-M / 2, M)).toBe(0);
  });

  it("recedes the back of the coil, never the front", () => {
    const front = poseAt(frame, 0);
    const back = poseAt(frame, Math.PI / frame.angStep);
    expect(front.depth).toBeCloseTo(1, 9);
    expect(front.fade).toBeCloseTo(0, 9);
    expect(back.depth).toBeCloseTo(-1, 9);
    expect(back.fade).toBeCloseTo(frame.recede, 9);
  });
});

// A flat card facing the camera, centered on a canvas pixel, `px` tall.
function flatCardAt(x: number, y: number, px: number, camera = cameraFor(DESKTOP)): CardPose {
  return {
    u: 0,
    position: unprojectToPlane(camera, x, y, 0),
    basis: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    scale: px * camera.worldPerPx,
    bend: 0,
    beta: 0,
    depth: 1,
    fade: 0,
    alpha: 1,
  };
}

describe("projection", () => {
  const camera = cameraFor(DESKTOP);

  it("round trips a pixel through the plane and back", () => {
    for (const [x, y, z] of [
      [0, 0, 0],
      [720, 450, 0],
      [1439, 899, 0],
      [312.5, 77.25, 1.2],
      [1000, 600, -2.5],
    ]) {
      const world = unprojectToPlane(camera, x, y, z);
      expect(world[2]).toBe(z);
      const back = projectPoint(camera, world);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it("maps the canvas center to the world origin at one world unit per worldPerPx", () => {
    const origin = projectPoint(camera, [0, 0, 0]);
    expect(origin.x).toBeCloseTo(720, 9);
    expect(origin.y).toBeCloseTo(450, 9);
    const right = projectPoint(camera, [100 * camera.worldPerPx, 0, 0]);
    expect(right.x - origin.x).toBeCloseTo(100, 6);
  });

  it("projects a flat facing card to its exact CSS rect, offset by the canvas rect", () => {
    const quad = projectQuad(flatCardAt(500, 300, 200), camera, { left: 10, top: 64 });
    const w = 200 * COIL.cardAspect;
    const expected = [
      [510 - w / 2, 364 - 100],
      [510 + w / 2, 364 - 100],
      [510 + w / 2, 364 + 100],
      [510 - w / 2, 364 + 100],
    ];
    quad.forEach((corner, i) => {
      expect(corner.x).toBeCloseTo(expected[i][0], 6);
      expect(corner.y).toBeCloseTo(expected[i][1], 6);
    });
  });

  it("bends the corners of a curved coil card back from its flat plane", () => {
    const frame = restHelix(solveGeometry(DESKTOP, STRAND));
    const pose = poseAt(frame, 0);
    const flat = projectQuad({ ...pose, bend: 0 }, camera);
    const bent = projectQuad(pose, camera);
    const width = (q: typeof flat) => Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
    expect(width(bent)).toBeLessThan(width(flat));
  });
});

describe("picking and the silhouette", () => {
  const camera = cameraFor(DESKTOP);

  it("hits a card through its projected center and misses beside it", () => {
    const card = flatCardAt(700, 400, 200);
    expect(cardHit(card, rayThrough(camera, 700, 400))).not.toBeNull();
    expect(cardHit(card, rayThrough(camera, 700 + 200 * COIL.cardAspect * 0.49, 400))).not.toBeNull();
    expect(cardHit(card, rayThrough(camera, 700 + 200 * COIL.cardAspect * 0.51, 400))).toBeNull();
    expect(cardHit(card, rayThrough(camera, 700, 400 + 101))).toBeNull();
  });

  it("picks the nearest visible card and never a faded one", () => {
    const back = flatCardAt(700, 400, 200);
    const front: CardPose = { ...back, position: [back.position[0], back.position[1], back.position[2] + 0.5] };
    const ray = rayThrough(camera, 700, 400);
    expect(pickCard([back, front], ray)).toBe(1);
    expect(pickCard([back, { ...front, alpha: 0.2 }], ray)).toBe(0);
    expect(pickCard([{ ...back, alpha: 0 }], ray)).toBe(-1);
  });

  it("contains the axis and rejects points well off it", () => {
    const geo = solveGeometry(DESKTOP, STRAND);
    const frame = restHelix(geo);
    const poses = Array.from({ length: frame.slotCount }, (_, slot) => coilPose(frame, slot, 0.3));
    const sil = silhouette(frame, camera, poses);
    expect(sil.half).toBeGreaterThan(geo.cardPx * 0.5);
    expect(Math.hypot(sil.dx, sil.dy)).toBeCloseTo(1, 9);
    expect(insideSilhouette(sil, 720, 450)).toBe(true);
    const inside = { x: 720 - sil.dy * (sil.half - 4), y: 450 + sil.dx * (sil.half - 4) };
    const outside = { x: 720 - sil.dy * (sil.half + 40), y: 450 + sil.dx * (sil.half + 40) };
    expect(insideSilhouette(sil, inside.x, inside.y)).toBe(true);
    expect(insideSilhouette(sil, outside.x, outside.y)).toBe(false);
    // Sliding along the axis never leaves the hull.
    expect(insideSilhouette(sil, 720 + sil.dx * 300, 450 + sil.dy * 300)).toBe(true);
  });
});
