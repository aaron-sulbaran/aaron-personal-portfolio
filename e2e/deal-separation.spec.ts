import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { dealMs } from "@/lib/coil/dealSpeed";
import { projectPoint, type Camera } from "@/lib/coil/geometry";
import { frameSeparation, MIN_GAP_SHARE, type SeparationPose } from "@/lib/coil/separation";

// Every card is its own card, in every frame of the deal (Aaron's review of the
// cutscene video, 2026-10-29: "the cards are clipping through each other", "the
// cards should still have space between them and act as their own individual
// assets"). The deal is walked on its own clock (?coildebug stepEntrance, the
// master's proxy: forcedEntranceMs), one 60 Hz frame at a time from just before
// the click to just past the unfurl, through the condense, the curl, the wheel,
// the band, the lift and the unfurl, and each frame's poses are read as drawn
// (__coil.renderedPoses) and measured (lib/coil/separation.ts):
// - no two cards shown cut through each other in 3D;
// - no two neighbors on the near side of the ring (both facing the camera)
//   overlap on screen;
// - the least gap between any two cards stays at or above MIN_GAP_SHARE of a
//   card's width.
// And the deal never stands still: some card moves a visible amount in every
// frame from the click to the unfurl (after it the columns are arriving).

const FRAME_MS = 1000 / 60;
const TOTAL_MS = dealMs();
// The least a frame moves the card that moves most, CSS px: under a pixel reads as a pause.
const LEAST_MOTION_PX = 1;

type PoseRead = { camera: Camera; poses: SeparationPose[]; offset: number };
type SeparationWindow = Window &
  typeof globalThis & {
    __coil: {
      stepEntrance: (ms: number | null) => void;
      renderedPoses: () => { camera: Camera | null; poses: SeparationPose[] };
      offset: () => number;
    };
  };

// The stage stuck at the top of the screen, whole in view, a little way into its
// sticky range (short of where a scroll starts the deal), as e2e/deal-jank.spec.ts has it.
async function stageInView(page: Page) {
  await page.evaluate(() => {
    const rail = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
    window.scrollTo({ top: rail.top + window.scrollY + (rail.height - stage.height) * 0.08, behavior: "instant" });
  });
  await page.waitForTimeout(600);
}

async function walk(page: Page, fromMs: number, toMs: number): Promise<{ ms: number; read: PoseRead }[]> {
  const steps: number[] = [];
  for (let ms = fromMs; ms <= toMs; ms += FRAME_MS) steps.push(ms);
  const reads = await page.evaluate((list) => {
    const w = window as SeparationWindow;
    const out = list.map((ms) => {
      w.__coil.stepEntrance(ms);
      const { camera, poses } = w.__coil.renderedPoses();
      return { camera: camera!, poses, offset: w.__coil.offset() };
    });
    w.__coil.stepEntrance(null);
    return out;
  }, steps);
  return reads.map((read, i) => ({ ms: steps[i], read }));
}

for (const size of [
  { name: "1280x800", viewport: { width: 1280, height: 800 }, touch: false },
  { name: "390x844", viewport: { width: 390, height: 844 }, touch: true },
]) {
  test.describe(`the deal at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: size.touch ? 2 : 1 });

    test("every card keeps its own space in every frame: no two cut through each other, no near neighbors overlap, the gap never under the floor", async ({ page }) => {
      test.setTimeout(120_000);
      await openHome(page, { debug: "1", at: "foot" });
      await stageInView(page);
      const frames = await walk(page, -4 * FRAME_MS, TOTAL_MS + 4 * FRAME_MS);
      expect(frames.length).toBeGreaterThan(100);
      const failures: string[] = [];
      let leastGap = Infinity;
      let leastGapAt = 0;
      let leastScreen = Infinity;
      for (const { ms, read } of frames) {
        const s = frameSeparation(read.poses, read.camera);
        const at = `${ms.toFixed(0)} ms from the click`;
        if (s.intersections.length) failures.push(`${at}: ${s.intersections.length} pairs cut through each other (${s.intersections.slice(0, 3).map((p) => p.map((u) => u.toFixed(2)).join("/")).join(", ")})`);
        if (s.screenOverlaps.length) failures.push(`${at}: ${s.screenOverlaps.length} near neighbors overlap on screen (${s.screenOverlaps.slice(0, 3).map((p) => p.map((u) => u.toFixed(2)).join("/")).join(", ")})`);
        if (s.minGap < MIN_GAP_SHARE) failures.push(`${at}: the least gap is ${(s.minGap * 100).toFixed(1)}% of a card's width`);
        if (s.minGap < leastGap) {
          leastGap = s.minGap;
          leastGapAt = ms;
        }
        leastScreen = Math.min(leastScreen, s.minScreenPx);
      }
      test.info().annotations.push({
        type: "separation",
        description: `${frames.length} frames: the least 3D gap ${(leastGap * 100).toFixed(1)}% of a card's width at ${leastGapAt.toFixed(0)} ms; the least on-screen gap between near neighbors ${leastScreen.toFixed(1)} px`,
      });
      expect(failures.slice(0, 12), `${failures.length} frames fail`).toEqual([]);
    });

    test("the deal never stands still: some card moves a visible amount in every frame from the click to the unfurl", async ({ page }) => {
      await openHome(page, { debug: "1", at: "foot" });
      await stageInView(page);
      const frames = await walk(page, 0, TOTAL_MS);
      // Each card by its place on the strand (its position less the strand's offset), as drawn on screen.
      const centers = frames.map(({ read }) => {
        const map = new Map<number, { x: number; y: number }>();
        for (const pose of read.poses) if (pose.alpha > 0.5) map.set(Math.round(pose.u - read.offset), projectPoint(read.camera, pose.position));
        return map;
      });
      let least = Infinity;
      let leastAt = 0;
      for (let i = 1; i < centers.length; i++) {
        let most = 0;
        for (const [key, p] of centers[i]) {
          const q = centers[i - 1].get(key);
          if (q) most = Math.max(most, Math.hypot(p.x - q.x, p.y - q.y));
        }
        if (most < least) {
          least = most;
          leastAt = frames[i].ms;
        }
      }
      test.info().annotations.push({ type: "motion", description: `the stillest frame moves its fastest card ${least.toFixed(2)} px, at ${leastAt.toFixed(0)} ms` });
      expect(least, `the stillest frame, at ${leastAt.toFixed(0)} ms`).toBeGreaterThanOrEqual(LEAST_MOTION_PX);
    });
  });
}
