import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  createCapture,
  decideWheel,
  feedsPageScroll,
  gestureOwner,
  heroVisibleFraction,
  nudgeShown,
  pointerMoved,
  type CaptureState,
  type WheelFacts,
} from "@/lib/coil/capture";
import {
  downAt200,
  downFirstQuick,
  jitter,
  notches,
  pageThenCoil,
  upQuick,
  type RecordedWheel,
} from "@/lib/coil/capture.fixtures";

const GAP = COIL.capture.gestureGapMs;

// The hero at the top of the page, ready, with the pointer inside the helix.
const onCoil: Omit<WheelFacts, "nowMs"> = { interactive: true, heroVisible: 1, insideSilhouette: true };
const offCoil: Omit<WheelFacts, "nowMs"> = { ...onCoil, insideSilhouette: false };

// Replays a recorded stream from `startMs`; `facts` may vary per event, and
// `between` runs before each event (pointer moves). Returns every owner.
function replay(
  stream: readonly RecordedWheel[],
  facts: (index: number) => Omit<WheelFacts, "nowMs">,
  { startMs = 1000, state = createCapture(), between }: {
    startMs?: number;
    state?: CaptureState;
    between?: (index: number, nowMs: number, state: CaptureState) => CaptureState;
  } = {},
) {
  let current = state;
  const owners = stream.map(([at], index) => {
    const nowMs = startMs + at;
    if (between) current = between(index, nowMs, current);
    current = decideWheel(current, { ...facts(index), nowMs });
    return current.owner;
  });
  return { owners, state: current, endMs: startMs + stream[stream.length - 1][0] };
}

