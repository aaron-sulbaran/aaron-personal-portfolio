import { gsap } from "@/lib/quick/gsap";
import { NEXT_HEADING_ID, NEXT_SECTION_ID } from "@/lib/quick/next";

// "Currently looking for:" scrolls to the What's next section at the foot of the
// page with GSAP's scroll-to (GSAP owns the scroll), then lands focus on its
// heading so a keyboard or screen reader visitor arrives where the page does.
// The root's smooth scroll-behavior would smooth every frame of the tween, so it
// is held at auto for the tween's life. Reduced motion, real or previewed, and
// checked when it is pressed, jumps.

const REDUCE = "(prefers-reduced-motion: reduce)";
const OFFSET_PX = 160;
const DURATION_S = 0.9;

export function jumpToNext(forceReduced = false): boolean {
  const target = document.getElementById(NEXT_SECTION_ID);
  if (!target) return false;
  const root = document.documentElement;
  const before = root.style.scrollBehavior;
  const settle = () => {
    root.style.scrollBehavior = before;
  };
  const land = () => {
    settle();
    document.getElementById(NEXT_HEADING_ID)?.focus({ preventScroll: true });
  };
  const instant = forceReduced || window.matchMedia(REDUCE).matches;
  root.style.scrollBehavior = "auto";
  gsap.to(window, {
    scrollTo: { y: target, offsetY: OFFSET_PX },
    duration: instant ? 0 : DURATION_S,
    ease: "power3.inOut",
    overwrite: true,
    onComplete: land,
    onInterrupt: settle,
  });
  return true;
}
