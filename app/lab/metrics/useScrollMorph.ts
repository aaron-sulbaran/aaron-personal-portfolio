"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import type { Drive } from "./skyline/engine";
import type { View } from "./skyline/parts";
import { REVEAL_BAND, type Settings } from "./settings";

// Scroll decides flat or skyline. One ScrollTrigger on the block: its top
// crossing the trigger line downward turns the view to skyline, crossing it
// upward turns it back to flat; below the line (the block still low on the
// screen, or not yet reached) it stays flat, and past it (however far down the
// page) it stays skyline. In "scrub" mode a second, scrubbed tween also
// drives the morph's clock across a band after the line, trailing by the lag.
//
// The toggle overrides: a click sets the view and holds it until the trigger
// line is next crossed, in either direction; that crossing hands the view back
// to the scroll. Under reduced motion there is no scrub and the engine swaps
// at once, so the crossing is an instant change of state, never a morph.

const reduceQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (fn: () => void) => {
  const mq = window.matchMedia(reduceQuery);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};
export const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduce, () => window.matchMedia(reduceQuery).matches, () => false);

function createDrive(): Drive & { set: (t: number) => void } {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (t: number) => {
      if (t === value) return;
      value = t;
      listeners.forEach((fn) => fn());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

type Probe = { crossed: boolean; override: boolean; drive: number };
declare global {
  interface Window {
    __metricsLab?: { probe: () => Probe };
  }
}

export function useScrollMorph(blockRef: RefObject<HTMLElement | null>, s: Settings) {
  const [view, setView] = useState<View>("2d");
  const [override, setOverride] = useState(false);
  const [crossed, setCrossed] = useState(false);
  const [drive] = useState(createDrive);
  const reduced = useReducedMotion();
  const scrolled = s.morph !== "load";
  const scrub = s.morph === "scrub" && !reduced;

  useEffect(() => {
    const trigger = blockRef.current;
    if (!trigger || !scrolled) return;
    const cross = (past: boolean) => {
      setOverride(false);
      setCrossed(past);
      setView(past ? "3d" : "2d");
    };
    const ctx = gsap.context(() => {
      const st = ScrollTrigger.create({
        trigger,
        start: `top ${s.triggerPct}%`,
        invalidateOnRefresh: true,
        onEnter: () => cross(true),
        onLeaveBack: () => cross(false),
      });
      if (scrub) {
        const clock = { t: 0 };
        gsap.to(clock, {
          t: 1,
          ease: "none",
          onUpdate: () => drive.set(clock.t),
          scrollTrigger: {
            trigger,
            start: `top ${s.triggerPct}%`,
            end: `top ${Math.max(5, s.triggerPct - s.scrubBand)}%`,
            scrub: s.scrubLag,
            invalidateOnRefresh: true,
          },
        });
      }
      // The state the scroll gives right now: a load already past the line (a
      // deep link, a reload lower down) starts in skyline.
      cross(st.scroll() > st.start);
    });
    // Anything above the block that reflows without a window resize (the
    // panel on phones, a font landing, the copy above changing) moves the
    // line; re-measure once the page's height settles.
    let timer = 0;
    let lastHeight = document.body.scrollHeight;
    const observer = new ResizeObserver(() => {
      const height = document.body.scrollHeight;
      if (height === lastHeight) return;
      lastHeight = height;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      ctx.revert();
      drive.set(0);
    };
  }, [blockRef, scrolled, scrub, s.triggerPct, s.scrubBand, s.scrubLag, drive]);

  useEffect(() => {
    window.__metricsLab = { probe: () => ({ crossed, override, drive: Number(drive.get().toFixed(3)) }) };
  }, [crossed, override, drive]);

  const choose = (v: View) => {
    setOverride(true);
    setView(v);
  };

  return { scrolled, view, choose, drive: scrub ? drive : null, driven: scrub && !override };
}

// The block's own mask-in, a stand-in from the sections grammar: rise and
// fade, scrubbed with lag across its band. It moves an inner element so the
// morph's trigger, on the outer one, never measures a transform.
export function useRevealStandIn(outerRef: RefObject<HTMLElement | null>, innerRef: RefObject<HTMLElement | null>, on: boolean) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || !on || reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(inner, {
        opacity: 0,
        y: REVEAL_BAND.rise,
        ease: "power3.out",
        scrollTrigger: {
          trigger: outer,
          start: `top ${REVEAL_BAND.start}%`,
          end: `top ${REVEAL_BAND.end}%`,
          scrub: REVEAL_BAND.lag,
          invalidateOnRefresh: true,
        },
      });
    });
    return () => ctx.revert();
  }, [outerRef, innerRef, on, reduced]);
}
