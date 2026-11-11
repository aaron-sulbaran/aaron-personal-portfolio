"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Point } from "@/lib/hive-story/dots";
import { TRIP_ROUTES, TRIP_STEPS } from "@/lib/hive-story/trip";

const STEP_MS = 1700;
const HOLD_MS = 3600;
const FLY_MS = 900;
const MOVE = "cubic-bezier(0.77, 0, 0.175, 1)";

function fly(bee: SVGElement, route: readonly Point[]) {
  const lengths = [0];
  for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
  const total = lengths[lengths.length - 1] || 1;
  const frames = route.map((p, i) => ({ transform: `translate(${p.x}px, ${p.y}px)`, offset: lengths[i] / total, opacity: i === route.length - 1 ? 0 : 1 }));
  bee.animate(frames, { duration: FLY_MS, easing: MOVE });
}

// Plays the fact's trip step by step: parts after the current step dim, the
// step's line in the list lights, and at steps 5 and 6 a bee carries the quote.
// At rest (no JS, reduced motion, off screen before it ever ran) every part and
// every line shows; reduced motion is followed live in both directions.
export function FactTripPlayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const parts = Array.from(root.querySelectorAll<SVGGElement>("[data-at]"));
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-step-item]"));
    const bees = { 5: root.querySelector<SVGElement>('[data-bee="5"]'), 6: root.querySelector<SVGElement>('[data-bee="6"]') };
    let step = 0, timer = 0, onScreen = false;

    const show = (s: number) => {
      step = s;
      root.dataset.playing = "true";
      for (const part of parts) part.toggleAttribute("data-off", Number(part.dataset.at) > s);
      items.forEach((item, i) => item.toggleAttribute("data-now", i === s - 1));
      const bee = s === 5 || s === 6 ? bees[s] : null;
      if (bee) fly(bee, TRIP_ROUTES[s as 5 | 6]);
    };
    const tick = () => {
      const next = step >= TRIP_STEPS ? 1 : step + 1;
      show(next);
      timer = window.setTimeout(tick, next === TRIP_STEPS ? HOLD_MS : STEP_MS);
    };
    const pause = () => { window.clearTimeout(timer); timer = 0; };
    const rest = () => {
      pause();
      step = 0;
      delete root.dataset.playing;
      for (const part of parts) part.removeAttribute("data-off");
      for (const item of items) item.removeAttribute("data-now");
    };
    const update = () => {
      if (reduce.matches) return rest();
      const live = onScreen && !document.hidden;
      if (live && !timer) tick();
      else if (!live && timer) pause();
    };

    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }, { threshold: 0.35 });
    io.observe(root);
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      pause();
      io.disconnect();
      reduce.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return <div ref={ref} className="hive-trip">{children}</div>;
}
