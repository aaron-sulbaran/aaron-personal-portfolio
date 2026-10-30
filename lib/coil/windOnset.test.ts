import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { dealOffsetAt, dealSpeedOf, integrateDealSpeed, sceneMs } from "@/lib/coil/dealSpeed";
import { entranceClock, entranceHelix, pullPhases, pullProgress, tunedConstants } from "@/lib/coil/entrance";
import { poseAt, projectPoint, restHelix, solveGeometry, type CoilGeometry } from "@/lib/coil/geometry";
import { ribbonCardsPerSecond } from "@/lib/coil/ribbon";
import { strandCards } from "@/lib/content";
import { stageReachAbove } from "@/lib/home/stageLead";

// The winding's onset (the motion review's P2): a card's projected center, a frame
// apart, through the deal. The second difference is its acceleration; the pull's
// winding starting at full rate kicked it to about 34 px over two frames, against
// at most 9 px elsewhere. windRampMs eases the onset, and its default is the
// ramp that keeps the onset's second difference under ONSET_BOUND_PX at
// every size the deal runs at (e2e/deal-jank.spec.ts holds the same number to the
// drawn frames). Pure: the same functions the scene poses with.

const FRAME_MS = 1000 / 60;
const ONSET_BOUND_PX = 12;

// Every card's second difference, frame by frame (click time), for a geometry and a ramp.
function secondDifferences(geo: CoilGeometry, windRampMs: number, only?: readonly number[]): { onsetMs: number; worstOnset: number; worstElsewhere: number } {
  const c = tunedConstants({ timeline: { windRampMs } });
  const lead = c.deal.timeline.condenseMs;
  const total = lead + sceneMs(c);
  const table = integrateDealSpeed(dealSpeedOf(ribbonCardsPerSecond(geo, c), c, false), sceneMs(c));
  const rest = restHelix(geo);
  const atPull = dealOffsetAt(table, c.deal.timeline.pullStartMs);
  const cards = only ?? Array.from({ length: geo.cardCount }, (_, i) => i - geo.cardCount / 2);
  const center = (ms: number, p: number) => {
    const dealMs = ms - lead;
    const offset = dealMs <= 0 ? (ribbonCardsPerSecond(geo, c) * dealMs) / 1000 : dealOffsetAt(table, dealMs);
    const drift = dealMs > c.deal.timeline.pullStartMs ? offset - atPull : 0;
    const frame = entranceHelix(rest, geo, entranceClock(dealMs, c, drift), c);
    // The card's place on the strand: it turns with the strand until the pull
    // begins; from then on the ring's cards keep their places in the ring (the
    // scene's inRing), so it is the card's place in the ring then, carried by the drift.
    const wrap = (x: number) => ((((x + geo.cardCount / 2) % geo.cardCount) + geo.cardCount) % geo.cardCount) - geo.cardCount / 2;
    const u = dealMs > c.deal.timeline.pullStartMs ? wrap(p + atPull) + drift : p + offset;
    const pose = poseAt(frame, u);
    return projectPoint(geo.camera, pose.position, { left: geo.canvas.width / 2 - geo.camera.width / 2, top: 0 });
  };
  let onsetMs = total;
  for (let ms = lead; ms < total; ms += 1) if (pullPhases(pullProgress(entranceClock(ms - lead, c), c), c).wind > 0) {
    onsetMs = ms;
    break;
  }
  let worstOnset = 0;
  let worstElsewhere = 0;
  for (const p of cards) {
    let a = center(0, p);
    let b = center(FRAME_MS, p);
    for (let ms = 2 * FRAME_MS; ms <= total; ms += FRAME_MS) {
      const d = center(ms, p);
      const second = Math.hypot(d.x - 2 * b.x + a.x, d.y - 2 * b.y + a.y);
      const at = ms - FRAME_MS;
      if (at >= onsetMs - 2 * FRAME_MS && at <= onsetMs + 3 * FRAME_MS) worstOnset = Math.max(worstOnset, second);
      else worstElsewhere = Math.max(worstElsewhere, second);
      a = b;
      b = d;
    }
  }
  return { onsetMs, worstOnset, worstElsewhere };
}

// The stage as the page makes it: its frame's size, the ribbon's slot as far down as the wheel needs room above it.
const stage = (width: number, height: number) => solveGeometry({ width, height }, 14, COIL, { canvas: { width, height }, ribbonCy: stageReachAbove(height, width) });
const geos = [
  ["1440x900", stage(1440, 900)],
  ["1280x800", stage(1280, 800)],
  ["390x460", stage(390, 460)],
] as const;

// The three cards the drawn-frame test follows (e2e/deal-jank.spec.ts), by their place in the ring at the start.
const wrap = (x: number) => ((((x + 7) % 14) + 14) % 14) - 7;
const followed = ["ieee", "talos", "anthropic"].map((key) => wrap(strandCards.findIndex((card) => card.key === key)));

describe("the winding's onset ramp, measured on the poses", () => {
  it.each(geos)("is a kick without a ramp at %s", (_name, geo) => {
    expect(secondDifferences(geo, 0, followed).worstOnset, "without a ramp").toBeGreaterThan(ONSET_BOUND_PX);
  });

  it.each(geos)("takes the kick down to the deal's own acceleration at %s with the default ramp", (_name, geo) => {
    const none = secondDifferences(geo, 0, followed);
    const eased = secondDifferences(geo, COIL.deal.timeline.windRampMs, followed);
    // The poses read about a fifth higher than the drawn frames do (34 px measured there, 41 here, without a ramp).
    expect(eased.worstOnset).toBeLessThan(ONSET_BOUND_PX * 1.25);
    expect(eased.worstOnset).toBeLessThan(none.worstOnset / 2.5);
    // And nothing else in the deal got worse for it.
    expect(eased.worstElsewhere).toBeLessThan(14 * 1.25);
  });

  it("is no kick at any longer ramp either: the onset only falls as the ramp grows, to the floor of the deal's own acceleration", () => {
    const [, geo] = geos[1];
    let last = Number.POSITIVE_INFINITY;
    for (const ramp of [200, 300, 400, 480, 590]) {
      const now = secondDifferences(geo, ramp, followed).worstOnset;
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
  });
});

export { secondDifferences };
