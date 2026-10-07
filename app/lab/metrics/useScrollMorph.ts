"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import type { Drive } from "./skyline/engine";
import type { View } from "./skyline/parts";
import { createSpeedometer, gateOpen, visibleShare } from "./seenGate";
import { FAST_SCROLL_PX_S, REVEAL_BAND, type Settings } from "./settings";

// Scroll decides flat or skyline. One ScrollTrigger on the block: its top
// crossing the trigger line downward turns the view to skyline, crossing it
// upward turns it back to flat; below the line (the block still low on the
// screen, or not yet reached) it stays flat, and past it (however far down the
// page) it stays skyline once it has played. In "scrub" mode a second,
// scrubbed tween also drives the morph's clock across a band after the line,
// trailing by the lag.
//
// The morph must be seen (round 4, "play" only): a crossing the reader cannot
// watch, the chart about to leave before the morph ends, holds the block flat
// and pending. It plays the next time the chart is in view (a share of its
// height inside the viewport) and the scroll has settled (under a speed for a
// short hold), or as soon as a slow scroll would keep it in view for the whole
// morph. Back above the line clears the pending morph.
//
// The toggle overrides: a click sets the view and holds it until the trigger
// line is next crossed, in either direction; that crossing hands the view back
// to the scroll. The click plays the same morph from wherever the engine's
// clock is (or snaps, with toggleMorphs off). Under reduced motion there is no
// scrub, no wait, and the engine swaps at once.

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

// What the headless checks read: the scroll state, and every time the scroll
// started the morph to the skyline with how much of the chart was in view.
type Play = { at: number; share: number; speed: number };
type Probe = { crossed: boolean; override: boolean; pending: boolean; drive: number; plays: Play[] };
declare global {
  interface Window {
    __metricsLab?: { probe: () => Probe; fastScroll: () => void };
  }
}

