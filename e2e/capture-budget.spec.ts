import { downFirstQuick } from "@/lib/coil/capture.fixtures";
import { test, expect } from "./support/fixtures";
import { coilPoints, offset, openHome, settleOn, waitForGestureEnd } from "./support/coil";
import { approach, trackpad } from "./support/input";

// Spin, then pass (docs/coil-input-model.md section 3, "The still-pointer
// budget"). Page 2 is one viewport tall and the Coil fills it, so before the
// budget a pointer resting on a card made every scroll down a coil spin and
// the page never moved ("the coil doesn't let me move at all", 2026-11-06).

// About 300 ms of a trackpad fling.
const fling = downFirstQuick.slice(0, 25);
const PAUSE_MS = 600;
const FLINGS = 12;

test.describe("capture: a resting pointer on a card cannot trap the wheel", () => {
  test("repeated flings down: the coil spins first, then the page scrolls", async ({ page, cdp }) => {
    await openHome(page);
    const { card } = await coilPoints(page);
    await approach(cdp, card);
    const startY = await page.evaluate(() => window.scrollY);
    const startOffset = await offset(page);

    for (let i = 0; i < FLINGS; i++) {
      await trackpad(cdp, fling, { at: card });
      await waitForGestureEnd(page);
      await page.waitForTimeout(PAUSE_MS);
    }

    const endY = await page.evaluate(() => window.scrollY);
    const endOffset = await offset(page);
    console.log(`budget repro: scrollY ${startY} -> ${endY}, coil offset ${startOffset.toFixed(1)} -> ${endOffset.toFixed(1)}`);
    expect(Math.abs(endOffset - startOffset), "the coil spun for the first flings, cards").toBeGreaterThan(1);
    expect(endY - startY, "the page moved once the budget was spent, px").toBeGreaterThan(200);
  });

  test("a pointer that keeps moving keeps the coil", async ({ page, cdp }) => {
    await openHome(page);
    const startY = await page.evaluate(() => window.scrollY);

    for (let i = 0; i < FLINGS; i++) {
      // Each spin carries the cards out from under a fixed point, and past the
      // grace a gap is the page's, so the hand aims at a card again before each
      // fling. approach() travels well over rearmPx, which restarts the count.
      const at = await settleOn(page, cdp, async () => (await coilPoints(page)).card, (probe) => probe.onCard && probe.armed);
      expect(at, `fling ${i}: a card to aim at`).not.toBeNull();
      await trackpad(cdp, fling, { at: at! });
      await waitForGestureEnd(page);
      await page.waitForTimeout(PAUSE_MS);
    }

    expect(await page.evaluate(() => window.scrollY) - startY, "page movement, px").toBeLessThan(5);
  });
});
