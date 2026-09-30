import { downAt200, downFirstQuick, jitter, notches, upQuick, type RecordedWheel } from "@/lib/coil/capture.fixtures";
import { test, expect } from "./support/fixtures";
import { coilPoints, heroVisible, openHome, scrollToY, silhouetteDistance, waitForGestureEnd, type Point } from "./support/coil";
import { frames, offsetTravel, pageTravel, type Recording } from "./support/frames";
import { approach, firstPixels, pointerJitter, pointerTo, trackpad } from "./support/input";

// Wheel capture (docs/coil-input-model.md section 3): a gesture that starts
// inside the helix silhouette with the hero at least half in view spins the
// coil from its first event, both directions, and the page does not move.
// These replay recorded Chrome wheel streams through the DevTools input
// pipeline, the path the unit tests and the old gate never exercised.

function expectCoilOwnedAll(recording: Recording, direction: 1 | -1) {
  const { wheels } = recording;
  expect(wheels.length, "wheel events reached the page").toBeGreaterThan(10);
  expect(wheels.filter((wheel) => !wheel.prevented).length, "events the coil left to the page").toBe(0);
  expect(pageTravel(recording), "page movement, px").toBe(0);
  // A stream of a few hundred px turns the coil by more than a card, in the wheel's direction.
  expect(offsetTravel(recording) * direction, "coil travel, cards").toBeGreaterThan(1);
}

test.describe("capture: a gesture over the coil spins it and holds the page still", () => {
  const cases: { name: string; stream: readonly RecordedWheel[]; direction: 1 | -1; where: "card" | "gap"; scrollY: number }[] = [
    { name: "trackpad down from a card at the top", stream: downFirstQuick, direction: 1, where: "card", scrollY: 0 },
    { name: "trackpad up from a card at the top", stream: upQuick, direction: -1, where: "card", scrollY: 0 },
    { name: "trackpad down from a gap inside the silhouette", stream: downFirstQuick, direction: 1, where: "gap", scrollY: 0 },
    { name: "trackpad down from a card with the page at 200px", stream: downAt200, direction: 1, where: "card", scrollY: 200 },
    { name: "trackpad up from a card with the page at 200px", stream: upQuick, direction: -1, where: "card", scrollY: 200 },
    { name: "mouse wheel notches from a card", stream: notches, direction: 1, where: "card", scrollY: 0 },
  ];

  for (const scenario of cases) {
    test(scenario.name, async ({ page, cdp }) => {
      await openHome(page);
      if (scenario.scrollY) await scrollToY(page, scenario.scrollY);
      const points = await coilPoints(page);
      const point = scenario.where === "card" ? points.card : points.gap;
      expect(point, `a ${scenario.where} point on the hero`).toBeTruthy();
      await approach(cdp, point!);

      const recording = await frames(page, () => trackpad(cdp, scenario.stream, { at: point! }), { tailMs: 120 });

      expectCoilOwnedAll(recording, scenario.direction);
    });
  }
});

test("capture: the coil moves within one frame of the first wheel event", async ({ page, cdp }) => {
  await openHome(page);
  const { card } = await coilPoints(page);
  await approach(cdp, card);

  const recording = await frames(page, () => trackpad(cdp, downFirstQuick.slice(0, 12), { at: card }), { tailMs: 100 });

  const first = recording.wheels[0];
  expect(first?.prevented).toBe(true);
  const after = recording.rows.filter((row) => row.t > first.t);
  const before = recording.rows.filter((row) => row.t <= first.t).at(-1)!;
  // Idle drift is 0.09 cards/s (0.0015 a frame); a captured wheel moves the
  // coil several times that on its first frame.
  const moved = after.findIndex((row) => Math.abs(row.offset - before.offset) > 0.004);
  expect(moved, "frames from the first wheel to the first motion").toBeGreaterThanOrEqual(0);
  expect(moved).toBeLessThanOrEqual(1);
});

