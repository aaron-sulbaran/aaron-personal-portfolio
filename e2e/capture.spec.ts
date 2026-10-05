import { downAt200, downFirstQuick, jitter, notches, upQuick, type RecordedWheel } from "@/lib/coil/capture.fixtures";
import { COIL } from "@/lib/coil/constants";
import { test, expect } from "./support/fixtures";
import {
  captureAt,
  cardAt,
  coilPoints,
  heroVisible,
  openHome,
  scrollToY,
  silhouetteDistance,
  waitForCoilSettled,
  waitForEnvelopeRest,
  waitForGestureEnd,
  type Point,
} from "./support/coil";
import { frames, offsetTravel, pageTravel, type Recording } from "./support/frames";
import { approach, firstPixels, pointerJitter, pointerTo, trackpad } from "./support/input";

// Wheel capture (docs/coil-input-model.md section 3): a gesture is the coil's
// when it starts with the pointer on a card (or in the seam between two), the
// pointer has really moved since the page last scrolled, and the hero is at
// least half in view; it spins the coil from its first event, both
// directions, and the page does not move. Empty background inside the helix
// belongs to the page. These replay recorded Chrome wheel streams through
// the DevTools input pipeline, the path the unit tests and the old gate never
// exercised.

function expectCoilOwnedAll(recording: Recording, direction: 1 | -1) {
  const { wheels } = recording;
  expect(wheels.length, "wheel events reached the page").toBeGreaterThan(10);
  expect(wheels.filter((wheel) => !wheel.prevented).length, "events the coil left to the page").toBe(0);
  expect(pageTravel(recording), "page movement, px").toBe(0);
  // A stream of a few hundred px turns the coil by more than a card, in the wheel's direction.
  expect(offsetTravel(recording) * direction, "coil travel, cards").toBeGreaterThan(1);
}

function expectPageOwnedAll(recording: Recording, minTravel = 100) {
  expect(recording.wheels.length, "wheel events reached the page").toBeGreaterThan(0);
  expect(recording.wheels.filter((wheel) => wheel.prevented).length, "events the coil took").toBe(0);
  expect(recording.rows.some((row) => row.owner === "coil"), "frames the coil owned").toBe(false);
  expect(pageTravel(recording), "page movement, px").toBeGreaterThan(minTravel);
}

// The total travel of a stream, px.
const travelOf = (stream: readonly RecordedWheel[]) => stream.reduce((sum, [, deltaY]) => sum + deltaY, 0);

