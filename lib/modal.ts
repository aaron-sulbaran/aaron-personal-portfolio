"use client";

import { useEffect, useRef } from "react";

// Shared modal primitives: body scroll lock, escape-to-close, click-outside
// handling, focus trap, and focus return. Kept hand-rolled (no external dep).

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Module-level lock reference count. Overlapping locks (e.g. the Menu opening
// during the ring-entrance lock) must not each save and restore the body style
// independently: with nested locks the inner cleanup would restore the
// already-locked style and the outer cleanup would restore an unlock that no
// longer reflects reality, leaving the body wedged at overflow:hidden. Instead
// the body styles are written once on the 0 to 1 transition (capturing the true
// pre-lock values) and restored once on the 1 to 0 transition.
let scrollLockCount = 0;
let prevBodyOverflow = "";
let prevBodyPaddingRight = "";

function acquireScrollLock() {
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;

  prevBodyOverflow = document.body.style.overflow;
  prevBodyPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    // Fixed-position chrome (Menu trigger, modal close buttons) reads this so
    // it can shift inward by the same width and not jump when the lock engages.
    document.documentElement.style.setProperty("--scrollbar-comp", `${scrollbarWidth}px`);
  }
}

function releaseScrollLock() {
  if (scrollLockCount === 0) return;
  scrollLockCount -= 1;
  if (scrollLockCount > 0) return;

  document.body.style.overflow = prevBodyOverflow;
  document.body.style.paddingRight = prevBodyPaddingRight;
  document.documentElement.style.setProperty("--scrollbar-comp", "0px");
}

export function useBodyScrollLock(locked: boolean) {
  // Track whether this hook instance currently holds a lock so it
  // increments/decrements the shared counter exactly once, regardless of
  // re-renders, dependency flips, or unmount-while-locked.
  const heldRef = useRef(false);

  useEffect(() => {
    if (!locked) return;
    acquireScrollLock();
    heldRef.current = true;
    return () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      releaseScrollLock();
    };
  }, [locked]);
}

// Module-level stack of active Escape handlers. window-level keydown listeners
// cannot be ordered against each other by stopPropagation (they are siblings on
// the same target), so layering is enforced here: every active hook pushes its
// handler and only the topmost entry responds to Escape. Non-top removals
// preserve order so closing an inner layer hands control back to the one
// beneath it.
const escapeStack: Array<() => void> = [];

function handleGlobalEscape(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  if (escapeStack.length === 0) return;
  const top = escapeStack[escapeStack.length - 1];
  top();
}

let escapeListenerAttached = false;

export function useEscapeKey(active: boolean, onEscape: () => void) {
  // Keep the latest callback in a ref so the stack entry is stable across
  // renders while always invoking the current handler.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const entry = () => onEscapeRef.current();
    escapeStack.push(entry);
    if (!escapeListenerAttached) {
      window.addEventListener("keydown", handleGlobalEscape);
      escapeListenerAttached = true;
    }
    return () => {
      const idx = escapeStack.indexOf(entry);
      if (idx !== -1) escapeStack.splice(idx, 1);
      if (escapeStack.length === 0 && escapeListenerAttached) {
        window.removeEventListener("keydown", handleGlobalEscape);
        escapeListenerAttached = false;
      }
    };
  }, [active]);
}

// Traps Tab/Shift+Tab inside the referenced container while active. Restores
// focus to the element that was focused before the modal opened.
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );

    // Move focus into the container on open.
    const first = focusables()[0];
    // Delay by a frame so the entrance animation can start before focus jumps.
    // Tracked so cleanup can cancel it; otherwise a trap that unmounts within
    // the same frame would still steal focus after it is gone.
    let initialFocusRaf = 0;
    if (first) {
      initialFocusRaf = requestAnimationFrame(() => first.focus());
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    container.addEventListener("keydown", handler);
    return () => {
      if (initialFocusRaf) cancelAnimationFrame(initialFocusRaf);
      container.removeEventListener("keydown", handler);
      returnFocusRef.current?.focus?.();
    };
  }, [active, containerRef]);
}

// Shared modal-backdrop motion. Every modal uses these so the open language is
// consistent: the blur RADIUS and the dim animate in from zero (not a
// pre-blurred layer fading via opacity), which is what keeps the open from
// snapping. Callers pass `delaySeconds` if they want to hold the blur before it
// ramps; currently 0 everywhere, since a deferred hold read as laggy (the click
// produced no background response for a beat). Returned as plain objects (not
// annotated Variants) so vendor-prefixed WebkitBackdropFilter stays assignable
// to the motion `variants` prop.

// Full backdrop blur radius (matches Tailwind backdrop-blur-xl).
export const MODAL_BLUR_PX = 24;

// Photo/work modals pass `heldExit` so the frost HOLDS at full for a beat after
// close, then clears. This keeps the deck masked while the flown card dissolves
// back toward it (the reverse of the frost-in on open), so the return never
// shows a translucent card clipping across the deck. FlyingTile's dissolve uses
// matching hold/ramp timing. The definition modal (no flight) keeps the default
// quick exit.
export const MODAL_DISMISS_HOLD = 0.2; // frost stays full this long after close
export const MODAL_DISMISS_RAMP = 0.26; // then clears over this long

export function modalBackdropBlurVariants(delaySeconds: number, heldExit = false) {
  return {
    hidden: { backdropFilter: "blur(0px)", WebkitBackdropFilter: "blur(0px)" },
    visible: {
      backdropFilter: `blur(${MODAL_BLUR_PX}px)`,
      WebkitBackdropFilter: `blur(${MODAL_BLUR_PX}px)`,
      transition: { delay: delaySeconds, duration: 0.28, ease: "easeOut" as const },
    },
    exit: {
      backdropFilter: "blur(0px)",
      WebkitBackdropFilter: "blur(0px)",
      transition: heldExit
        ? { delay: MODAL_DISMISS_HOLD, duration: MODAL_DISMISS_RAMP, ease: "easeInOut" as const }
        : { duration: 0.2, ease: "easeIn" as const },
    },
  };
}

export function modalBackdropTintVariants(delaySeconds: number, heldExit = false) {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { delay: delaySeconds, duration: 0.28, ease: "easeOut" as const } },
    exit: {
      opacity: 0,
      transition: heldExit
        ? { delay: MODAL_DISMISS_HOLD, duration: MODAL_DISMISS_RAMP, ease: "easeInOut" as const }
        : { duration: 0.18, ease: "easeIn" as const },
    },
  };
}