describe("gesture ownership", () => {
  it("gives a downward-first gesture over the helix to the coil from its first event, no hover intent", () => {
    const { owners } = replay(downFirstQuick, () => onCoil);
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("gives an upward gesture the coil from its first event", () => {
    const { owners } = replay(upQuick, () => onCoil);
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("captures at any page scroll that leaves the hero at least half in view", () => {
    // Scrolled 200px on a 900px hero: 78 percent in view.
    const visible = heroVisibleFraction(-200, 900, 900);
    expect(visible).toBeCloseTo(700 / 900, 5);
    const { owners } = replay(downAt200, () => ({ ...onCoil, heroVisible: visible }));
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("leaves a hero under half in view to the page", () => {
    const visible = heroVisibleFraction(-500, 900, 900);
    expect(visible).toBeLessThan(0.5);
    const { owners } = replay(downAt200, () => ({ ...onCoil, heroVisible: visible }));
    expect(owners.every((owner) => owner === "page")).toBe(true);
  });

  it("decides by the silhouette, so a gap between cards under the pointer still captures", () => {
    // The rule never asks whether a card is under the pointer: a gap inside
    // the hull is inside the silhouette.
    const { owners } = replay(downFirstQuick, () => onCoil);
    expect(new Set(owners)).toEqual(new Set(["coil"]));
  });

  it("gives a gesture starting outside the silhouette to the page", () => {
    const { owners } = replay(downFirstQuick, () => offCoil);
    expect(owners.every((owner) => owner === "page")).toBe(true);
  });

  it("holds the coil through pointer jitter inside the silhouette and cards passing under a still pointer", () => {
    // Every other event, a 1 to 3px pointer move that stays inside the hull.
    const { owners } = replay(jitter, () => onCoil, {
      between: (index, nowMs, state) =>
        index % 2 === 0 ? pointerMoved(state, { nowMs, insideSilhouette: true }) : state,
    });
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("releases to the page only when the pointer itself moves outside, for the rest of that gesture", () => {
    const leaveAt = 40;
    const { owners } = replay(jitter, () => onCoil, {
      between: (index, nowMs, state) =>
        index === leaveAt ? pointerMoved(state, { nowMs, insideSilhouette: false }) : state,
    });
    expect(owners.slice(0, leaveAt).every((owner) => owner === "coil")).toBe(true);
    // Back inside the hull mid-gesture does not take it back either.
    expect(owners.slice(leaveAt).every((owner) => owner === "page")).toBe(true);
  });

  it("never converts a page gesture to the coil mid-gesture, even when the pointer lands on the helix", () => {
    const moveAt = 20;
    const { owners } = replay(pageThenCoil, (index) => (index < moveAt ? offCoil : onCoil), {
      between: (index, nowMs, state) =>
        index === moveAt ? pointerMoved(state, { nowMs, insideSilhouette: true }) : state,
    });
    expect(owners.every((owner) => owner === "page")).toBe(true);
  });

  it("decides again at the next gesture, once the wheel has paused for the gesture gap", () => {
    const first = replay(pageThenCoil, () => offCoil);
    const second = replay(downFirstQuick, () => onCoil, { startMs: first.endMs + GAP, state: first.state });
    expect(second.owners.every((owner) => owner === "coil")).toBe(true);
    // Just inside the gap, it is still the same (page) gesture.
    const same = replay(downFirstQuick, () => onCoil, { startMs: first.endMs + GAP - 1, state: first.state });
    expect(same.owners[0]).toBe("page");
  });

  it("keeps mouse notches a fast flick apart in one gesture", () => {
    const { owners } = replay(notches, () => onCoil);
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("gives everything to the page while the hero is not interactive", () => {
    const { owners } = replay(downFirstQuick, () => ({ ...onCoil, interactive: false }));
    expect(owners.every((owner) => owner === "page")).toBe(true);
  });

  it("hands a coil gesture to the page when the hero stops being interactive mid-gesture", () => {
    const { owners } = replay(downFirstQuick, (index) => ({ ...onCoil, interactive: index < 10 }));
    expect(owners.slice(0, 10).every((owner) => owner === "coil")).toBe(true);
    expect(owners.slice(10).every((owner) => owner === "page")).toBe(true);
  });

  it("reports no live owner once the gesture has ended", () => {
    const { state, endMs } = replay(downFirstQuick, () => onCoil);
    expect(gestureOwner(state, endMs + GAP - 1)).toBe("coil");
    expect(gestureOwner(state, endMs + GAP)).toBe(null);
    // A pointer move after the gesture ended changes nothing about the next one.
    const moved = pointerMoved(state, { nowMs: endMs + GAP + 10, insideSilhouette: false });
    expect(gestureOwner(moved, endMs + GAP + 10)).toBe(null);
  });
});

describe("page scroll feed", () => {
  it("turns the coil with page scroll except during a coil gesture", () => {
    const idle = createCapture();
    expect(feedsPageScroll(idle, 0)).toBe(true); // keyboard and scrollbar scrolling
    const page = decideWheel(idle, { ...offCoil, nowMs: 100 });
    expect(feedsPageScroll(page, 120)).toBe(true);
    const coil = decideWheel(idle, { ...onCoil, nowMs: 100 });
    expect(feedsPageScroll(coil, 120)).toBe(false);
    expect(feedsPageScroll(coil, 100 + GAP)).toBe(true);
  });
});

describe("nudge", () => {
  // A steady trackpad stream at 90 events per second for `ms`.
  const steady = (ms: number): RecordedWheel[] =>
    Array.from({ length: Math.floor((ms * 90) / 1000) }, (_, i) => [Math.round((i * 1000) / 90), 20] as const);

  it("shows only once a coil gesture has been held for the nudge delay", () => {
    const after = COIL.capture.nudgeAfterMs;
    const { state } = replay(steady(after + 400), () => onCoil, { startMs: 0 });
    expect(nudgeShown(state, after - 20)).toBe(false);
    expect(nudgeShown(state, after + 10)).toBe(true);
  });

  it("hides the instant the gesture ends or the coil lets go", () => {
    const after = COIL.capture.nudgeAfterMs;
    const { state, endMs } = replay(steady(after + 400), () => onCoil, { startMs: 0 });
    expect(nudgeShown(state, endMs + 1)).toBe(true);
    expect(nudgeShown(state, endMs + GAP)).toBe(false);
    const released = pointerMoved(state, { nowMs: endMs + 5, insideSilhouette: false });
    expect(nudgeShown(released, endMs + 6)).toBe(false);
  });

  it("never shows for a page gesture", () => {
    const { state, endMs } = replay(steady(4000), () => offCoil, { startMs: 0 });
    expect(nudgeShown(state, endMs)).toBe(false);
  });
});

describe("hero visibility", () => {
  it("is the fraction of the hero's height inside the viewport", () => {
    expect(heroVisibleFraction(0, 900, 900)).toBe(1);
    expect(heroVisibleFraction(-450, 900, 900)).toBe(0.5);
    expect(heroVisibleFraction(-900, 900, 900)).toBe(0);
    expect(heroVisibleFraction(300, 900, 900)).toBeCloseTo(600 / 900, 5);
    expect(heroVisibleFraction(0, 0, 900)).toBe(0);
  });
});
