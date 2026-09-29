import { readScrollY, saveScrollY } from "@/lib/scroll";

// Deep-reload recovery for the home document, ported from TileRing (the fast
// start threshold, the pre-paint determination, scroll persistence, and the
// restore) as plain functions the HomeController calls in order:
//
//   1. takeManualScrollRestoration()  before paint, once per load
//   2. readRecovery()                 before paint: is this a deep load?
//   3. applyRestore(target)           before paint on a deep load
//   4. relandAfterFonts(target)       re-lands once fonts settle, unless the
//                                     visitor already moved
//   5. persistScrollPosition()        for the life of the page
//
// A deep load (a section hash, or a saved position past half a viewport)
// takes the fast start: no loader, no entrance, no scroll lock.

// Past half a viewport the visitor is clearly out of the hero; below it the
// load is treated as a top arrival and plays the full intro.
export const FAST_START_THRESHOLD_FRAC = 0.5;

export type RestoreTarget = {
  // The fragment as it appeared in the URL ("#about"), or null.
  hash: string | null;
  // The pixel position to fall back to when the fragment has no element.
  y: number | null;
};

export type Recovery = { deep: boolean; target: RestoreTarget | null };

export type RecoveryInput = {
  hash: string;
  savedY: number | null;
  currentY: number;
  viewportHeight: number;
};

// Pure: decides whether this load lands past the hero. "#main" is the skip
// link's target (the very top), so it is not a deep link.
export function determineRecovery({ hash, savedY, currentY, viewportHeight }: RecoveryInput): Recovery {
  const hasSectionHash = hash.length > 1 && hash !== "#main";
  // Prefer the persisted position; fall back to whatever the browser already
  // auto-restored (the very first reload, before manual restoration applied).
  const targetY = savedY != null ? savedY : currentY;
  const deep = hasSectionHash || targetY > viewportHeight * FAST_START_THRESHOLD_FRAC;
  if (!deep) return { deep: false, target: null };
  return { deep: true, target: { hash: hasSectionHash ? hash : null, y: targetY } };
}

export function readRecovery(): Recovery {
  return determineRecovery({
    hash: window.location.hash,
    savedY: readScrollY(),
    currentY: window.scrollY,
    viewportHeight: window.innerHeight,
  });
}

// Takes manual control of scroll restoration so the browser never auto-restores
// on top of our own restore (the top-to-target flash). `subscribeRefresh` lets a
// scroll library that resets restoration to "auto" on refresh (GSAP's
// ScrollTrigger does) re-assert manual each time; pass
// (cb) => { ScrollTrigger.addEventListener("refresh", cb); return () => ScrollTrigger.removeEventListener("refresh", cb); }
// once the scene owns a ScrollTrigger. Returns the cleanup.
export function takeManualScrollRestoration(
  subscribeRefresh?: (onRefresh: () => void) => () => void,
): () => void {
  if (!("scrollRestoration" in history)) return () => {};
  const previous = history.scrollRestoration;
  history.scrollRestoration = "manual";
  const keepManual = () => {
    history.scrollRestoration = "manual";
  };
  const unsubscribe = subscribeRefresh?.(keepManual);
  return () => {
    unsubscribe?.();
    history.scrollRestoration = previous;
  };
}

// Lands on the target instantly. It must be behavior "instant": "auto" means
// "use the CSS value", and globals.css sets html { scroll-behavior: smooth },
// so "auto" would animate the restore from the top (measured on the first
// frame at y = 2 of 3000). The fragment resolves with getElementById, never
// querySelector: "#123" is a valid id but an invalid CSS selector, and
// querySelector would throw. A missing element falls back to the saved pixel.
export function applyRestore(target: RestoreTarget | null) {
  if (!target) return;
  let element: HTMLElement | null = null;
  if (target.hash) {
    try {
      element = document.getElementById(decodeURIComponent(target.hash.slice(1)));
    } catch {
      element = null;
    }
  }
  if (element) element.scrollIntoView({ block: "start", behavior: "instant" });
  else if (target.y != null) window.scrollTo({ top: target.y, behavior: "instant" });
}

// Font swaps reflow the page under a pixel position, so the restore re-lands
// once document.fonts settles, but never after the visitor has moved (a small
// reflow shift beats yanking them back). Returns the cleanup.
export function relandAfterFonts(target: RestoreTarget | null, onRelanded?: () => void): () => void {
  if (!target) return () => {};
  let disposed = false;
  let userMoved = false;
  const markMoved = () => {
    userMoved = true;
  };
  const moveEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  moveEvents.forEach((type) => window.addEventListener(type, markMoved, { passive: true, once: true }));
  document.fonts?.ready
    .then(() => {
      if (disposed || userMoved) return;
      applyRestore(target);
      onRelanded?.();
    })
    .catch(() => {});
  return () => {
    disposed = true;
    moveEvents.forEach((type) => window.removeEventListener(type, markMoved));
  };
}

// Persists the scroll position so the next load can restore it and base the
// fast-start decision on it: one rAF-coalesced write per frame of scrolling,
// plus a final write on pagehide. Returns the cleanup.
export function persistScrollPosition(): () => void {
  let raf = 0;
  const write = () => {
    raf = 0;
    saveScrollY(window.scrollY);
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(write);
  };
  const onPageHide = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    saveScrollY(window.scrollY);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pagehide", onPageHide);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pagehide", onPageHide);
  };
}
