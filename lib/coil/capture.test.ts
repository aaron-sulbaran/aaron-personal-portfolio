import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  createCapture,
  decideWheel,
  feedsPageScroll,
  gestureOwner,
  heroVisibleFraction,
  nudgeShown,
  pageScrolled,
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
const REARM = COIL.capture.rearmPx;

// The hero at the top of the page, ready, with the pointer on a card.
const onCoil: Omit<WheelFacts, "nowMs"> = { interactive: true, heroVisible: 1, onCard: true };
const offCoil: Omit<WheelFacts, "nowMs"> = { ...onCoil, onCard: false };

// A pointer move to (x, y), inside or outside the helix silhouette.
const move = (nowMs: number, x: number, y: number, insideSilhouette = true) => ({ nowMs, insideSilhouette, x, y });

// Capture after the visitor has reached for the coil: first seen at
// (100, 100), then a real move of rearmPx.
function armedCapture() {
  return pointerMoved(pointerMoved(createCapture(), move(0, 100, 100)), move(10, 100 + REARM, 100));
}

// Replays a recorded stream from `startMs`; `facts` may vary per event, and
// `between` runs before each event (pointer moves). Returns every owner.
function replay(
  stream: readonly RecordedWheel[],
  facts: (index: number) => Omit<WheelFacts, "nowMs">,
  { startMs = 1000, state = armedCapture(), between }: {
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

  it("gives a gesture starting away from every card to the page, empty background inside the helix included", () => {
    // onCard is rule A (lib/coil/geometry.ts nearCard): on a card or in the
    // seam between two. Background between turns of the helix is not.
    const { owners } = replay(downFirstQuick, () => offCoil);
    expect(owners.every((owner) => owner === "page")).toBe(true);
  });

  it("holds the coil through pointer jitter inside the silhouette and cards passing under a still pointer", () => {
    // Every other event, a 1 to 3px pointer move that stays inside the hull.
    const { owners } = replay(jitter, () => onCoil, {
      between: (index, nowMs, state) =>
        index % 2 === 0 ? pointerMoved(state, move(nowMs, 100 + (index % 3), 100)) : state,
    });
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("releases to the page only when the pointer itself moves outside, for the rest of that gesture", () => {
    const leaveAt = 40;
    const { owners } = replay(jitter, () => onCoil, {
      between: (index, nowMs, state) =>
        index === leaveAt ? pointerMoved(state, move(nowMs, 400, 100, false)) : state,
    });
    expect(owners.slice(0, leaveAt).every((owner) => owner === "coil")).toBe(true);
    // Back inside the hull mid-gesture does not take it back either.
    expect(owners.slice(leaveAt).every((owner) => owner === "page")).toBe(true);
  });

  it("never converts a page gesture to the coil mid-gesture, even when the pointer lands on the helix", () => {
    const moveAt = 20;
    const { owners } = replay(pageThenCoil, (index) => (index < moveAt ? offCoil : onCoil), {
      between: (index, nowMs, state) =>
        index === moveAt ? pointerMoved(state, move(nowMs, 200, 100)) : state,
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

  it("releases on a real move outside the silhouette only, never on a move over a gap inside it", () => {
    // Rule A narrows where a gesture may start; release stays the hull.
    const { owners } = replay(jitter, () => onCoil, {
      between: (index, nowMs, state) => (index === 20 ? pointerMoved(state, move(nowMs, 260, 140, true)) : state),
    });
    expect(owners.every((owner) => owner === "coil")).toBe(true);
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
    const moved = pointerMoved(state, move(endMs + GAP + 10, 400, 100, false));
    expect(gestureOwner(moved, endMs + GAP + 10)).toBe(null);
  });
});

describe("arming: the page sliding the coil under a still pointer never arms it", () => {
  type Step =
    | { move: [number, number] }
    | { scroll: [number, number] } // the page scrolled with the pointer at (x, y) (NaN: never seen)
    | { gesture: "card" | "background" };

  // Runs the steps 400ms apart (each wheel gesture its own) and returns the
  // owner of every gesture and whether capture ended armed.
  function run(steps: readonly Step[], state = createCapture()) {
    let current = state;
    let nowMs = 1000;
    let at: [number, number] = [Number.NaN, Number.NaN];
    const owners: (string | null)[] = [];
    for (const step of steps) {
      nowMs += 400;
      if ("move" in step) {
        at = step.move;
        current = pointerMoved(current, move(nowMs, ...step.move));
      }
      else if ("scroll" in step) current = pageScrolled(current, { nowMs, x: step.scroll[0], y: step.scroll[1] });
      else {
        const facts = step.gesture === "card" ? onCoil : offCoil;
        current = replay(downFirstQuick.slice(0, 20), () => facts, { startMs: nowMs, state: current }).state;
        owners.push(current.owner);
        // A page gesture scrolls the page under the still pointer.
        if (current.owner === "page") current = pageScrolled(current, { nowMs: nowMs + 300, x: at[0], y: at[1] });
        nowMs += 300;
      }
    }
    return { owners, armed: current.armed, state: current };
  }

  const NaN2: [number, number] = [Number.NaN, Number.NaN];
  const table: { name: string; steps: Step[]; owners: string[]; armed: boolean }[] = [
    { name: "not armed at load: a wheel over a card with no pointer move scrolls the page", steps: [{ gesture: "card" }], owners: ["page"], armed: false },
    { name: "the first move only marks where the pointer is", steps: [{ move: [100, 100] }, { gesture: "card" }], owners: ["page"], armed: false },
    { name: "a move of rearmPx from where it was first seen arms", steps: [{ move: [100, 100] }, { move: [100, 100 + REARM] }, { gesture: "card" }], owners: ["coil"], armed: true },
    { name: "jitter under rearmPx never arms", steps: [{ move: [100, 100] }, { move: [102, 101] }, { move: [99, 102] }, { move: [100 + REARM - 1, 100] }, { gesture: "card" }], owners: ["page"], armed: false },
    { name: "armed, background: rule A still gives the page", steps: [{ move: [100, 100] }, { move: [140, 120] }, { gesture: "background" }], owners: ["page"], armed: false },
    {
      name: "the trap: a page gesture slides a card under the still pointer; the next gesture is the page's",
      steps: [{ move: [100, 100] }, { move: [140, 120] }, { gesture: "background" }, { gesture: "card" }, { gesture: "card" }],
      owners: ["page", "page", "page"],
      armed: false,
    },
    {
      name: "after the trap, a real move of rearmPx arms again and the next gesture is the coil's",
      steps: [{ move: [100, 100] }, { move: [140, 120] }, { scroll: [140, 120] }, { gesture: "card" }, { move: [140 + REARM, 120] }, { gesture: "card" }],
      owners: ["page", "coil"],
      armed: true,
    },
    {
      name: "re-arming is measured from where the page scrolled, not from the last move",
      steps: [{ move: [100, 100] }, { move: [140, 120] }, { scroll: [140, 120] }, { move: [144, 120] }, { move: [136, 120] }, { gesture: "card" }, { move: [146, 120] }, { gesture: "card" }],
      owners: ["page", "coil"],
      armed: true,
    },
    {
      name: "keyboard, scrollbar or an anchor jump between gestures disarms",
      steps: [{ move: [100, 100] }, { move: [140, 120] }, { scroll: [140, 120] }, { gesture: "card" }],
      owners: ["page"],
      armed: false,
    },
    {
      name: "a scroll before the pointer is ever seen: its first sighting is the mark",
      steps: [{ scroll: NaN2 }, { move: [300, 300] }, { gesture: "card" }, { move: [300 + REARM, 300] }, { gesture: "card" }],
      owners: ["page", "coil"],
      armed: true,
    },
  ];

  for (const row of table) {
    it(row.name, () => {
      const { owners, armed } = run(row.steps);
      expect(owners).toEqual(row.owners);
      expect(armed).toBe(row.armed);
    });
  }

  it("a coil gesture never disarms, even if the page moves under it", () => {
    const { state, endMs } = replay(downFirstQuick, () => onCoil);
    expect(state.owner).toBe("coil");
    const scrolled = pageScrolled(state, { nowMs: endMs + 10, x: 106, y: 100 });
    expect(scrolled.armed).toBe(true);
    // The next gesture is the coil's again.
    const next = replay(downFirstQuick, () => onCoil, { startMs: endMs + GAP + 50, state: scrolled });
    expect(next.owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("disarms during a page gesture that the pointer released from the coil", () => {
    const leaveAt = 20;
    const { state, endMs } = replay(jitter, () => onCoil, {
      between: (index, nowMs, current) => (index === leaveAt ? pointerMoved(current, move(nowMs, 600, 100, false)) : current),
    });
    expect(state.owner).toBe("page");
    expect(pageScrolled(state, { nowMs: endMs, x: 600, y: 100 }).armed).toBe(false);
  });

  it("returns the same state when nothing changes", () => {
    const fresh = createCapture();
    const seen = pointerMoved(fresh, move(0, 50, 50));
    expect(pointerMoved(seen, move(1, 52, 50))).toBe(seen);
    const disarmed = pageScrolled(armedCapture(), { nowMs: 5, x: 50, y: 50 });
    expect(pageScrolled(disarmed, { nowMs: 6, x: 50, y: 50 })).toBe(disarmed);
  });
});

describe("page scroll feed", () => {
  it("turns the coil with page scroll except during a coil gesture", () => {
    const idle = armedCapture();
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
    const released = pointerMoved(state, move(endMs + 5, 400, 100, false));
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
