import { COIL } from "@/lib/coil/constants";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { heroVisible, nextFrames, openHome, scrollToY, waitForCoilSettled, type Point } from "./support/coil";
import { frames, type FrameRow } from "./support/frames";
import { pointerTo } from "./support/input";

// The row hold: hovering a book row glides its card to the front of the
// visible helix once, then the coil holds still (idle drift and page scroll
// feed at zero); row to row is one more glide; leaving resumes the idle after
// resumeDelayMs, eased in over resumeMs; a hero under a quarter in view does
// nothing.

const HOLD = COIL.rowHold;

// Frames that moved (per-frame travel over `still` cards) grouped into runs;
// a run ends after `gap` still frames.
function motionRuns(rows: FrameRow[], still = 1e-4, gap = 4) {
  let runs = 0;
  let quiet = gap;
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs(rows[i].offset - rows[i - 1].offset) > still) {
      if (quiet >= gap) runs += 1;
      quiet = 0;
    } else quiet += 1;
  }
  return runs;
}

function travelBetween(rows: FrameRow[], from: number, to: number) {
  const inside = rows.filter((row) => row.t >= from && row.t <= to);
  return inside.length ? inside[inside.length - 1].offset - inside[0].offset : Number.NaN;
}

// Scrolls so the photo rows are on screen while the hero keeps `visible` of
// its height in view, and returns the centers of the photo rows on screen.
async function rowsWithHero(page: Page, visible: number): Promise<Point[]> {
  const heroHeight = await page.evaluate(() => document.querySelector("section[data-scene]")!.getBoundingClientRect().height);
  await scrollToY(page, Math.round(heroHeight * (1 - visible)));
  await waitForCoilSettled(page);
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#work button.book-row")]
      .map((row) => row.getBoundingClientRect())
      .filter((r) => r.top > 80 && r.bottom < window.innerHeight - 10)
      .map((r) => ({ x: Math.round(r.left + Math.min(120, r.width / 3)), y: Math.round(r.top + r.height / 2) })),
  );
}

test.describe("row hold", () => {
  test("hovering a book row glides once, then holds still; row to row is one glide; leaving resumes the idle", async ({ page, cdp }) => {
    await openHome(page);
    const rows = await rowsWithHero(page, 0.4);
    expect(rows.length, "photo rows on screen with the hero 40% in view").toBeGreaterThanOrEqual(2);
    expect(await heroVisible(page)).toBeGreaterThan(HOLD.minHeroVisible);
    // The pointer starts off the list, in the page gutter.
    await pointerTo(cdp, { x: 8, y: rows[0].y });
    await nextFrames(page, 2);

    const first = await frames(page, async () => {
      await pointerTo(cdp, rows[0]);
      await page.waitForTimeout(3000);
    });
    expect(motionRuns(first.rows), "glides after hovering the row").toBeLessThanOrEqual(1);
    const heldFrom = first.rows[0].t + 1000;
    expect(Math.abs(travelBetween(first.rows, heldFrom, heldFrom + 2000)), "travel while held, cards").toBeLessThan(1e-3);

    const second = await frames(page, async () => {
      await pointerTo(cdp, rows[1]);
      await page.waitForTimeout(1600);
    });
    expect(motionRuns(second.rows), "glides from row to row").toBeLessThanOrEqual(1);
    const end = second.rows.at(-1)!.t;
    expect(Math.abs(travelBetween(second.rows, end - 500, end)), "travel once the second glide is over").toBeLessThan(1e-3);

    const leaving = await frames(page, async () => {
      await pointerTo(cdp, { x: 8, y: rows[1].y });
      await page.waitForTimeout(HOLD.resumeDelayMs + HOLD.resumeMs + 1100);
    });
    const left = leaving.rows[0].t;
    expect(Math.abs(travelBetween(leaving.rows, left, left + HOLD.resumeDelayMs - 50)), "travel inside the resume delay").toBeLessThan(1e-3);
    // Full idle is COIL.idleCardsPerSecond (0.09): a second of it is well over 0.05 cards.
    const resumed = left + HOLD.resumeDelayMs + HOLD.resumeMs;
    expect(Math.abs(travelBetween(leaving.rows, resumed, resumed + 1000)), "idle travel after the resume").toBeGreaterThan(0.05);
  });

  test("with the hero under a quarter in view, hovering a row moves nothing but the idle", async ({ page, cdp }) => {
    await openHome(page);
    const rows = await rowsWithHero(page, 0.18);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(await heroVisible(page)).toBeLessThan(HOLD.minHeroVisible);
    await pointerTo(cdp, { x: 8, y: rows[0].y });

    const recording = await frames(page, async () => {
      await pointerTo(cdp, rows[0]);
      await page.waitForTimeout(1500);
    });

    const steps = recording.rows.slice(1).map((row, i) => Math.abs(row.offset - recording.rows[i].offset));
    // The idle is 0.0015 cards a frame; a glide runs at up to 12.5 cards a second.
    expect(Math.max(...steps), "largest step in a frame, cards").toBeLessThan(0.005);
    expect(await page.evaluate(() => (window as unknown as { __coil: { focusKey: () => string | null } }).__coil.focusKey())).not.toBeNull();
  });
});
