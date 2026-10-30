import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { COIL } from "@/lib/coil/constants";
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
// frame from the click until the columns begin to arrive (they rise in until
// dealt, over the pull's last, slowest stretch and the Coil at rest).

const FRAME_MS = 1000 / 60;
const TOTAL_MS = dealMs();
// When the columns begin to arrive, from the click (lib/home/dealOpen.ts addOpen).
const COLUMNS_FROM_MS = COIL.deal.timeline.condenseMs + COIL.deal.columns.delayMs;
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

    test("the deal never stands still: some card moves a visible amount in every frame until the columns are arriving", async ({ page }) => {
      await openHome(page, { debug: "1", at: "foot" });
      await stageInView(page);
      const frames = await walk(page, 0, TOTAL_MS);
      // Each card by its place on the strand (its position less the strand's offset), as drawn on screen.
      const centers = frames.map(({ read }) => {
        const map = new Map<number, { x: number; y: number }>();
        for (const pose of read.poses) if (pose.alpha > 0.5) map.set(Math.round(pose.u - read.offset), projectPoint(read.camera, pose.position));
        return map;
      });
      // The most any card moves in each frame, from the click on.
      const moves = centers.slice(1).map((now, i) => {
        let most = 0;
        for (const [key, p] of now) {
          const q = centers[i].get(key);
          if (q) most = Math.max(most, Math.hypot(p.x - q.x, p.y - q.y));
        }
        return { ms: frames[i + 1].ms, most };
      });
      // The Coil settles as the pull lands; the columns arrive from here on (their own
      // 420 ms rises, staggered, until dealt), so the cards must keep moving until then.
      const columnsMs = COLUMNS_FROM_MS;
      const before = moves.filter((m) => m.ms <= columnsMs);
      const stillest = before.reduce((a, b) => (b.most < a.most ? b : a));
      const firstStill = moves.find((m) => m.most < LEAST_MOTION_PX);
      test.info().annotations.push({
        type: "motion",
        description: `before the columns (${columnsMs} ms) the stillest frame moves its fastest card ${stillest.most.toFixed(2)} px, at ${stillest.ms.toFixed(0)} ms; the cards first move under ${LEAST_MOTION_PX} px at ${firstStill ? firstStill.ms.toFixed(0) : "never"} ms, the unfurl at ${TOTAL_MS} ms`,
      });
      expect(stillest.most, `the stillest frame before the columns, at ${stillest.ms.toFixed(0)} ms`).toBeGreaterThanOrEqual(LEAST_MOTION_PX);
    });
  });
}
