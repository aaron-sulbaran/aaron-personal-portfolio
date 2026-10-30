"use client";

import { msUntilDue, releaseDue, swallowsKey, type LockClock, type LockReason } from "@/lib/home/dealLockRules";

// The cutscene's lock: from the moment the deal starts (the reader's scroll
// past the trigger, or "Deal me in") until the Coil is unfurled, the page takes
// the reader's scroll input and the deal's own eased scroll carries the page to
// page 2's top (lib/home/dealMaster.ts). What it takes, and only this:
//   - wheel (not a pinch zoom, and not a sideways swipe, which scrolls nothing),
//   - touch moves,
//   - the scroll keys (lib/home/dealLockRules.ts swallowsKey), except in a text field.
// Tab, Escape, clicks and pointers are never touched. The input is swallowed in
// the capture phase at the window (preventDefault, and the scene never sees it), so
// by the time the Coil is unfurled and takes the wheel (docs/coil-input-model.md) no
// swallowed event has ever reached it: its first gesture is a fresh one.
//
// On a phone, where the browser's own momentum outlasts the finger and ignores
// preventDefault, <html data-deal-lock> also sets overflow hidden and touch-action
// none (app/globals.css, coarse pointers only: a desktop's scrollbar must never
// come or go, so a fine pointer's lock is the listeners alone). Programmatic
// scrolling still moves the page, which is what the deal's own scroll is.
//
// Letting go (lib/home/dealLockRules.ts): after the unfurl, once the reader's input
// has been quiet for about 120 ms, so the tail of the fling that started the deal
// never reaches the page; and, whatever else happened, capMs after the lock took
// input. The cap is a wall-clock timer of its own, not the deal's clock, so a scene
// that never starts, a stalled master, an error or a hidden tab cannot keep it.
// A tab that goes hidden lets go at once. One lock at a time: a second take lets the
// first go.

export type LockEnd = LockReason | "hidden" | "forced";

export type DealLock = {
  // The Coil is unfurled, or the deal ended without one: from here the quiet gap applies.
  unfurled: () => void;
  // Lets go now, whatever is going on. Idempotent.
  release: () => void;
};

const ATTRIBUTE = "data-deal-lock";
let active: DealLock | null = null;

// A text field (or anything editable) keeps its own arrows and space.
export function typesText(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement);
}

export function takeDealLock(onEnd?: (why: LockEnd) => void): DealLock {
  active?.release();
  const root = document.documentElement;
  const started = performance.now();
  const clock: LockClock = { takenAtMs: started, unfurledAtMs: null, lastInputMs: started };
  let timer = 0;
  let over = false;

  const end = (why: LockEnd) => {
    if (over) return;
    over = true;
    window.clearTimeout(timer);
    window.removeEventListener("wheel", onWheel, { capture: true });
    window.removeEventListener("touchmove", onTouchMove, { capture: true });
    window.removeEventListener("keydown", onKey, { capture: true });
    document.removeEventListener("visibilitychange", onVisibility);
    root.removeAttribute(ATTRIBUTE);
    if (active === lock) active = null;
    onEnd?.(why);
  };
  const check = () => {
    timer = 0;
    const due = releaseDue(clock, performance.now());
    if (due) end(due);
    else arm();
  };
  const arm = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(check, Math.max(1, msUntilDue(clock, performance.now())));
  };
  // A swallowed event is input: the quiet gap starts again.
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    clock.lastInputMs = performance.now();
    if (clock.unfurledAtMs !== null) arm();
  };
  const onWheel = (event: WheelEvent) => {
    // A pinch is the browser's zoom, and a purely sideways swipe scrolls nothing here (and is the history's).
    if (event.ctrlKey || event.deltaY === 0) return;
    swallow(event);
  };
  const onTouchMove = (event: TouchEvent) => {
    // A touch the browser has already taken as a scroll is no longer cancelable (the CSS holds those).
    if (event.cancelable) swallow(event);
    else {
      clock.lastInputMs = performance.now();
      if (clock.unfurledAtMs !== null) arm();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (swallowsKey(event) && !typesText(event.target)) swallow(event);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") end("hidden");
  };

  const lock: DealLock = {
    unfurled() {
      if (over) return;
      clock.unfurledAtMs ??= performance.now();
      check();
    },
    release: () => end("forced"),
  };
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
  window.addEventListener("keydown", onKey, { capture: true });
  document.addEventListener("visibilitychange", onVisibility);
  root.setAttribute(ATTRIBUTE, "");
  active = lock;
  arm();
  return lock;
}
