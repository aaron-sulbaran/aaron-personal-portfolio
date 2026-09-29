"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import { siteContent } from "@/lib/content";
import { scrollToTarget } from "@/lib/scroll";

// The hero's DOM layer over the canvas: the greeting "Hi, I'm" above the
// canvas-drawn name, the "Work and photos" control on the greeting's line
// flush with the name's right edge (it scrolls to the book at #work), and the
// chevron nudge that points off the helix after a few seconds of captured
// wheeling. The scene positions all of it from its own rAF through the handle
// (layout on resize, the nudge per frame), so nothing lags the canvas; the
// layer sits in the hero beside the canvas and scrolls with it natively.
//
// It shows only while the scene draws (data-scene="on" on the hero); without
// a scene the server-rendered h1 carries the greeting, so the greeting here
// is aria-hidden. Slice 5 adds the Coil control and the unwound list layer.

export type OverlayLayout = {
  left: number; // the greeting's left edge, CSS px in the hero
  top: number; // the greeting line's top
  width: number; // to the name's right edge
  greetingPx: number;
  controlPx: number;
};

export type OverlayNudge = { x: number; y: number; angle: number };

export type HeroOverlayHandle = {
  layout: (layout: OverlayLayout | null) => void;
  nudge: (nudge: OverlayNudge | null) => void;
};

// The nudge sits this far off the pointer, toward where the page scrolls.
const NUDGE_OFFSET_PX = 42;

export function HeroOverlay({ ref }: { ref?: Ref<HeroOverlayHandle> }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const greetingRef = useRef<HTMLSpanElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);
  const nudgeOnRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      layout(layout) {
        const row = rowRef.current;
        if (!row) return;
        if (!layout) {
          row.style.visibility = "hidden";
          return;
        }
        row.style.visibility = "";
        row.style.transform = `translate3d(${layout.left.toFixed(1)}px, ${layout.top.toFixed(1)}px, 0)`;
        row.style.width = `${layout.width.toFixed(1)}px`;
        if (greetingRef.current) greetingRef.current.style.fontSize = `${layout.greetingPx.toFixed(1)}px`;
        if (controlRef.current) controlRef.current.style.fontSize = `${layout.controlPx.toFixed(1)}px`;
      },
      nudge(nudge) {
        const el = nudgeRef.current;
        if (!el) return;
        const on = nudge !== null;
        if (on !== nudgeOnRef.current) {
          nudgeOnRef.current = on;
          el.style.opacity = on ? "0.7" : "0";
        }
        if (!nudge) return;
        const x = nudge.x + Math.cos(nudge.angle) * NUDGE_OFFSET_PX;
        const y = nudge.y + Math.sin(nudge.angle) * NUDGE_OFFSET_PX;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${nudge.angle.toFixed(3)}rad)`;
      },
    }),
    [],
  );

  const { greeting, listControl } = siteContent.hero;

  const goToBook = () => {
    scrollToTarget("#work", window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  return (
    <div className="pointer-events-none invisible absolute inset-0 group-data-[scene=on]/hero:visible">
      <div
        ref={rowRef}
        className="absolute left-0 top-0 flex items-baseline justify-between font-sans leading-none text-[color:var(--hero-greeting)]"
        style={{ visibility: "hidden" }}
      >
        <span ref={greetingRef} aria-hidden="true" className="whitespace-nowrap font-medium">
          {greeting}
        </span>
        <button
          ref={controlRef}
          type="button"
          onClick={goToBook}
          className="pointer-events-auto -my-[14px] -mr-2 whitespace-nowrap rounded px-2 py-[14px] leading-none transition-colors duration-200 [transition-timing-function:var(--ease-out)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent"
        >
          {listControl}
        </button>
      </div>
      <div
        ref={nudgeRef}
        aria-hidden="true"
        className="absolute left-0 top-0 -ml-[13px] -mt-[13px] h-[26px] w-[26px] text-foreground opacity-0 transition-opacity duration-[600ms] [transition-timing-function:var(--ease-out)]"
      >
        <svg viewBox="0 0 26 26" className="block h-full w-full">
          <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
          <path
            d="M11 8.5l4.5 4.5-4.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
