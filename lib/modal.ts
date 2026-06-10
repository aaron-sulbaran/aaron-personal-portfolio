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
