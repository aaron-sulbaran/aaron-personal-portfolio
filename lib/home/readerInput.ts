import { COIL, type CoilConstants } from "@/lib/coil/constants";
import { swallowsKey } from "@/lib/home/dealLockRules";

// Whose scroll is it? The deal's cutscene is for a reader's own scroll (their
// wheel, their finger, a scroll key, the scrollbar), and for the "Deal me in"
// click. A page's own scroll (a Menu link's smooth scroll, an anchor, a script's
// scrollTo) that happens to cross the trigger plays the deal as it always did,
// with no lock and no scroll of the deal's own: the page is already going where
// it was sent, and the cutscene would be a second hand on the same scroll.
//
// So the page keeps a note of the reader's input, and a scroll counts as the
// reader's while that input is recent (COIL.deal.cutscene.readerWindowMs: the OS's
// and the browser's own smooth scrolling and momentum outlast the input). Pure
// (the DOM half is attachReaderInput); tested.

export type ReaderInput = {
  wheel: (nowMs: number) => void;
  key: (nowMs: number) => void;
  touchStart: (nowMs: number) => void;
  touchMove: (nowMs: number) => void;
  touchEnd: (nowMs: number) => void;
  scrollbarDown: (nowMs: number) => void;
  scrollbarUp: (nowMs: number) => void;
  // Is the page scrolling because the reader scrolls it, at nowMs?
  driving: (nowMs: number) => boolean;
};

export function createReaderInput(c: CoilConstants = COIL): ReaderInput {
  const windows = c.deal.cutscene.readerWindowMs;
  let wheelMs = Number.NEGATIVE_INFINITY;
  let keyMs = Number.NEGATIVE_INFINITY;
  // A touch that moved is a scroll (a tap is not); its momentum outlasts it.
  let touching = false;
  let touchMoved = false;
  let touchMovedMs = Number.NEGATIVE_INFINITY;
  let scrollbarHeld = false;
  let scrollbarMs = Number.NEGATIVE_INFINITY;
  return {
    wheel: (nowMs) => {
      wheelMs = nowMs;
    },
    key: (nowMs) => {
      keyMs = nowMs;
    },
    touchStart: () => {
      touching = true;
      touchMoved = false;
    },
    touchMove: (nowMs) => {
      touching = true;
      touchMoved = true;
      touchMovedMs = nowMs;
    },
    touchEnd: (nowMs) => {
      if (touchMoved) touchMovedMs = nowMs;
      touching = false;
      touchMoved = false;
    },
    scrollbarDown: (nowMs) => {
      scrollbarHeld = true;
      scrollbarMs = nowMs;
    },
    scrollbarUp: (nowMs) => {
      scrollbarHeld = false;
      scrollbarMs = nowMs;
    },
    driving: (nowMs) =>
      nowMs - wheelMs <= windows.wheel ||
      nowMs - keyMs <= windows.key ||
      (touching && touchMoved) ||
      nowMs - touchMovedMs <= windows.touch ||
      scrollbarHeld ||
      nowMs - scrollbarMs <= windows.scrollbar,
  };
}

// Listens for the reader's input (passive, capture: nothing here changes what the
// page does with it). Returns the tracker and the cleanup.
export function attachReaderInput(): { input: ReaderInput; detach: () => void } {
  const input = createReaderInput();
  const now = () => performance.now();
  const root = document.documentElement;
  const onWheel = (event: WheelEvent) => {
    // A pinch is the browser's zoom, not a scroll.
    if (!event.ctrlKey && event.deltaY !== 0) input.wheel(now());
  };
  const onKey = (event: KeyboardEvent) => {
    if (swallowsKey(event)) input.key(now());
  };
  const onTouchStart = () => input.touchStart(now());
  const onTouchMove = () => input.touchMove(now());
  const onTouchEnd = () => input.touchEnd(now());
  // The page's own scrollbar: a press on the root element beyond the width its content has.
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.target === root && event.clientX >= root.clientWidth) input.scrollbarDown(now());
  };
  const onPointerUp = () => input.scrollbarUp(now());
  const options = { capture: true, passive: true } as const;
  window.addEventListener("wheel", onWheel, options);
  window.addEventListener("keydown", onKey, options);
  window.addEventListener("touchstart", onTouchStart, options);
  window.addEventListener("touchmove", onTouchMove, options);
  window.addEventListener("touchend", onTouchEnd, options);
  window.addEventListener("touchcancel", onTouchEnd, options);
  window.addEventListener("pointerdown", onPointerDown, options);
  window.addEventListener("pointerup", onPointerUp, options);
  window.addEventListener("pointercancel", onPointerUp, options);
  return {
    input,
    detach: () => {
      window.removeEventListener("wheel", onWheel, options);
      window.removeEventListener("keydown", onKey, options);
      window.removeEventListener("touchstart", onTouchStart, options);
      window.removeEventListener("touchmove", onTouchMove, options);
      window.removeEventListener("touchend", onTouchEnd, options);
      window.removeEventListener("touchcancel", onTouchEnd, options);
      window.removeEventListener("pointerdown", onPointerDown, options);
      window.removeEventListener("pointerup", onPointerUp, options);
      window.removeEventListener("pointercancel", onPointerUp, options);
    },
  };
}
