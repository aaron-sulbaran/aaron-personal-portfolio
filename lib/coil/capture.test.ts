import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import {
  armCapture,
  createCapture,
  decideWheel,
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

// The hero at the top of the page, ready, with the pointer on a card (where
// armedCapture left it), on empty background inside the helix silhouette, or
// outside the silhouette.
const onCoil: Omit<WheelFacts, "nowMs"> = { interactive: true, heroVisible: 1, onCard: true, insideSilhouette: true, x: 106, y: 100 };
const background: Omit<WheelFacts, "nowMs"> = { ...onCoil, onCard: false };
const offCoil: Omit<WheelFacts, "nowMs"> = { ...onCoil, onCard: false, insideSilhouette: false };

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
    expect(replay(downFirstQuick, () => offCoil).owners.every((owner) => owner === "page")).toBe(true);
    expect(replay(downFirstQuick, () => background).owners.every((owner) => owner === "page")).toBe(true);
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
        const facts = { ...(step.gesture === "card" ? onCoil : background), x: at[0], y: at[1] };
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

describe("continuation: things moving under a still pointer never change the next gesture's owner", () => {
  // A coil gesture on a card, then the wheel pauses past the gesture gap. A
  // spin stretches the helix, so the still pointer may now sit in a widened
  // seam (onCard false) while still inside the silhouette.
  function afterSpin() {
    const spin = replay(downFirstQuick, () => onCoil);
    expect(spin.state.owner).toBe("coil");
    return { state: spin.state, nextMs: spin.endMs + GAP + 100 };
  }
  const nextGesture = (state: CaptureState, startMs: number, facts = background) =>
    replay(notches, () => facts, { startMs, state }).owners;

  it("a coil gesture, a pause over the gap, a fresh gesture with no card under the still pointer: the coil's", () => {
    const { state, nextMs } = afterSpin();
    expect(nextGesture(state, nextMs).every((owner) => owner === "coil")).toBe(true);
    expect(state.held).toBe(true);
  });

  it("the same after a real move of rearmPx, with no card under the pointer: the page's", () => {
    const { state, nextMs } = afterSpin();
    const moved = pointerMoved(state, move(nextMs - 50, 106 + REARM, 100));
    expect(moved.held).toBe(false);
    expect(nextGesture(moved, nextMs).every((owner) => owner === "page")).toBe(true);
    // A move back onto a card: rule A decides, the coil's.
    expect(nextGesture(moved, nextMs, onCoil).every((owner) => owner === "coil")).toBe(true);
  });

  it("the same after a page scroll: the page's (it disarms too)", () => {
    const { state, nextMs } = afterSpin();
    const scrolled = pageScrolled(state, { nowMs: nextMs - 50, x: 106, y: 100 });
    expect(scrolled.held).toBe(false);
    expect(nextGesture(scrolled, nextMs).every((owner) => owner === "page")).toBe(true);
    expect(nextGesture(scrolled, nextMs, onCoil).every((owner) => owner === "page")).toBe(true);
  });

  it("jitter under rearmPx after the gesture keeps it; outside the silhouette it does not apply", () => {
    const { state, nextMs } = afterSpin();
    const jittered = pointerMoved(pointerMoved(state, move(nextMs - 80, 108, 101)), move(nextMs - 40, 104, 99));
    expect(jittered.held).toBe(true);
    expect(nextGesture(jittered, nextMs).every((owner) => owner === "coil")).toBe(true);
    expect(nextGesture(jittered, nextMs, offCoil).every((owner) => owner === "page")).toBe(true);
  });

  it("moves during the live coil gesture carry the mark: the pointer where the gesture left it", () => {
    // A mouse user sweeps the pointer across the helix while notching.
    const spin = replay(jitter, () => onCoil, {
      between: (index, nowMs, current) => (index === 40 ? pointerMoved(current, move(nowMs, 300, 220)) : current),
    });
    expect(spin.state.owner).toBe("coil");
    expect(spin.state.held).toBe(true);
    const still = pointerMoved(spin.state, move(spin.endMs + GAP + 20, 302, 221));
    expect(nextGesture(still, spin.endMs + GAP + 100, { ...background, x: 302, y: 221 }).every((owner) => owner === "coil")).toBe(true);
  });

  it("a coil gesture released to the page, or a page gesture, holds nothing", () => {
    const released = replay(jitter, () => onCoil, {
      between: (index, nowMs, current) => (index === 30 ? pointerMoved(current, move(nowMs, 600, 100, false)) : current),
    });
    expect(released.state.held).toBe(false);
    const back = pointerMoved(released.state, move(released.endMs + GAP + 10, 106, 100));
    expect(nextGesture(back, released.endMs + GAP + 100).every((owner) => owner === "page")).toBe(true);
    const { state, nextMs } = afterSpin();
    const page = replay(notches, () => ({ ...onCoil, heroVisible: 0.3 }), { startMs: nextMs, state });
    expect(page.state.owner).toBe("page");
    expect(page.state.held).toBe(false);
  });

  it("the hero turning non-interactive mid-gesture holds nothing", () => {
    const { state } = replay(downFirstQuick, (index) => ({ ...onCoil, interactive: index < 10 }));
    expect(state.held).toBe(false);
  });
});

describe("grace: the old hold lasts holdGraceMs, not forever", () => {
  it("a fresh gesture past the grace, with no card under the still pointer, is the page's", () => {
    const spin = replay(downFirstQuick, () => onCoil);
    const late = spin.endMs + COIL.capture.holdGraceMs + 10;
    const next = replay(notches, () => background, { startMs: late, state: spin.state });
    expect(next.owners.every((owner) => owner === "page")).toBe(true);
    // On a card it is still the coil's, grace or not.
    const onCard = replay(notches, () => onCoil, { startMs: late, state: spin.state });
    expect(onCard.owners.every((owner) => owner === "coil")).toBe(true);
  });
});

describe("the still-pointer budget: spin, then pass", () => {
  const BUDGET = COIL.capture.stillBudgetMs;
  const fling = downFirstQuick.slice(0, 25); // about 300 ms of wheel
  const slow: RecordedWheel[] = Array.from({ length: 40 }, (_, i) => [i * 16, 4]); // 4 px per 16 ms, 640 ms
  const notchRun: readonly RecordedWheel[] = notches.slice(0, 8);

  // Repeats `stream` with `pauseMs` between runs and the pointer resting on a
  // card; returns the owner of each run (all events of a run must agree).
  function runs(stream: readonly RecordedWheel[], count: number, pauseMs: number, between?: (run: number, nowMs: number, s: CaptureState) => CaptureState) {
    let state = armedCapture();
    let startMs = 1000;
    const owners: (string | null)[] = [];
    for (let run = 0; run < count; run += 1) {
      if (between) state = between(run, startMs - 1, state);
      const result = replay(stream, () => onCoil, { startMs, state });
      expect(new Set(result.owners).size).toBe(1);
      owners.push(result.owners[0]);
      state = result.state;
      startMs = result.endMs + pauseMs;
    }
    return owners;
  }
  const firstPage = (owners: (string | null)[]) => owners.indexOf("page");
  const restsOnPage = (owners: (string | null)[]) => owners.slice(firstPage(owners)).every((owner) => owner === "page");

  it("the first runs are the coil's: it takes the wheel the frame it unfurls", () => {
    expect(runs(fling, 1, 600)).toEqual(["coil"]);
  });

  it("repeated trackpad flings on a resting pointer reach the page once the budget is spent", () => {
    const owners = runs(fling, 12, 600);
    expect(firstPage(owners)).toBeGreaterThan(1);
    expect(firstPage(owners) * (fling[fling.length - 1][0])).toBeLessThanOrEqual(BUDGET + fling[fling.length - 1][0]);
    expect(restsOnPage(owners)).toBe(true);
  });

  it("a slow stream in bursts reaches the page after the budget", () => {
    const owners = runs(slow, 8, 400);
    expect(firstPage(owners)).toBeGreaterThan(0);
    expect(restsOnPage(owners)).toBe(true);
  });

  it("mouse notches in bursts reach the page after the budget", () => {
    const owners = runs(notchRun, 10, 700);
    expect(firstPage(owners)).toBeGreaterThan(0);
    expect(restsOnPage(owners)).toBe(true);
  });

  it("a spin with a moving pointer stays the coil's: a move of rearmPx restarts the count", () => {
    let side = 0;
    const owners = runs(fling, 20, 600, (_run, nowMs, state) => {
      side += 1;
      return pointerMoved(state, move(nowMs, 106 + side * (REARM + 2), 100));
    });
    expect(owners.every((owner) => owner === "coil")).toBe(true);
  });

  it("jitter under rearmPx does not restart the count", () => {
    const owners = runs(fling, 12, 600, (run, nowMs, state) => pointerMoved(state, move(nowMs, 106 + (run % 2) * 2, 100)));
    expect(firstPage(owners)).toBeGreaterThan(0);
  });

  it("never flips mid-gesture: one endless stream stays the coil's past the budget", () => {
    const endless: RecordedWheel[] = Array.from({ length: 400 }, (_, i) => [i * 16, 6]); // 6.4 s
    const { owners } = replay(endless, () => onCoil);
    expect(owners.every((owner) => owner === "coil")).toBe(true);
    // And the next fresh gesture is the page's.
    const state = replay(endless, () => onCoil).state;
    const after = replay(notchRun, () => onCoil, { startMs: 1000 + 6400 + 500, state });
    expect(after.owners.every((owner) => owner === "page")).toBe(true);
  });

  it("a page gesture never turns into the coil's mid-gesture, budget or not", () => {
    let state = armedCapture();
    state = { ...state, ownedMs: BUDGET };
    const page = replay(notchRun, () => onCoil, { startMs: 1000, state });
    expect(page.owners.every((owner) => owner === "page")).toBe(true);
    const lands = replay(notchRun, (index) => ({ ...onCoil, onCard: index > 3 }), { startMs: 1000, state: armedCapture() });
    expect(lands.owners.every((owner) => owner === "page")).toBe(true);
  });

  it("disarms when spent: a card under the still pointer stays the page's until the pointer moves", () => {
    const spent = { ...armedCapture(), ownedMs: BUDGET };
    const first = decideWheel(spent, { ...onCoil, nowMs: 5000 });
    expect(first.owner).toBe("page");
    expect(first.armed).toBe(false);
    // Cards sliding under the pointer, page scrolls: still the page's.
    const scrolled = pageScrolled(first, { nowMs: 5100, x: onCoil.x, y: onCoil.y });
    expect(decideWheel(scrolled, { ...onCoil, nowMs: 6000 }).owner).toBe("page");
    // A real move of rearmPx re-arms it and restarts the budget.
    const moved = pointerMoved(first, move(7000, onCoil.x + REARM, onCoil.y));
    expect(moved.ownedMs).toBe(0);
    expect(decideWheel(moved, { ...onCoil, nowMs: 7100 }).owner).toBe("coil");
  });

  it("counts the deal's handoff: a gesture the coil takes at the unfurl accrues like any other", () => {
    const parked = pageScrolled(pointerMoved(createCapture(), move(0, 400, 300)), { nowMs: 100, x: 400, y: 300 });
    let state = armCapture(parked);
    let startMs = 2000;
    const owners: (string | null)[] = [];
    for (let run = 0; run < 12; run += 1) {
      const result = replay(fling, () => ({ ...onCoil, x: 400, y: 300 }), { startMs, state });
      owners.push(result.owners[0]);
      state = result.state;
      startMs = result.endMs + 600;
    }
    expect(owners[0]).toBe("coil");
    expect(owners.indexOf("page")).toBeGreaterThan(0);
  });
});

describe("the Coil becomes the reader's (the deal's unfurl)", () => {
  // The deal scrolled the page itself, which disarmed capture, and the pointer
  // never moved: a reader who clicked Deal me in and left the mouse where it was.
  const afterDealScroll = () => pageScrolled(pointerMoved(createCapture(), move(0, 400, 300)), { nowMs: 100, x: 400, y: 300 });

  it("takes a fresh gesture that starts over a card at once, with no pointer move", () => {
    const parked = afterDealScroll();
    expect(parked.armed).toBe(false);
    // Without arming it is the page's, as ever.
    expect(decideWheel(parked, { ...onCoil, nowMs: 2000 }).owner).toBe("page");
    // Armed at the unfurl, the same gesture is the coil's from its first event.
    const armed = armCapture(parked);
    expect(armed.armed).toBe(true);
    const first = decideWheel(armed, { ...onCoil, nowMs: 2000 });
    expect(first.owner).toBe("coil");
    expect(gestureOwner(first, 2000 + 10)).toBe("coil");
  });

  it("takes it within 300 ms of the unfurl: nothing waits on a timer", () => {
    const unfurledAt = 5000;
    const armed = armCapture(afterDealScroll());
    expect(decideWheel(armed, { ...onCoil, nowMs: unfurledAt + 300 }).owner).toBe("coil");
    expect(decideWheel(armed, { ...onCoil, nowMs: unfurledAt + 1 }).owner).toBe("coil");
  });

  it("leaves a gesture that is already running as the page scroll it was", () => {
    const parked = afterDealScroll();
    // The reader was wheeling the page when the Coil unfurled under the pointer.
    const running = replay(downFirstQuick.slice(0, 12), () => onCoil, { startMs: 1000, state: parked });
    expect(running.owners.every((owner) => owner === "page")).toBe(true);
    const armed = armCapture(running.state);
    const events = downFirstQuick.slice(12, 30);
    const next = replay(events, () => onCoil, { startMs: running.endMs + 5, state: armed });
    expect(next.owners.every((owner) => owner === "page")).toBe(true);
  });

  it("is the page's after the gesture ends and the reader scrolls the page again: the next gesture waits for a pointer move", () => {
    const armed = armCapture(afterDealScroll());
    const scrolled = pageScrolled(armed, { nowMs: 3000, x: 400, y: 300 });
    expect(scrolled.armed).toBe(false);
    expect(decideWheel(scrolled, { ...onCoil, nowMs: 3500 }).owner).toBe("page");
  });

  it("changes nothing when capture is armed already, and never touches a held mark", () => {
    const state = armedCapture();
    expect(armCapture(state)).toBe(state);
    const held = decideWheel(state, { ...onCoil, nowMs: 2000 });
    expect(armCapture(held)).toBe(held);
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
