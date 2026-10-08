"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { MarkRing } from "@/components/mark/MarkRing";
import { getSceneHover, hintStore, subscribeSceneHover } from "@/lib/cursor/hover";
import { siteContent } from "@/lib/content";
import { MARK, RING } from "@/lib/mark/constants";

// ---- fx-hero: the first-visit "Open me" pill ----
// Until the visitor's first card opens, a card under a fine pointer swells the
// cursor into a small accent pill that pops in with a 3 degree tilt settling
// flat (no overshoot in size); it shrinks back off the card, and after that
// first open it never appears again (lib/cursor/hover's hint store).
const subscribeHint = (listener: () => void) => hintStore().subscribe(listener);
const readHintOpened = () => hintStore().opened();
const PILL_POP_MS = 380;
const PILL_POP_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
// ---- end fx-hero ----

const HOVER_SELECTOR = "[data-cursor-hover], a, button, [role='button']";

// Desktop-only accent-colored cursor. Small filled dot by default; grows into
// a hollow ring when hovering any interactive target. Uses CSS var so it
// tracks the active theme's accent.
//
// Position is written straight to the DOM inside the pointer handler instead
// of going through framer-motion. The ring is full of tiles each running their
// own proximity springs every frame; routing the dot through framer-motion's
// shared rAF render loop queued it behind all of that work, so it visibly
// trailed the system cursor. A direct transform write happens on the same tick
// the browser dispatches the move event, matching the native cursor exactly.
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  // Mirror of `hovering` so the hot move handler can skip setState unless the
  // value actually flips (hover changes rarely; position changes every pixel).
  const hoverRef = useRef(false);
  // ---- mark-strike: the cursor rings the mark ----
  // Over the nav mark the cursor snaps (no glide, a direct write) to a ring
  // centred on the grown mark (box + MARK.growPx + RING.padPx), painting the
  // hold from the hover store.
  const reduced = !!useReducedMotion();
  const markRef = useRef<Element | null>(null);
  const ringAt = useRef<{ x: number; y: number } | null>(null);
  const pointerAt = useRef({ x: -100, y: -100 });
  const [ringDiameter, setRingDiameter] = useState(0);
  const ringing = ringDiameter > 0;
  // ---- end mark-strike ----
  // A card in the Coil canvas under the pointer (lib/cursor/hover): it can
  // arrive or leave while the pointer is still, so it is its own signal.
  const sceneHover = useSyncExternalStore(subscribeSceneHover, getSceneHover, () => false);
  // ---- fx-hero ----
  const hintOpened = useSyncExternalStore(subscribeHint, readHintOpened, () => true);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pill = sceneHover && !hintOpened && !ringing;
  useEffect(() => {
    const el = pillRef.current;
    if (!el || !pill) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = el.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translate(-50%, -50%) scale(0.45) rotate(0deg)" },
            { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(-3deg)", offset: 0.55 },
            { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(0deg)" },
          ],
      { duration: reduced ? 160 : PILL_POP_MS, easing: PILL_POP_EASE, fill: "none" },
    );
    return () => animation.cancel();
  }, [pill]);
  // ---- end fx-hero ----

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("cursor-none");
      return;
    }

    document.documentElement.classList.add("cursor-none");

    // The mark under the pointer (its box re-read on `remeasure`), and hover.
    const resolveTarget = (target: Element | null, remeasure: boolean) => {
      const mark = target?.closest("[data-mark-trigger]") ?? null;
      if (mark !== markRef.current || (mark && remeasure)) {
        markRef.current = mark;
        const box = mark?.getBoundingClientRect();
        const grown = box ? box.width + MARK.growPx : 0;
        ringAt.current = box ? { x: box.left + grown / 2, y: box.top + grown / 2 } : null;
        setRingDiameter(box ? grown + RING.padPx : 0);
      }
      const hit = Boolean(target?.closest(HOVER_SELECTOR));
      if (hit !== hoverRef.current) {
        hoverRef.current = hit;
        setHovering(hit);
      }
    };

    // A compositor-only transform, written synchronously; no loop, no spring.
    const place = () => {
      const at = ringAt.current ?? pointerAt.current;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
    };

    // The mark moves under a still pointer (scroll, tuck, resize): re-resolve.
    const recheckMark = () => {
      if (!markRef.current) return;
      resolveTarget(document.elementFromPoint(pointerAt.current.x, pointerAt.current.y), true);
      place();
    };
    const handleMarkTransition = (event: TransitionEvent) => event.target === markRef.current && recheckMark();

    const handleMove = (event: MouseEvent) => {
      pointerAt.current = { x: event.clientX, y: event.clientY };
      resolveTarget(event.target as Element | null, false);
      place();
      // Reveal on the first move. handleMove writes the transform above BEFORE
      // this flips visible, so the dot always appears at the live pointer, never
      // a stale spot; no separate mouseenter handler (which would reveal at the
      // previous coords) is needed. setVisible is unconditional: React bails on
      // the unchanged value, so keeping `visible` out of this effect's deps
      // avoids tearing down and re-registering every listener on each toggle.
      setVisible(true);
    };

    const handleLeave = () => setVisible(false);

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    window.addEventListener("scroll", recheckMark, { passive: true, capture: true });
    window.addEventListener("resize", recheckMark, { passive: true });
    document.addEventListener("transitionend", handleMarkTransition);

    return () => {
      document.documentElement.classList.remove("cursor-none");
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("scroll", recheckMark, { capture: true });
      window.removeEventListener("resize", recheckMark);
      document.removeEventListener("transitionend", handleMarkTransition);
    };
  }, [enabled]);

  if (!enabled) return null;

  const grown = (hovering || sceneHover) && !pill && !ringing;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      style={{
        transform: "translate3d(-100px, -100px, 0)",
        opacity: visible ? 1 : 0,
        willChange: "transform",
      }}
      className="pointer-events-none fixed left-0 top-0 z-[100] transition-opacity duration-200"
    >
      {/* Inner span carries the centering offset + size so the outer div's
          transform stays purely positional (and thus instant). Grow/shrink and
          the fill→ring crossfade are cheap CSS transitions driven by hover
          state, which changes far too rarely to ever feel laggy. */}
      <span
        style={{ width: grown ? 22 : 10, height: grown ? 22 : 10, opacity: ringing ? 0 : 1 }}
        className="relative block -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height] duration-200 ease-out"
      >
        <span
          style={{ opacity: grown || pill ? 0 : 1 }}
          className="absolute inset-0 rounded-full bg-accent transition-opacity duration-150"
        />
        <span
          style={{ opacity: grown ? 1 : 0 }}
          className="absolute inset-0 rounded-full border-[1.5px] border-accent transition-opacity duration-150"
        />
      </span>
      {ringing && <MarkRing diameter={ringDiameter} reduced={reduced} />}
      {/* fx-hero: the first-visit pill, centered on the pointer. */}
      <span
        ref={pillRef}
        style={{ opacity: pill ? 1 : 0, transform: `translate(-50%, -50%) scale(${pill ? 1 : 0.45})` }}
        className="absolute left-0 top-0 whitespace-nowrap rounded-full bg-accent px-3 py-[7px] font-sans text-[13px] font-medium leading-none text-background transition-[opacity,transform] duration-200 ease-out"
      >
        {siteContent.hero.hints.openMe}
      </span>
    </div>
  );
}
