"use client";

import { useEffect, useRef, useState } from "react";

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

    const handleMove = (event: MouseEvent) => {
      // Compositor-only transform (translate3d) written synchronously in the
      // input handler. No layout, no animation loop, no spring. Instant.
      const el = dotRef.current;
      if (el) {
        el.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }
      // Reveal on the first move. handleMove writes the transform above BEFORE
      // this flips visible, so the dot always appears at the live pointer, never
      // a stale spot; no separate mouseenter handler (which would reveal at the
      // previous coords) is needed. setVisible is unconditional: React bails on
      // the unchanged value, so keeping `visible` out of this effect's deps
      // avoids tearing down and re-registering every listener on each toggle.
      setVisible(true);

      const target = event.target as Element | null;
      const hit = Boolean(target?.closest(HOVER_SELECTOR));
      if (hit !== hoverRef.current) {
        hoverRef.current = hit;
        setHovering(hit);
      }
    };

    const handleLeave = () => setVisible(false);

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);

    return () => {
      document.documentElement.classList.remove("cursor-none");
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

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
        style={{ width: hovering ? 22 : 10, height: hovering ? 22 : 10 }}
        className="relative block -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height] duration-200 ease-out"
      >
        <span
          style={{ opacity: hovering ? 0 : 1 }}
          className="absolute inset-0 rounded-full bg-accent transition-opacity duration-150"
        />
        <span
          style={{ opacity: hovering ? 1 : 0 }}
          className="absolute inset-0 rounded-full border-[1.5px] border-accent transition-opacity duration-150"
        />
      </span>
    </div>
  );
}
