import { gsap } from "@/lib/gsap";

// "Deal me in": a smooth scroll from where the reader is to the top of the
// cards section. Never a hijack: the reader's own wheel, touch or key takes the
// scroll back (autoKill). Reduced motion jumps.
const SPEED_PX_PER_S = 1800;
const MIN_S = 0.6;
const MAX_S = 1.4;

export function dealScrollSeconds(distancePx: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.min(MAX_S, Math.max(MIN_S, Math.abs(distancePx) / SPEED_PX_PER_S));
}

// The page's CSS smooths every scroll (scroll-behavior: smooth), which would
// smooth each of the tween's own steps and stall it, so the root is set to
// auto for the tween's life and put back however it ends. onDone runs once,
// however it ends: it arrived, the reader's own wheel, touch or key took the
// scroll, or a newer scroll replaced it (the deal's entrance waits for it).
export function scrollToCards(reducedMotion: boolean, onDone?: () => void) {
  const section = document.getElementById("work");
  if (!section) {
    onDone?.();
    return;
  }
  const top = section.getBoundingClientRect().top + window.scrollY;
  const root = document.documentElement;
  const before = root.style.scrollBehavior;
  let done = false;
  const finish = () => {
    root.style.scrollBehavior = before;
    if (done) return;
    done = true;
    onDone?.();
  };
  root.style.scrollBehavior = "auto";
  gsap.to(window, {
    scrollTo: { y: top, autoKill: true, onAutoKill: finish },
    duration: dealScrollSeconds(top - window.scrollY, reducedMotion),
    ease: "site",
    overwrite: true,
    onComplete: finish,
    onInterrupt: finish,
  });
}
