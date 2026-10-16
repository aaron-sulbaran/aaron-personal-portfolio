"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MARQUEE, marqueePlan } from "@/lib/marquee";
import { useReducedMotionLive } from "./useReducedMotionLive";

type Props = {
  text: string;
  style?: CSSProperties;
  className?: string;
  active?: boolean; // false while the title is hidden; the cycle restarts at rest when it shows
  maxWidth?: number; // caps the box in a shrink-to-fit parent (the pill); a block parent needs none
  pauseOnHover?: boolean;
};

const SCOPE = "[data-marquee-scope]";

// A track title that scrolls like Spotify's when it overflows its box. The
// text is rendered once, in full, so a screen reader hears it once and
// reduced motion still reads it (clipped, with the fade). The box never
// changes size: the title is clipped by the box it already had.
export function MarqueeTitle({ text, style, className, active = true, maxWidth, pauseOnHover = true }: Props) {
  const reduce = useReducedMotionLive();
  const viewport = useRef<HTMLSpanElement | null>(null);
  const track = useRef<HTMLSpanElement | null>(null);
  const [clipped, setClipped] = useState(false);
  const [state, setState] = useState<"off" | "running" | "paused">("off");

  useEffect(() => {
    const box = viewport.current;
    const content = track.current;
    if (!box || !content) return;
    let animation: Animation | null = null;
    let hovered = false;
    let focused = false;
    const scope = box.closest(SCOPE) ?? box;

    const syncPause = () => {
      if (!animation) return;
      if (hovered || focused) animation.pause();
      else animation.play();
      setState(hovered || focused ? "paused" : "running");
    };

    const measure = () => {
      animation?.cancel();
      animation = null;
      const plan = marqueePlan(content.offsetWidth, box.clientWidth);
      setClipped(plan !== null);
      setState("off");
      if (!plan || reduce || !active) return;
      animation = content.animate(
        plan.offsets.map((offset, index) => ({ offset, transform: `translateX(${plan.translatesPx[index]}px)` })),
        { duration: plan.cycleMs, iterations: Infinity, easing: "linear" },
      );
      syncPause();
    };

    const enter = () => {
      hovered = true;
      syncPause();
    };
    const leave = () => {
      hovered = false;
      syncPause();
    };
    const focusIn = (event: Event) => {
      const target = event.target as Element;
      focused = target.matches(":focus-visible");
      syncPause();
    };
    const focusOut = () => {
      focused = false;
      syncPause();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    if (pauseOnHover) {
      box.addEventListener("pointerenter", enter);
      box.addEventListener("pointerleave", leave);
    }
    scope.addEventListener("focusin", focusIn);
    scope.addEventListener("focusout", focusOut);
    return () => {
      observer.disconnect();
      animation?.cancel();
      box.removeEventListener("pointerenter", enter);
      box.removeEventListener("pointerleave", leave);
      scope.removeEventListener("focusin", focusIn);
      scope.removeEventListener("focusout", focusOut);
    };
  }, [text, reduce, active, pauseOnHover]);

  const mask = `linear-gradient(to right, currentColor calc(100% - ${MARQUEE.fadePx}px), transparent)`;
  return (
    <span
      ref={viewport}
      className={className}
      data-marquee={state}
      style={{
        display: "block",
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: maxWidth ? "max-content" : undefined,
        maxWidth,
        ...(clipped ? { maskImage: mask, WebkitMaskImage: mask } : null),
        ...style,
      }}
    >
      <span ref={track} data-marquee-track style={{ display: "block", width: "max-content", willChange: state === "off" ? undefined : "transform" }}>
        {text}
      </span>
    </span>
  );
}
