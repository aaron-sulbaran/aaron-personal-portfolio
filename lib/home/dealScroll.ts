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
// auto for the tween's life and put back however it ends.
export function scrollToCards(reducedMotion: boolean) {
  const section = document.getElementById("work");
  if (!section) return;
  const top = section.getBoundingClientRect().top + window.scrollY;
  const root = document.documentElement;
  const before = root.style.scrollBehavior;
  const restore = () => {
    root.style.scrollBehavior = before;
  };
  root.style.scrollBehavior = "auto";
  gsap.to(window, {
    scrollTo: { y: top, autoKill: true, onAutoKill: restore },
    duration: dealScrollSeconds(top - window.scrollY, reducedMotion),
    ease: "site",
    overwrite: true,
    onComplete: restore,
    onInterrupt: restore,
  });
}
