import { COIL } from "@/lib/coil/constants";
import { test, expect } from "./support/fixtures";
import { coilPoints, openHome, type Point } from "./support/coil";
import { frames, type Recording } from "./support/frames";
import { approach, pointerTo, steadyStream, trackpad } from "./support/input";

// The chevron nudge: it appears once a coil gesture has been held
// COIL.capture.nudgeAfterMs (2.6s), and goes the instant the coil lets go of
// the wheel, by a real pointer move off the helix or by the gesture ending.

const NUDGE_MS = COIL.capture.nudgeAfterMs;
const GAP_MS = COIL.capture.gestureGapMs;

function firstShown(recording: Recording) {
  return recording.rows.find((row) => row.nudge > 0);
}

// Index, among the frames after `t`, of the first one without the nudge.
function framesUntilHidden(recording: Recording, t: number) {
  return recording.rows.filter((row) => row.t > t).findIndex((row) => row.nudge === 0);
}

test.describe("nudge", () => {
  test("appears at about 2.6s of held capture and goes within a frame of the gesture ending", async ({ page, cdp }) => {
    await openHome(page);
    const { card } = await coilPoints(page);
    await approach(cdp, card);

    const recording = await frames(page, () => trackpad(cdp, steadyStream(NUDGE_MS + 700, 2), { at: card }), {
      tailMs: GAP_MS + 150,
    });

    const start = recording.wheels[0].t;
    const shown = firstShown(recording);
    expect(shown, "the nudge showed").toBeTruthy();
    expect(shown!.t - start, "ms from the first wheel to the nudge").toBeGreaterThanOrEqual(NUDGE_MS - 20);
    expect(shown!.t - start).toBeLessThanOrEqual(NUDGE_MS + 120);
    expect(recording.rows.filter((row) => row.t < start + NUDGE_MS - 20).every((row) => row.nudge === 0)).toBe(true);

    const lastWheel = recording.wheels.at(-1)!.t;
    // Still the coil's gesture until the gap has passed, then gone at once.
    expect(recording.rows.filter((row) => row.t > shown!.t && row.t < lastWheel + GAP_MS - 20).every((row) => row.nudge > 0)).toBe(true);
    const hiddenAfter = framesUntilHidden(recording, lastWheel + GAP_MS);
    expect(hiddenAfter, "frames past the gesture's end with the nudge still up").toBeGreaterThanOrEqual(0);
    expect(hiddenAfter).toBeLessThanOrEqual(1);
  });

  test("goes within a frame of a real move off the helix", async ({ page, cdp }) => {
    await openHome(page);
    const { card, outside } = await coilPoints(page);
    await approach(cdp, card);
    let where: Point = card;
    const stream = steadyStream(NUDGE_MS + 900, 2);
    const leaveAt = stream.findIndex(([ms]) => ms >= NUDGE_MS + 400);

    const recording = await frames(
      page,
      () =>
        trackpad(cdp, stream, {
          at: () => where,
          before: async (index) => {
            if (index !== leaveAt) return;
            where = outside;
            await pointerTo(cdp, outside);
          },
        }),
      { tailMs: 100 },
    );

    expect(firstShown(recording), "the nudge showed before the move").toBeTruthy();
    const left = recording.pointers.find((move) => move.x === outside.x && move.y === outside.y);
    expect(left).toBeTruthy();
    const hiddenAfter = framesUntilHidden(recording, left!.t);
    expect(hiddenAfter, "frames after the move with the nudge still up").toBeGreaterThanOrEqual(0);
    expect(hiddenAfter).toBeLessThanOrEqual(1);
  });
});
