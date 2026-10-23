import { COIL } from "@/lib/coil/constants";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, waitForCoilSettled, type Point } from "./support/coil";
import { frames, type FrameRow } from "./support/frames";
import { pointerTo } from "./support/input";

// The title hold: hovering a title in a column glides its card to the front of
// the visible helix once, then the coil holds still (idle drift at zero); title
// to title is one more glide; leaving resumes the idle after resumeDelayMs,
// eased in over resumeMs.

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

// The cards section on screen, and the centers of two titles: one in the Work
// column and one in the Builds column.
async function twoTitles(page: Page): Promise<Point[]> {
  await waitForCoilSettled(page);
  return page.evaluate(() =>
    ["capital-one", "min-max"].map((key) => {
      const r = document.querySelector<HTMLElement>(`#work button[data-card="${key}"]`)!.getBoundingClientRect();
      return { x: Math.round(r.left + Math.min(60, r.width / 3)), y: Math.round(r.top + r.height / 2) };
    }),
  );
}

test.describe("title hold", () => {
  test("hovering a title glides once, then holds still; title to title is one glide; leaving resumes the idle", async ({ page, cdp }) => {
    await openHome(page);
    const rows = await twoTitles(page);
    // The pointer starts off the columns, in the page gutter.
    await pointerTo(cdp, { x: 6, y: rows[0].y });
    await nextFrames(page, 2);

    const first = await frames(page, async () => {
      await pointerTo(cdp, rows[0]);
      await page.waitForTimeout(3000);
    });
    expect(motionRuns(first.rows), "glides after hovering the title").toBeLessThanOrEqual(1);
    const heldFrom = first.rows[0].t + 1000;
    expect(Math.abs(travelBetween(first.rows, heldFrom, heldFrom + 2000)), "travel while held, cards").toBeLessThan(1e-3);

    const second = await frames(page, async () => {
      await pointerTo(cdp, rows[1]);
      await page.waitForTimeout(1600);
    });
    expect(motionRuns(second.rows), "glides from title to title").toBeLessThanOrEqual(1);
    const end = second.rows.at(-1)!.t;
    expect(Math.abs(travelBetween(second.rows, end - 500, end)), "travel once the second glide is over").toBeLessThan(1e-3);

    const leaving = await frames(page, async () => {
      await pointerTo(cdp, { x: 6, y: rows[1].y });
      await page.waitForTimeout(HOLD.resumeDelayMs + HOLD.resumeMs + 1100);
    });
    const left = leaving.rows[0].t;
    expect(Math.abs(travelBetween(leaving.rows, left, left + HOLD.resumeDelayMs - 50)), "travel inside the resume delay").toBeLessThan(1e-3);
    // Full idle is COIL.idleCardsPerSecond (0.09): a second of it is well over 0.05 cards.
    const resumed = left + HOLD.resumeDelayMs + HOLD.resumeMs;
    expect(Math.abs(travelBetween(leaving.rows, resumed, resumed + 1000)), "idle travel after the resume").toBeGreaterThan(0.05);
  });
});
