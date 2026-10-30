"use client";

import { wheelPixels } from "@/lib/coil/motion";
import { typesText } from "@/lib/home/dealLock";
import { swallowsKey } from "@/lib/home/dealLockRules";
import { scrollVelocity, type ScrollSample } from "@/lib/home/handScroll";
import { crossesTrigger, keyStepPx } from "@/lib/home/triggerGuardRules";

// The trigger's guard: within about a viewport above the deal's trigger (while the
// deal waits for the reader's scroll), the page decides on the reader's wheel,
// touch and scroll keys as they arrive, before the browser scrolls, instead of on
// the `scroll` event, which comes after the compositor has already moved the page
// (lib/home/triggerGuardRules.ts says why). The input that would carry the page
// to the trigger or past it starts the deal at once (`cross`) and is cancelled,
// so the deal's own scroll (the hand leg, lib/home/handScroll.ts) takes the page
// from where it is, at the input's speed. The cutscene's lock (lib/home/dealLock.ts)
// takes every input after it. Far from the trigger nothing is listening, so
// ordinary scrolling never waits on the page.
//
// The wheel near the trigger is the page's own to apply. Chromium decides whether
// a wheel can be cancelled once per gesture (a trackpad's swipe and its momentum,
// a burst of notches): if its first event is let through, every later one arrives
// uncancellable and the compositor scrolls it without waiting. So a wheel the
// guard does not cancel as the crossing one, it cancels and applies itself (an
// instant scroll by the same pixels), which keeps the whole gesture cancellable
// and every step of it under the guard's eye. A wheel the guard cannot cancel (a
// gesture that began before it was listening) still starts the deal the moment it
// would cross. A wheel that is not the page's (pinch zoom, a sideways swipe, an
// element under the pointer that scrolls that way itself, a page held by a modal
// or the Menu) is left alone.
//
// Touch is the browser's own: a finger's scroll and its momentum stay native (the
// page could not replay a fling). Chromium lets a touch move be cancelled only
// before the browser has taken the touch as a scroll, so the crossing move is
// cancelled when it can be, and the deal starts on it either way; on a phone the
// lock's CSS holds the rest (app/globals.css, data-deal-lock).
//
// Keys always reach the page before the browser scrolls: the key that would cross
// starts the deal and is cancelled. Space on a button presses it, and a text
// field keeps its keys.

export type TriggerGuard = {
  // Listens with the trigger at this scroll position, px; null stops listening.
  set: (triggerY: number | null) => void;
  detach: () => void;
};

// `cross` starts the deal for the input that would carry the page past the
// trigger, at that input's speed down the page (px/s; undefined: the page's own),
// and says whether the cutscene took the page (the input is then cancelled).
export function attachTriggerGuard(cross: (velocity?: number) => boolean): TriggerGuard {
  let triggerY: number | null = null;
  let listening = false;
  // The reader's travel down the page by input (wheel pixels, finger pixels), by event time: its speed.
  let travel = 0;
  const steps: ScrollSample[] = [];
  let fingerY: number | null = null;

  const note = (atMs: number, stepPx: number) => {
    travel += stepPx;
    steps.push({ t: atMs, y: travel });
    if (steps.length > 12) steps.shift();
  };

  const onWheel = (event: WheelEvent) => {
    if (triggerY === null || event.ctrlKey || event.defaultPrevented) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const step = wheelPixels(0, event.deltaY, event.deltaMode, window.innerHeight);
    if (step === 0 || notThePages(event.target, step)) return;
    const y = window.scrollY;
    note(event.timeStamp, step);
    if (crossesTrigger(y, step, triggerY) && cross(scrollVelocity(steps, event.timeStamp))) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (!event.cancelable) return;
    event.preventDefault();
    const most = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.min(Math.max(0, y + step), most), behavior: "instant" });
  };

  const onTouchStart = (event: TouchEvent) => {
    fingerY = event.touches.length === 1 ? event.touches[0].clientY : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (triggerY === null || event.touches.length !== 1) return;
    const now = event.touches[0].clientY;
    const was = fingerY;
    fingerY = now;
    if (was === null) return;
    // The finger going up the screen takes the page down it.
    const step = was - now;
    note(event.timeStamp, step);
    if (step <= 0 || notThePages(event.target, step)) return;
    if (crossesTrigger(window.scrollY, step, triggerY) && cross(scrollVelocity(steps, event.timeStamp)) && event.cancelable) event.preventDefault();
  };

  const onKey = (event: KeyboardEvent) => {
    if (triggerY === null || event.defaultPrevented || !swallowsKey(event) || typesText(event.target)) return;
    // Space on a button (or anything that acts as one) presses it rather than scrolling.
    if ((event.key === " " || event.key === "Spacebar") && pressable(event.target)) return;
    const step = keyStepPx(event.key, event.shiftKey, window.innerHeight);
    if (step <= 0 || notThePages(event.target, step)) return;
    if (crossesTrigger(window.scrollY, step, triggerY) && cross()) event.preventDefault();
  };

  // Capture at the window, ahead of the page's own listeners; the wheel and the
  // touch move must not be passive, or the browser scrolls without waiting for them.
  const holding = { capture: true, passive: false } as const;
  const watching = { capture: true, passive: true } as const;
  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) {
      window.addEventListener("wheel", onWheel, holding);
      window.addEventListener("touchstart", onTouchStart, watching);
      window.addEventListener("touchmove", onTouchMove, holding);
      window.addEventListener("keydown", onKey, { capture: true });
      return;
    }
    window.removeEventListener("wheel", onWheel, holding);
    window.removeEventListener("touchstart", onTouchStart, watching);
    window.removeEventListener("touchmove", onTouchMove, holding);
    window.removeEventListener("keydown", onKey, { capture: true });
    fingerY = null;
  };

  return {
    set(at) {
      triggerY = at;
      listen(at !== null);
    },
    detach() {
      triggerY = null;
      listen(false);
    },
  };
}

// Whether the input belongs to something other than the page's own scroll: the
// page cannot scroll now (a modal or the Menu holds it with overflow hidden), or
// an element under the pointer or in focus scrolls that way itself.
function notThePages(target: EventTarget | null, stepPx: number): boolean {
  const root = document.documentElement;
  const body = document.body;
  for (const el of [root, body]) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === "hidden" || overflow === "clip") return true;
  }
  for (let node = target instanceof Element ? target : null; node && node !== root && node !== body; node = node.parentElement) {
    if (node.scrollHeight <= node.clientHeight + 1) continue;
    const overflow = getComputedStyle(node).overflowY;
    if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") continue;
    const room = stepPx > 0 ? node.scrollHeight - node.clientHeight - node.scrollTop : node.scrollTop;
    if (room > 1) return true;
  }
  return false;
}

function pressable(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("button, summary, [role='button'], [role='checkbox'], [role='switch'], [role='menuitem'], [role='tab'], [role='option']");
}