test.describe("capture: a gesture over the coil spins it and holds the page still", () => {
  const cases: { name: string; stream: readonly RecordedWheel[]; direction: 1 | -1; where: "card" | "seam"; scrollY: number }[] = [
    { name: "trackpad down from a card at the top", stream: downFirstQuick, direction: 1, where: "card", scrollY: 0 },
    { name: "trackpad up from a card at the top", stream: upQuick, direction: -1, where: "card", scrollY: 0 },
    { name: "trackpad down from the seam between two adjacent cards", stream: downFirstQuick, direction: 1, where: "seam", scrollY: 0 },
    { name: "trackpad down from a card with the page at 200px", stream: downAt200, direction: 1, where: "card", scrollY: 200 },
    { name: "trackpad up from a card with the page at 200px", stream: upQuick, direction: -1, where: "card", scrollY: 200 },
    { name: "mouse wheel notches from a card", stream: notches, direction: 1, where: "card", scrollY: 0 },
  ];

  for (const scenario of cases) {
    test(scenario.name, async ({ page, cdp }) => {
      await openHome(page);
      if (scenario.scrollY) await scrollToY(page, scenario.scrollY);
      const points = await coilPoints(page);
      const point = points[scenario.where];
      expect(point, `a ${scenario.where} point on the hero`).toBeTruthy();
      if (scenario.where === "seam") {
        expect(await cardAt(page, point!), "a card under the seam point").toBeNull();
      }
      await approach(cdp, point!);
      const probe = await captureAt(page, point!);
      if (probe) expect(probe, "rule A holds and capture is armed").toMatchObject({ onCard: true, armed: true });

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

test.describe("capture: empty background belongs to the page", () => {
  test("a gesture from empty background inside the helix silhouette scrolls the page", async ({ page, cdp }) => {
    await openHome(page);
    const { background } = await coilPoints(page);
    expect(background, "a background point inside the silhouette").toBeTruthy();
    expect(await silhouetteDistance(page, background!), "silhouette distance, px").toBeLessThan(-40);
    await approach(cdp, background!);
    const probe = await captureAt(page, background!);
    if (probe) expect(probe, "inside the old hull, armed, but no card near").toMatchObject({ onCard: false, insideSilhouette: true, armed: true });

    const recording = await frames(page, () => trackpad(cdp, firstPixels(downFirstQuick, 300), { at: background! }), { tailMs: 120 });

    expectPageOwnedAll(recording);
  });

  test.describe("at Aaron's window, dark theme", () => {
    test.use({ viewport: { width: 1485, height: 927 }, colorScheme: "dark" });

    // The two background spots of the 2026-10-05 hardware report, as
    // fractions of the window, with the coil at rest at the top of the page.
    for (const [fx, fy] of [
      [0.1, 0.77],
      [0.92, 0.37],
    ] as const) {
      test(`a gesture from (${fx}, ${fy}) of the window scrolls the page`, async ({ page, cdp }) => {
        await openHome(page);
        const point = { x: Math.round(fx * 1485), y: Math.round(fy * 927) };
        expect(await cardAt(page, point)).toBeNull();
        await approach(cdp, point);
        const probe = await captureAt(page, point);
        if (probe) expect(probe).toMatchObject({ onCard: false, armed: true });

        const recording = await frames(page, () => trackpad(cdp, firstPixels(downFirstQuick, 200), { at: point }), { tailMs: 120 });

        expectPageOwnedAll(recording);
      });
    }
  });
});

test.describe("capture: the page sliding the coil under a still pointer never arms it", () => {
  test("a fresh load with no pointer move: a wheel over a card scrolls the page", async ({ page, cdp }) => {
    await openHome(page);
    const { card } = await coilPoints(page);
    const probe = await captureAt(page, card);
    if (probe) expect(probe, "a card under the point, capture not armed").toMatchObject({ onCard: true, armed: false });

    const recording = await frames(page, () => trackpad(cdp, firstPixels(downFirstQuick, 200), { at: card }), { tailMs: 120 });

    expectPageOwnedAll(recording);
  });

  test("the trap: a card slid under the still pointer stays the page's until the pointer really moves", async ({ page, cdp }) => {
    await openHome(page);
    // The page gesture: the first events of a recorded stream, so its travel is known exactly.
    const viewportHeight = page.viewportSize()!.height;
    const prefixes = Array.from({ length: downFirstQuick.length }, (_, n) => downFirstQuick.slice(0, n + 1)).filter(
      (stream) => travelOf(stream) >= 120 && travelOf(stream) <= 0.4 * viewportHeight,
    );
    const travels = prefixes.map(travelOf);
    // A card point C and a travel S such that the pointer P = C - (0, S) sits
    // outside the silhouette now. The page gesture moves the hero up by S, so
    // P ends over the same point of the helix that C is over now: the band of
    // cards along the helix does not change as the coil turns, so P ends on a
    // card or in the seam between two, and inside the silhouette.
    const plan = await page.evaluate((travels) => {
      const coil = (window as unknown as { __coil: { silhouette: () => { ax: number; ay: number; dx: number; dy: number; half: number }; api: { cardAt: (x: number, y: number) => { slot: number } | null } } }).__coil;
      const sil = coil.silhouette();
      const rect = document.querySelector("section[data-scene]")!.getBoundingClientRect();
      const outsideBy = (x: number, y: number) => Math.abs((x - rect.left - sil.ax) * -sil.dy + (y - rect.top - sil.ay) * sil.dx) - sil.half;
      for (let y = 120; y < window.innerHeight - 60; y += 10) {
        for (let x = 100; x < window.innerWidth - 100; x += 10) {
          const hit = coil.api.cardAt(x, y);
          if (!hit || ![[-24, 0], [24, 0], [0, -24], [0, 24]].every(([dx, dy]) => coil.api.cardAt(x + dx, y + dy)?.slot === hit.slot)) continue;
          const travel = travels.find((s) => y - s >= 100 && outsideBy(x, y - s) > 30);
          if (travel !== undefined) return { card: { x, y }, travel };
        }
      }
      return null;
    }, travels);
    expect(plan, "a card point the page can slide under a pointer outside the hull").toBeTruthy();
    const pointer = { x: plan!.card.x, y: plan!.card.y - plan!.travel };
    const pageGesture = prefixes[travels.indexOf(plan!.travel)];
    await approach(cdp, pointer);

    const first = await frames(page, () => trackpad(cdp, pageGesture, { at: pointer }), { tailMs: 150 });

    expectPageOwnedAll(first, plan!.travel - 1);
    await waitForGestureEnd(page);
    await waitForCoilSettled(page);
    await waitForEnvelopeRest(page);
    // The precondition: the still pointer is now over the helix, with the hero over half in view.
    expect(await silhouetteDistance(page, pointer), "pointer to silhouette, px").toBeLessThan(0);
    expect(await heroVisible(page)).toBeGreaterThanOrEqual(0.5);
    const slid = await captureAt(page, pointer);
    if (slid) expect(slid, "a card under the still pointer, capture disarmed").toMatchObject({ onCard: true, armed: false });

    // A second gesture, the pointer still where it was: the page's.
    const second = await frames(page, () => trackpad(cdp, firstPixels(upQuick, 80), { at: pointer }), { tailMs: 150 });

    expectPageOwnedAll(second, 50);
    await waitForGestureEnd(page);
    expect(await heroVisible(page)).toBeGreaterThanOrEqual(0.5);

    // A real move onto a card arms it: the next gesture is the coil's.
    const { card } = await coilPoints(page);
    expect(Math.hypot(card.x - pointer.x, card.y - pointer.y), "the move, px").toBeGreaterThanOrEqual(COIL.capture.rearmPx);
    await pointerTo(cdp, card);
    const armed = await captureAt(page, card);
    if (armed) expect(armed).toMatchObject({ onCard: true, armed: true });

    const third = await frames(page, () => trackpad(cdp, downFirstQuick.slice(0, 30), { at: card }), { tailMs: 100 });

    expect(third.wheels.every((wheel) => wheel.prevented), "the third gesture's events").toBe(true);
    expect(pageTravel(third)).toBe(0);
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
