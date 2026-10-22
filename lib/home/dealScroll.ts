import type { gsap as Gsap } from "gsap";
import { gsap } from "@/lib/gsap";

// The deal's scroll: the page scrolls itself from where the reader is to the
// top of the cards section, as one child of the deal's master timeline. Never
// a hijack: the reader's own wheel, touch or key takes the scroll back
// (ScrollToPlugin's autoKill, which kills only this child, never the deal).
// Reduced motion jumps.
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
  tween: ReturnType<typeof Gsap.to>;
  // Stops it where it is (the master carries on) and puts the root back.
  kill: () => void;
};

// Adds the scroll to the master at `startMs`, over `durationMs`, power2.inOut.
export function addDealScroll(master: ReturnType<typeof Gsap.timeline>, top: number, startMs: number, durationMs: number, onEnd?: () => void): ScrollChild {
  const hold = holdSmoothScrollOff(onEnd);
  const tween = gsap.to(window, {
    scrollTo: { y: top, autoKill: true, onAutoKill: hold.end },
    duration: durationMs / 1000,
    ease: "power2.inOut",
    onStart: hold.start,
    onComplete: hold.end,
    onInterrupt: hold.end,
  });
  // Made on the global timeline, moved into the master at its time.
  master.add(tween, startMs / 1000);
  return {
    tween,
    kill() {
      tween.kill();
      hold.end();
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

