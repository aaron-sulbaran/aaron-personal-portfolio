// A full ScrollTrigger refresh records the window's scroll position, parks
// the window at 0 to measure every trigger, then scrolls back to the record.
// GSAP 3.15 writes an inline scroll-behavior: auto on the root for that, and
// two gaps in that guard can carry the page to the top on a resize:
//
// 1. Chromium skips the style update for window.scrollTo(0, 0) (a jump to the
//    origin is never clamped, so it lays nothing out). The inline auto is not
//    computed yet, the stale smooth from globals.css applies, and the jump
//    glides toward the top instead of landing.
// 2. A ScrollTrigger created inside a gsap.matchMedia callback (ReadAlong and
//    UpToNowList at 768px and up) refreshes on its own between the media
//    change's record and its full refresh, and a lone refresh clears the
//    record. GSAP then never scrolls back, and the glide from 1 runs to 0.
//
// On refreshInit (after the record, before the jump) the guard makes the
// instant behaviour take effect at once and puts back a lost record from the
// current position; GSAP's own restore then lands the page before any trigger
// updates. It never scrolls the page itself. On refresh it hands the root back
// its own inline value one frame later, after the frame in which GSAP writes
// an inline smooth, so the stylesheet (and its reduced-motion rule) decides
// again.

// GSAP keeps the recorded position on the scroll function as `rec`; it is not
// in the typings.
export type RecordedScroll = { rec?: number };

export type RefreshGuardDeps = {
  on: (event: "refreshInit" | "refresh", callback: () => void) => void;
  windowScroll: () => RecordedScroll;
  root: { style: { scrollBehavior: string } };
  scrollY: () => number;
  flushStyle: () => unknown;
  nextFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

export function guardRefreshScroll({ on, windowScroll, root, scrollY, flushStyle, nextFrame, cancelFrame }: RefreshGuardDeps) {
  let ownInline: string | null = null;
  let handBack = 0;

  on("refreshInit", () => {
    // First, so GSAP's one-time smooth check on a new scroll function reads the stylesheet, not the auto below.
    const scroll = windowScroll();
    if (ownInline === null) ownInline = root.style.scrollBehavior;
    cancelFrame(handBack);
    root.style.scrollBehavior = "auto";
    flushStyle();
    if (!scroll.rec) scroll.rec = Math.round(scrollY());
  });

  on("refresh", () => {
    cancelFrame(handBack);
    handBack = nextFrame(() => {
      root.style.scrollBehavior = ownInline ?? "";
      ownInline = null;
    });
  });
}
