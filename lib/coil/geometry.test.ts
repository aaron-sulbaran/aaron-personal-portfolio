import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  cameraFor,
  cardDistancePx,
  cardDistancesPx,
  cardHit,
  clearTopFor,
  isNarrow,
  coilPose,
  nearCard,
  endFade,
  insideSilhouette,
  mod,
  pickCard,
  poseAt,
  projectPoint,
  projectQuad,
  rayThrough,
  restHelix,
  seamMarginPx,
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

// The widest seam's half width as a share of the card height (geometry.ts).
const SEAM_SHARE_MAX = 0.11;

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

  it("gives every pane an even slot count of at least N that fills it", () => {
    for (const viewport of viewports) {
      for (const n of [5, 13, 14, 15, 20, 29]) {
        const geo = solveGeometry(viewport, n);
        expect(geo.slotCount % 2).toBe(0);
        expect(geo.slotCount).toBeGreaterThanOrEqual(n);
        expect(geo.slotCount).toBeGreaterThanOrEqual(geo.need - 1);
        expect(geo.spans).toBe(true);
      }
    }
  });

  it("repeats to fill a narrow pane, never growing the cards past the table height", () => {
    for (const viewport of viewports.filter((v) => isNarrow(v))) {
      const geo = solveGeometry(viewport, STRAND);
      expect(geo.cardPx).toBeLessThanOrEqual(viewport.height * COIL.cardHeightFrac + 1e-9);
      expect(geo.slotCount).toBeGreaterThanOrEqual(geo.need - 1);
    }
    // Tablet portrait keeps the table's card height (24 percent), not a stretched fit.
    const tablet = solveGeometry({ width: 768, height: 1024 }, STRAND);
    expect(tablet.cardPx).toBeCloseTo(1024 * COIL.cardHeightFrac, 6);
  });

  it("fits a narrow pane exactly, every card once, when the fit is exact", () => {
    const exact = { ...COIL, narrow: { ...COIL.narrow, strandFit: "exact" as const } };
    for (const viewport of viewports.filter((v) => isNarrow(v))) {
      for (const n of [13, 14, 15]) {
        const geo = solveGeometry(viewport, n, exact);
        expect(geo.slotCount).toBe(n);
        expect(geo.repeats).toBe(0);
        const cards = Array.from({ length: geo.slotCount }, (_, j) => strandIndex(j, 0.37, n, geo.slotCount));
        expect(new Set(cards).size).toBe(n);
      }
    }
  });

  it("keeps the header and the greeting's line clear on a narrow pane", () => {
    const geo = solveGeometry(PHONE, STRAND);
    const clear = COIL.narrow.headerClearPx + COIL.narrow.introBandPx;
    expect(clearTopFor(PHONE)).toBe(clear);
    expect(geo.clearTopPx).toBe(clear);
    // The helix centers in the pane under the band: half the band lower.
    const center = projectPoint(geo.camera, geo.center);
    expect(center.y).toBeCloseTo(PHONE.height / 2 + clear / 2, 6);
    expect(center.x).toBeCloseTo(PHONE.width / 2, 6);
    expect(restHelix(geo).center).toEqual(geo.center);
    // Wide panes keep the pane's center and no band.
    const wide = solveGeometry(DESKTOP, STRAND);
    expect(wide.clearTopPx).toBe(0);
    expect(projectPoint(wide.camera, wide.center).y).toBeCloseTo(DESKTOP.height / 2, 6);
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

describe("near a card (wheel capture, rule A)", () => {
  const camera = cameraFor(DESKTOP);
  const halfWidth = 100 * COIL.cardAspect;

  it("measures the on-screen distance to the nearest and the second nearest card's picked footprint, 0 on it", () => {
    const card = flatCardAt(700, 400, 200);
    expect(cardDistancePx([card], camera, 700, 400)).toBe(0);
    expect(cardDistancePx([card], camera, 700 + halfWidth - 1, 400 + 99)).toBe(0);
    expect(cardDistancePx([card], camera, 700 + halfWidth + 10, 400)).toBeCloseTo(10, 6);
    expect(cardDistancePx([card], camera, 700, 400 - 100 - 15)).toBeCloseTo(15, 6);
    expect(cardDistancePx([card], camera, 700 + halfWidth + 3, 400 - 100 - 4)).toBeCloseTo(5, 6);
    // A second card 30px to the right: a point 10px off the first is 20px off the second.
    const right = flatCardAt(700 + 2 * halfWidth + 30, 400, 200);
    const both = cardDistancesPx([card, right], camera, 700 + halfWidth + 10, 400);
    expect(both.nearest).toBeCloseTo(10, 6);
    expect(both.second).toBeCloseTo(20, 6);
    expect(cardDistancesPx([card], camera, 700, 400).second).toBe(Infinity);
  });

  it("counts a point on a card by itself, and a point off every card only when two cards are within the margin", () => {
    const card = flatCardAt(700, 400, 200);
    const right = flatCardAt(700 + 2 * halfWidth + 30, 400, 200);
    expect(nearCard([card], camera, 700, 400, 0)).toBe(true);
    // In the 30px seam: 10px off one card, 20px off the other.
    expect(nearCard([card, right], camera, 700 + halfWidth + 10, 400, 21)).toBe(true);
    expect(nearCard([card, right], camera, 700 + halfWidth + 10, 400, 19)).toBe(false);
  });

  it("leaves the rim beside a free edge of a lone card to the page", () => {
    const card = flatCardAt(700, 400, 200);
    const margin = seamMarginPx(solveGeometry(DESKTOP, STRAND));
    for (const [x, y] of [
      [700 + halfWidth + 5, 400],
      [700 - halfWidth - 10, 450],
      [700, 400 - 100 - 3],
      [700 + halfWidth + 2, 400 + 100 + 2],
    ]) {
      expect(cardDistancePx([card], camera, x, y)).toBeLessThan(margin);
      expect(nearCard([card], camera, x, y, margin), `(${x}, ${y})`).toBe(false);
    }
  });

  it("never counts a card picking would skip (faded, or behind the camera), and is false with no cards", () => {
    const card = flatCardAt(700, 400, 200);
    expect(cardDistancePx([{ ...card, alpha: 0.4 }], camera, 700, 400)).toBe(Infinity);
    expect(nearCard([{ ...card, alpha: 0.4 }], camera, 700, 400, 50)).toBe(false);
    expect(nearCard([], camera, 700, 400, 50)).toBe(false);
    // Behind the camera, the mirrored projection would land on screen; picking never hits it.
    const behind: CardPose = { ...card, position: [-card.position[0], -card.position[1], camera.distance + 5] };
    const ray = rayThrough(camera, 700, 400);
    expect(pickCard([behind], ray)).toBe(-1);
    for (const [x, y] of [
      [700, 400],
      [740, 500],
      [1440 - 700, 900 - 400],
    ]) {
      expect(pickCard([behind], rayThrough(camera, x, y))).toBe(-1);
      expect(cardDistancePx([behind], camera, x, y)).toBe(Infinity);
    }
  });

  it("agrees with picking: distance 0 exactly where a card is picked", () => {
    const frame = restHelix(solveGeometry(DESKTOP, STRAND));
    const poses = Array.from({ length: frame.slotCount }, (_, slot) => coilPose(frame, slot, 0.3));
    let picked = 0;
    for (let y = 3.5; y < DESKTOP.height; y += 9) {
      for (let x = 3.5; x < DESKTOP.width; x += 9) {
        const hit = pickCard(poses, rayThrough(camera, x, y)) >= 0;
        const distance = cardDistancePx(poses, camera, x, y);
        if (hit) picked += 1;
        // A point within a hair of an edge may round either way.
        if (distance > 0.01) expect(hit, `(${x}, ${y})`).toBe(false);
        if (distance === 0) expect(hit, `(${x}, ${y})`).toBe(true);
      }
    }
    expect(picked).toBeGreaterThan(1000);
  });

  // Adjacent pairs on screen: for every pair of slots next to each other on
  // the strand, both picked (alpha over a half) and both centers on the pane,
  // the midpoints between A's right edge and B's left edge (the seam, from
  // top to bottom) that picking misses. `envelope` stretches the helix as a
  // spin does (lib/coil/motion.ts stretchedDy).
  function seamPoints(viewport: { width: number; height: number }, offset: number, frontOnly: boolean, envelope = 0) {
    const geo = solveGeometry(viewport, STRAND);
    const rest = restHelix(geo);
    const frame = { ...rest, dy: rest.dy * (1 + envelope) };
    const poses = Array.from({ length: frame.slotCount }, (_, slot) => coilPose(frame, slot, offset));
    const order = poses.map((_, slot) => slot).sort((a, b) => poses[a].u - poses[b].u);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < order.length; i++) {
      const a = poses[order[i]];
      const b = poses[order[i + 1]];
      if (a.alpha <= 0.5 || b.alpha <= 0.5 || (frontOnly && Math.min(a.depth, b.depth) <= 0.7)) continue;
      const ca = projectPoint(geo.camera, a.position);
      const cb = projectPoint(geo.camera, b.position);
      if ([ca, cb].some((c) => c.y < 0 || c.y > viewport.height)) continue;
      const qa = projectQuad({ ...a, bend: 0 }, geo.camera);
      const qb = projectQuad({ ...b, bend: 0 }, geo.camera);
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const x = (qa[1].x + (qa[2].x - qa[1].x) * t + qb[0].x + (qb[3].x - qb[0].x) * t) / 2;
        const y = (qa[1].y + (qa[2].y - qa[1].y) * t + qb[0].y + (qb[3].y - qb[0].y) * t) / 2;
        if (pickCard(poses, rayThrough(geo.camera, x, y)) < 0) points.push({ x, y });
      }
    }
    return { geo, poses, points };
  }

  const panes = [
    { width: 1485, height: 927 },
    DESKTOP,
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ];

  // Rule A off a card needs two cards within the margin: the seam's width is
  // the farther of the two nearest cards, at its widest point.
  function widestSeam(pane: { width: number; height: number }, frontOnly: boolean, envelope = 0) {
    let widest = 0;
    for (let k = 0; k < 20; k++) {
      const { geo, poses, points } = seamPoints(pane, k / 20, frontOnly, envelope);
      for (const { x, y } of points) widest = Math.max(widest, cardDistancesPx(poses, geo.camera, x, y).second);
    }
    return widest;
  }

  it("derives the seam margin: the widest seam between adjacent front cards is about a tenth of a card, at any pane", () => {
    for (const pane of panes) {
      const widest = widestSeam(pane, true);
      const cardPx = solveGeometry(pane, STRAND).cardPx;
      // Both cards of the widest seam are this far from its middle, as a share of the card.
      expect(widest / cardPx).toBeGreaterThan(0.09);
      expect(widest / cardPx).toBeLessThan(SEAM_SHARE_MAX);
      // The margin covers it with at least 2px to spare.
      expect(seamMarginPx(solveGeometry(pane, STRAND))).toBeGreaterThanOrEqual(widest + 2);
    }
  });

  it("counts the seam between any two adjacent cards as near, and not without the margin", () => {
    for (const pane of panes) {
      let missedWithoutMargin = 0;
      for (let k = 0; k < 20; k++) {
        const { geo, poses, points } = seamPoints(pane, k / 20, false);
        for (const { x, y } of points) {
          expect(nearCard(poses, geo.camera, x, y, seamMarginPx(geo)), `${pane.width}x${pane.height} (${x}, ${y})`).toBe(true);
          if (!nearCard(poses, geo.camera, x, y, 0)) missedWithoutMargin += 1;
        }
      }
      expect(missedWithoutMargin).toBeGreaterThan(0);
    }
  });

  it("does not cover the seams of a stretched helix: a spin's envelope widens them past the margin", () => {
    // Rule A alone is a rest-pose rule. After a spin the envelope (up to
    // envelopeTargetMax times the turn gap, relaxing over about 2s) stretches
    // the rise per card and the seams open; the continuation rule in
    // lib/coil/capture.ts, not this margin, keeps the next gesture the coil's.
    const pane = { width: 1485, height: 927 };
    const geo = solveGeometry(pane, STRAND);
    let missed = 0;
    let seams = 0;
    for (let k = 0; k < 20; k++) {
      const { poses, points } = seamPoints(pane, k / 20, false, 0.84);
      for (const { x, y } of points) {
        seams += 1;
        if (!nearCard(poses, geo.camera, x, y, seamMarginPx(geo))) missed += 1;
      }
    }
    expect(seams).toBeGreaterThan(100);
    expect(missed / seams).toBeGreaterThan(0.1);
    expect(widestSeam(pane, true, 0.84)).toBeGreaterThan(seamMarginPx(geo));
  });

  it("leaves empty background inside the helix silhouette, and everything far outside it, to the page", () => {
    const geo = solveGeometry(DESKTOP, STRAND);
    const frame = restHelix(geo);
    const poses = Array.from({ length: frame.slotCount }, (_, slot) => coilPose(frame, slot, 0.3));
    const sil = silhouette(frame, camera, poses);
    const margin = seamMarginPx(geo);
    let inside = 0;
    let background = 0;
    for (let y = 5; y < DESKTOP.height; y += 10) {
      for (let x = 5; x < DESKTOP.width; x += 10) {
        if (!insideSilhouette(sil, x, y)) continue;
        inside += 1;
        if (cardDistancePx(poses, camera, x, y) > 3 * margin) background += 1;
      }
    }
    // A real share of the old hull is background more than three margins from any card.
    expect(background / inside).toBeGreaterThan(0.1);
    expect(nearCard(poses, camera, 5, 5, margin)).toBe(false);
    expect(nearCard(poses, camera, DESKTOP.width - 5, DESKTOP.height - 5, margin)).toBe(false);
  });

  // A brute-force distance from a point to a card's flat projected quad, CSS
  // px (0 inside), independent of cardDistancesPx.
  function quadDistance(quad: readonly { x: number; y: number }[], x: number, y: number) {
    const crosses = quad.map((a, i) => {
      const b = quad[(i + 1) % quad.length];
      return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    });
    if (crosses.every((c) => c >= 0) || crosses.every((c) => c <= 0)) return 0;
    return Math.min(
      ...quad.map((a, i) => {
        const b = quad[(i + 1) % quad.length];
        const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        const t = Math.min(1, Math.max(0, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / length2));
        return Math.hypot(a.x + (b.x - a.x) * t - x, a.y + (b.y - a.y) * t - y);
      }),
    );
  }

  it("keeps the rim of free card edges out of rule A on the real helix", () => {
    // The rim: points no card is picked at, within the margin of exactly one
    // pickable card's flat quad, every other one farther. A single-card rule
    // would capture all of them.
    const geo = solveGeometry(DESKTOP, STRAND);
    const frame = restHelix(geo);
    const poses = Array.from({ length: frame.slotCount }, (_, slot) => coilPose(frame, slot, 0.3));
    const quads = poses.filter((pose) => pose.alpha > 0.5).map((pose) => projectQuad({ ...pose, bend: 0 }, camera));
    const margin = seamMarginPx(geo);
    let rim = 0;
    let rimCaptured = 0;
    for (let y = 2; y < DESKTOP.height; y += 6) {
      for (let x = 2; x < DESKTOP.width; x += 6) {
        if (pickCard(poses, rayThrough(camera, x, y)) >= 0) continue;
        const within = quads.filter((quad) => quadDistance(quad, x, y) <= margin).length;
        if (within !== 1) continue;
        rim += 1;
        if (nearCard(poses, camera, x, y, margin)) rimCaptured += 1;
      }
    }
    expect(rim).toBeGreaterThan(300);
    expect(rimCaptured).toBe(0);
  });
});
