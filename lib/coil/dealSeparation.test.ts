import { describe, expect, it } from "vitest";
import { COIL } from "./constants";
import { dealMs, dealOffsetAt, dealSpeedOf, integrateDealSpeed, sceneMs } from "./dealSpeed";
import { curlProgress, entranceClock, entranceHelix, entrancePose } from "./entrance";
import { cameraFor, coilPose, restHelix, solveGeometry, type Viewport } from "./geometry";
import { ribbonAnticipatedGather, ribbonCardsPerSecond, ribbonEdge } from "./ribbon";
import { frameSeparation, MIN_GAP_SHARE } from "./separation";

// Every card keeps its own space through the whole deal (Aaron's review of
// 2026-10-29), on the poses the scene draws, walked at 60 Hz with the same pure
// functions the scene poses with: the condense (after a hover's tightening too,
// gathered toward a button off the middle), the curl, the wheel, the band, the
// lift and the unfurl. e2e/deal-separation.spec.ts holds the drawn frames to the
// same rules.

const FRAME_MS = 1000 / 60;

type Stage = { pane: Viewport; canvas: Viewport; ribbonCy: number; coarse: boolean; phone?: boolean };

// The stages as the page lays them out (measured on the page: the pane narrower
// than the canvas where the columns flank it, the ribbon's slot about a third
// down; a phone's stage is page 2's band, COIL.phone.bandSvh of the screen).
const STAGES: [string, Stage][] = [
  ["1280x800", { pane: { width: 858, height: 800 }, canvas: { width: 1280, height: 800 }, ribbonCy: 280, coarse: false }],
  ["1440x900", { pane: { width: 965, height: 900 }, canvas: { width: 1440, height: 900 }, ribbonCy: 315, coarse: false }],
  ["390x844", { pane: { width: 390, height: 490 }, canvas: { width: 390, height: 490 }, ribbonCy: 171, coarse: true, phone: true }],
  ["375x667", { pane: { width: 375, height: 387 }, canvas: { width: 375, height: 387 }, ribbonCy: 135, coarse: true, phone: true }],
  ["430x932", { pane: { width: 430, height: 541 }, canvas: { width: 430, height: 541 }, ribbonCy: 189, coarse: true, phone: true }],
];

function walk({ pane, canvas, ribbonCy, coarse, phone }: Stage, hover: number, buttonDxPx: number) {
  const c = COIL;
  const geo = solveGeometry(pane, 14, c, { canvas, ribbonCy, phone });
  const camera = cameraFor(canvas, c);
  const rate = ribbonCardsPerSecond(geo, c, hover);
  const table = integrateDealSpeed(dealSpeedOf(rate, c, coarse), sceneMs(c));
  const atPull = dealOffsetAt(table, c.deal.timeline.pullStartMs);
  const lead = c.deal.timeline.condenseMs;
  const failures: string[] = [];
  let least = Number.POSITIVE_INFINITY;
  for (let click = -2 * FRAME_MS; click <= dealMs(c) + 2 * FRAME_MS; click += FRAME_MS) {
    const ms = click - lead;
    const offset = ms < 0 ? (rate * ms) / 1000 : dealOffsetAt(table, ms);
    const drift = ms > c.deal.timeline.pullStartMs ? offset - atPull : 0;
    const clock = entranceClock(ms, c, { drift, gather0: ribbonAnticipatedGather(hover, c), gatherDxPx: buttonDxPx });
    const helix = entranceHelix(restHelix(geo), geo, clock);
    const edge = curlProgress(clock) < 1 ? ribbonEdge(geo, c) : undefined;
    const poses = Array.from({ length: geo.slotCount }, (_, j) => entrancePose(coilPose(helix, j, offset), { cardCount: 14, edge }, clock));
    const s = frameSeparation(poses, camera);
    least = Math.min(least, s.minGap);
    const at = `${click.toFixed(0)} ms`;
    if (s.intersections.length) failures.push(`${at}: ${s.intersections.length} pairs cut through each other`);
    if (s.screenOverlaps.length) failures.push(`${at}: ${s.screenOverlaps.length} near neighbors overlap on screen`);
    if (s.minGap < MIN_GAP_SHARE) failures.push(`${at}: the least gap is ${(s.minGap * 100).toFixed(1)}% of a card's width`);
  }
  return { failures, least };
}

describe("every card keeps its own space through the deal", () => {
  it.each(STAGES)("at %s", (_name, stage) => {
    const { failures, least } = walk(stage, 0, 0);
    expect(failures.slice(0, 8)).toEqual([]);
    expect(least).toBeGreaterThanOrEqual(MIN_GAP_SHARE);
  }, 60_000);

  it.each(STAGES.slice(0, 2))("at %s after a hover's tightening, gathered toward a button off the middle", (_name, stage) => {
    const { failures } = walk(stage, 1, 120);
    expect(failures.slice(0, 8)).toEqual([]);
  }, 60_000);
});