test.describe("capture: jitter and release", () => {
  test("2px pointer jitter through a whole stream never releases the coil", async ({ page, cdp }) => {
    await openHome(page);
    const { card } = await coilPoints(page);
    await approach(cdp, card);
    const hand = pointerJitter(cdp, card, 2);
    const releasedBefore = await page.evaluate(() => (window as unknown as { __coil: { released: number } }).__coil.released);

    const recording = await frames(page, () => trackpad(cdp, jitter, hand), { tailMs: 100 });

    expectCoilOwnedAll(recording, 1);
    const releasedAfter = await page.evaluate(() => (window as unknown as { __coil: { released: number } }).__coil.released);
    expect(releasedAfter - releasedBefore, "releases during the stream").toBe(0);
  });

  test("a real move outside the silhouette releases on the next event and the page scrolls", async ({ page, cdp }) => {
    await openHome(page);
    const { card, outside } = await coilPoints(page);
    await approach(cdp, card);
    const leaveAt = 30;
    let where: Point = card;

    const recording = await frames(
      page,
      () =>
        trackpad(cdp, jitter, {
          at: () => where,
          before: async (index) => {
            if (index !== leaveAt) return;
            where = outside;
            await pointerTo(cdp, outside);
          },
        }),
      { tailMs: 100 },
    );

    const { wheels, pointers } = recording;
    const left = pointers.find((move) => move.x === outside.x && move.y === outside.y);
    expect(left, "the move outside reached the page").toBeTruthy();
    const before = wheels.filter((wheel) => wheel.t < left!.t);
    const after = wheels.filter((wheel) => wheel.t > left!.t);
    expect(before.length).toBeGreaterThan(5);
    expect(after.length).toBeGreaterThan(5);
    expect(before.every((wheel) => wheel.prevented), "events before the move").toBe(true);
    expect(after.some((wheel) => wheel.prevented), "events after the move").toBe(false);
    expect(pageTravel(recording), "page movement after the release, px").toBeGreaterThan(50);
  });
});

test.describe("capture: page gestures stay the page's", () => {
  test("a page gesture that scrolls the hero under the pointer never converts mid-gesture", async ({ page, cdp }) => {
    await openHome(page);
    // Just off the silhouette on the side the hull moves toward as the page
    // scrolls down: a short scroll brings the helix under the pointer while
    // the hero is still mostly in view.
    const pointer = await page.evaluate(() => {
      const coil = (window as unknown as { __coil: { silhouette: () => { ax: number; ay: number; dx: number; dy: number; half: number } } }).__coil;
      const sil = coil.silhouette();
      const normal = { x: -sil.dy, y: sil.dx };
      const sign = normal.y < 0 ? 1 : -1; // the side where moving the hero up shrinks the distance
      const d = sil.half + 40;
      const rect = document.querySelector("section[data-scene]")!.getBoundingClientRect();
      return { x: Math.round(rect.left + sil.ax + sign * normal.x * d), y: Math.round(rect.top + sil.ay + sign * normal.y * d) };
    });
    expect(await silhouetteDistance(page, pointer)).toBeGreaterThan(20);
    await approach(cdp, pointer);
    const stream = firstPixels(downFirstQuick, 320);

    const recording = await frames(page, () => trackpad(cdp, stream, { at: pointer }), { tailMs: 150 });

    expect(recording.wheels.some((wheel) => wheel.prevented), "events the coil took").toBe(false);
    expect(recording.rows.some((row) => row.owner === "coil"), "frames the coil owned").toBe(false);
    expect(pageTravel(recording)).toBeGreaterThan(150);
    // The precondition held: by the end the helix was under the pointer, with the hero over half in view.
    expect(await silhouetteDistance(page, pointer), "pointer to silhouette at the end, px").toBeLessThan(0);
    expect(await heroVisible(page)).toBeGreaterThanOrEqual(0.5);

    // After the gesture gap, a new gesture from the same spot is the coil's.
    await waitForGestureEnd(page);
    const next = await frames(page, () => trackpad(cdp, downFirstQuick.slice(0, 30), { at: pointer }), { tailMs: 100 });
    expect(next.wheels.every((wheel) => wheel.prevented), "the next gesture's events").toBe(true);
    expect(pageTravel(next)).toBe(0);
  });

  test("a hero under half in view leaves the wheel to the page, even over the helix", async ({ page, cdp }) => {
    await openHome(page);
    await scrollToY(page, 520);
    expect(await heroVisible(page)).toBeLessThan(0.5);
    const { card } = await coilPoints(page);
    await approach(cdp, card);

    const recording = await frames(page, () => trackpad(cdp, downFirstQuick.slice(0, 30), { at: card }), { tailMs: 100 });

    expect(recording.wheels.some((wheel) => wheel.prevented)).toBe(false);
    expect(pageTravel(recording)).toBeGreaterThan(100);
  });
});
