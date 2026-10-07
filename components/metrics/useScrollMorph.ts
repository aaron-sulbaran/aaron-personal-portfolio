"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { createSpeedometer, gateOpen } from "@/lib/metrics/seenGate";
import { MORPH } from "@/lib/metrics/settings";
import type { View } from "./skyline/parts";

// Scroll decides flat or skyline through one ScrollTrigger on the block (never
// transformed: a reveal moves an inner element). Crossing the 60 percent line
// down makes the morph pending; it plays once the seen gate opens (in view and
// settled, or slow enough to watch). Back above the line, flat. A click holds
// until the line is next crossed. Reduced motion: no wait, the engine snaps.
export function useScrollMorph(blockRef: RefObject<HTMLElement | null>) {
  const [view, setView] = useState<View>("flat");
  const viewRef = useRef<View>("flat");
  const pendingRef = useRef(false);
  // Outlives the effect, so a Strict Mode remount never zeroes a count beside a view that already played.
  const playsRef = useRef(0);
  const reduced = useReducedMotion() ?? false;
  const show = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);

  useEffect(() => {
    const block = blockRef.current;
    if (!block) return;
    const meter = createSpeedometer();
    let settleTimer = 0;
    block.dataset.morphPlays = String(playsRef.current);
    const hold = (on: boolean) => {
      pendingRef.current = on;
      block.dataset.morphPending = String(on);
    };
    hold(false);
    const chart = () => (block.querySelector<HTMLElement>("[data-skyline-stage]") ?? block).getBoundingClientRect();
    const play = () => {
      if (viewRef.current !== "skyline") block.dataset.morphPlays = String(++playsRef.current);
      show("skyline");
    };
    const evaluate = () => {
      if (!pendingRef.current) return;
      const now = performance.now();
      const m = meter.read(now, MORPH.settledMs);
      const box = chart();
      const input = { top: box.top, height: box.height, viewport: window.innerHeight, share: MORPH.inViewShare, speed: m.speed, dir: m.dir, settled: m.settled, durationMs: MORPH.durationMs };
      if (gateOpen(input)) {
        hold(false);
        play();
      } else if (!m.settled) {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(evaluate, Math.max(16, m.lastFastAt + MORPH.settledMs - now + 8));
      }
    };
    const onScroll = () => {
      meter.push(performance.now(), window.scrollY, MORPH.settleSpeed);
      evaluate();
    };
    const cross = (past: boolean) => {
      if (!past) {
        hold(false);
        show("flat");
      } else if (reduced) play();
      else {
        hold(true);
        evaluate();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", evaluate);
    const ctx = gsap.context(() => {
      // The range runs to the page's end, so a fling past the block is still one crossing.
      // No invalidateOnRefresh: with it, a refresh at an unchanged ratio resets progress to 0 and refires onEnter, breaking a click hold.
      const st = ScrollTrigger.create({ trigger: block, start: `top ${MORPH.triggerPct}%`, end: "max", onEnter: () => cross(true), onLeaveBack: () => cross(false) });
      cross(st.scroll() > st.start);
    });
    // Reflow above the block moves the line; only the block's own top counts,
    // never the chart growing below it (a refresh loop otherwise).
    let timer = 0;
    const blockTop = () => Math.round(block.getBoundingClientRect().top + window.scrollY);
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
    };
  }, [blockRef, reduced, show]);

  const choose = useCallback(
    (v: View) => {
      pendingRef.current = false;
      if (blockRef.current) blockRef.current.dataset.morphPending = "false";
      show(v);
    },
    [blockRef, show],
  );
  return { view, choose };
}
