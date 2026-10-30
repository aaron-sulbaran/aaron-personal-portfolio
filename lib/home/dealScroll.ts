import type { gsap as Gsap } from "gsap";
import { gsap } from "@/lib/gsap";
import type { HandPlan } from "@/lib/home/handScroll";

// The deal's scroll: the page scrolls itself from where the reader is to the
// top of the cards section, as one child of the deal's master timeline. In the
// cutscene (a click or the reader's own scroll with the scene drawing) nothing the
// reader does can take it back: the lock holds their input for the deal's length
// (lib/home/dealLock.ts), the click's leg is not autoKill-ed, and the hand path's
// leg (addHandScroll) takes over at the page's own speed. Without the cutscene
// (no scene, the fallback click path) the reader's own wheel, touch or key takes
// the scroll back (ScrollToPlugin's autoKill, which kills only this child, never the
// deal). Reduced motion jumps.
const SPEED_PX_PER_S = 1800;
const MIN_S = 0.6;
const MAX_S = 1.4;

export function dealScrollSeconds(distancePx: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.min(MAX_S, Math.max(MIN_S, Math.abs(distancePx) / SPEED_PX_PER_S));
}

export function cardsTop(): number | null {
  const section = document.getElementById("work");
  return section ? section.getBoundingClientRect().top + window.scrollY : null;
}

// The page's CSS smooths every scroll (scroll-behavior: smooth), which would
// smooth each of the tween's own steps and stall it, so the root is set to
// auto for the tween's life and put back however it ends. onEnd runs once,
// however it ends: it arrived, or the reader's own wheel, touch or key took the
// scroll.
function holdSmoothScrollOff(onEnd?: () => void) {
  const root = document.documentElement;
  let before: string | null = null;
  let done = false;
  return {
    start() {
      if (before === null) before = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
    },
    end() {
      if (before !== null) root.style.scrollBehavior = before;
      before = null;
      if (done) return;
      done = true;
      onEnd?.();
    },
  };
}

export type ScrollChild = {
  // Stops it where it is (the master carries on) and puts the root back.
  kill: () => void;
};

// Whether the deal's own scroll is moving the page right now (either leg, from its
// first tick to however it ends). Its positions are the page's as it was when the
// leg began, so nothing may change the height of what is above the reader under
// it: the ribbon's slot waits for it to end before it closes up
// (components/home/useSlotRelease.ts). The leg's eased tail moves the page less
// than a pixel a frame for a while, long enough to look like a reader who stopped.
const moving = new Set<object>();
export function dealScrollMoving(): boolean {
  return moving.size > 0;
}
function movingWhile(key: object) {
  return { start: () => void moving.add(key), end: () => void moving.delete(key) };
}

// Adds the scroll to the master at `startMs`, over `durationMs`, power2.inOut.
// `autoKill`: the reader's own scroll takes it back (off in the cutscene, whose
// lock keeps the reader's input out and whose leg nothing else may stop).
export function addDealScroll(master: ReturnType<typeof Gsap.timeline>, top: number, startMs: number, durationMs: number, onEnd?: () => void, autoKill = true): ScrollChild {
  const leg = movingWhile({});
  const hold = holdSmoothScrollOff(() => {
    leg.end();
    onEnd?.();
  });
  const tween = gsap.to(window, {
    scrollTo: { y: top, autoKill, onAutoKill: hold.end },
    duration: durationMs / 1000,
    ease: "power2.inOut",
    onStart: () => {
      leg.start();
      hold.start();
    },
    onComplete: hold.end,
    onInterrupt: hold.end,
  });
  // Made on the global timeline, moved into the master at the label "scroll".
  master.addLabel("scroll", startMs / 1000);
  master.add(tween, "scroll");
  return {
    kill() {
      tween.kill();
      hold.end();
      leg.end();
    },
  };
}

// The hand path's leg: the page takes over from the reader's own scroll at its
// current speed (lib/home/handScroll.ts plans the curve) and eases to the landing.
// It starts with the deal (the master's zero) and writes the position itself, an
// instant scroll each tick, so the root's smooth scroll never smooths a step and
// there is nothing to put back.
export function addHandScroll(master: ReturnType<typeof Gsap.timeline>, plan: HandPlan, y0: number, landing: number): ScrollChild {
  const progress = { e: 0 };
  const leg = movingWhile(progress);
  const tween = gsap.to(progress, {
    e: 1,
    duration: plan.durationMs / 1000,
    ease: plan.ease,
    onStart: leg.start,
    onUpdate: () => window.scrollTo({ top: y0 + (landing - y0) * progress.e, behavior: "instant" }),
    onComplete: leg.end,
    onInterrupt: leg.end,
  });
  // Made on the global timeline, moved into the master at its zero (the label "scroll").
  master.addLabel("scroll", 0);
  master.add(tween, "scroll");
  return {
    kill() {
      // A child of the master: the master's length is the clock proxy's, so it is not shortened.
      tween.kill();
      leg.end();
    },
  };
}

// "Back to my cards" and the reduced-motion jump: a plain eased scroll to the
// cards section, outside any deal.
export function scrollToCards(reducedMotion: boolean, onDone?: () => void) {
  const top = cardsTop();
  if (top === null) {
    onDone?.();
    return;
  }
  const hold = holdSmoothScrollOff(onDone);
  hold.start();
  gsap.to(window, {
    scrollTo: { y: top, autoKill: true, onAutoKill: hold.end },
    duration: dealScrollSeconds(top - window.scrollY, reducedMotion),
    ease: "site",
    overwrite: true,
    onComplete: hold.end,
    onInterrupt: hold.end,
  });
}