export function useScrollMorph(blockRef: RefObject<HTMLElement | null>, s: Settings) {
  const [view, setView] = useState<View>("2d");
  const [override, setOverride] = useState(false);
  const [crossed, setCrossed] = useState(false);
  const [pending, setPending] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [drive] = useState(createDrive);
  const pendingRef = useRef(false);
  const viewRef = useRef<View>("2d");
  const plays = useRef<Play[]>([]);
  const reduced = useReducedMotion();
  const scrolled = s.morph !== "load";
  const scrub = s.morph === "scrub" && !reduced;
  const waits = s.morph === "play" && s.morphWaitsForView && !reduced;
  const show = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);

  useEffect(() => {
    const trigger = blockRef.current;
    if (!trigger || !scrolled) return;
    const meter = createSpeedometer();
    let settleTimer = 0;
    const hold = (on: boolean) => {
      pendingRef.current = on;
      setPending(on);
    };
    const chartBox = () => {
      const stage = trigger.querySelector<HTMLElement>("[data-skyline-stage]") ?? trigger;
      const r = stage.getBoundingClientRect();
      return { top: r.top, height: r.height };
    };
    const play = (speed: number) => {
      if (viewRef.current !== "3d") {
        const box = chartBox();
        const share = visibleShare(box.top, box.height, window.innerHeight);
        plays.current.push({ at: Math.round(performance.now()), share: +share.toFixed(3), speed: Math.round(speed) });
      }
      show("3d");
    };
    // The pending morph plays once the gate opens.
    const evaluate = () => {
      if (!pendingRef.current) return;
      const now = performance.now();
      const m = meter.read(now, s.settledMs);
      const box = chartBox();
      const open = gateOpen({
        top: box.top,
        height: box.height,
        viewport: window.innerHeight,
        share: s.inViewShare / 100,
        speed: m.speed,
        dir: m.dir,
        settled: m.settled,
        durationMs: s.duration,
      });
      if (open) {
        hold(false);
        play(m.speed);
      } else if (!m.settled) {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(evaluate, Math.max(16, m.lastFastAt + s.settledMs - now + 8));
      }
    };
    const onScroll = () => {
      meter.push(performance.now(), window.scrollY, s.settleSpeed);
      evaluate();
    };
    const cross = (past: boolean) => {
      setOverride(false);
      setClicked(false);
      setCrossed(past);
      if (!past) {
        hold(false);
        show("2d");
        return;
      }
      if (!waits) {
        play(meter.read(performance.now(), s.settledMs).speed);
        return;
      }
      hold(true);
      evaluate();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", evaluate);
    const ctx = gsap.context(() => {
      // The range runs to the end of the page, so a fling past the whole block
      // still reads as one crossing (onEnter), never a skipped one.
      const st = ScrollTrigger.create({
        trigger,
        start: `top ${s.triggerPct}%`,
        end: "max",
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
          },
        });
      }
      // The state the scroll gives right now: a load already past the line (a
      // deep link, a reload lower down) is past it, and waits to be seen.
      cross(st.scroll() > st.start);
    });
    // Anything above the block that reflows without a window resize (the
    // panel on phones, a font landing, the copy above changing) moves the
    // line; re-measure once it settles. Only the block's own position counts:
    // the morph growing the chart below its top must not refresh, because a
    // refresh rewinds the scrubbed clock (a loop: rewind, shrink, refresh).
    let timer = 0;
    const blockTop = () => Math.round(trigger.getBoundingClientRect().top + window.scrollY);
    let lastTop = blockTop();
    const observer = new ResizeObserver(() => {
      const top = blockTop();
      if (top === lastTop) return;
      lastTop = top;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", evaluate);
      ctx.revert();
      drive.set(0);
      pendingRef.current = false;
    };
  }, [blockRef, scrolled, scrub, waits, s.triggerPct, s.scrubBand, s.scrubLag, s.inViewShare, s.settledMs, s.settleSpeed, s.duration, drive, show]);

  useEffect(() => {
    window.__metricsLab = {
      probe: () => ({ crossed, override, pending, drive: Number(drive.get().toFixed(3)), plays: plays.current.slice() }),
      fastScroll: () => fastScroll(s.duration),
    };
  }, [crossed, override, pending, drive, s.duration]);

  const choose = (v: View) => {
    pendingRef.current = false;
    setPending(false);
    setOverride(true);
    setClicked(true);
    show(v);
  };

  return {
    scrolled,
    view,
    choose,
    drive: scrub ? drive : null,
    driven: scrub && !override,
    snap: clicked && !s.toggleMorphs,
  };
}

// The panel's test pass: jump to the top, let the view settle flat (one morph
// back, if it was up), then scroll to the footer at FAST_SCROLL_PX_S without
// stopping. Any wheel, touch or key from the reader cancels it.
let cancelPass: (() => void) | null = null;
export function fastScroll(settleMs: number, pxPerSec = FAST_SCROLL_PX_S) {
  cancelPass?.();
  let raf = 0;
  let wait = 0;
  const stop = () => {
    window.clearTimeout(wait);
    cancelAnimationFrame(raf);
    ["wheel", "touchstart", "keydown"].forEach((t) => window.removeEventListener(t, stop));
    cancelPass = null;
  };
  cancelPass = stop;
  ["wheel", "touchstart", "keydown"].forEach((t) => window.addEventListener(t, stop, { passive: true }));
  window.scrollTo({ top: 0, behavior: "instant" });
  wait = window.setTimeout(() => {
    let last = performance.now();
    const step = (now: number) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const next = Math.min(max, window.scrollY + (pxPerSec * Math.min(50, now - last)) / 1000);
      last = now;
      window.scrollTo({ top: next, behavior: "instant" });
      if (next < max - 0.5) raf = requestAnimationFrame(step);
      else stop();
    };
    raf = requestAnimationFrame(step);
  }, settleMs + 200);
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
