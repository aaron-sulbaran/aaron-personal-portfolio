"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { LAYOUTS, LOOP_SECONDS, clockAt } from "@/lib/hive-story/flow";
import { buildSwarm, drawSwarm, type SwarmColors } from "./drawSwarm";

const { flow } = hiveStoryCopy;
const WIDE = "(min-width: 1024px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

// The honey stage: the clock and caption on top, the static diagram (children,
// server-rendered) over a canvas of flying bees. Motion only runs on screen, in
// a visible tab, and never under reduced motion, live in both directions; at
// rest the stage shows the whole diagram and a one-line summary.
export function FlowSwarm({ children }: { children: ReactNode }) {
  const headRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const head = headRef.current, clock = clockRef.current, caption = captionRef.current, box = boxRef.current, canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!head || !clock || !caption || !box || !canvas || !ctx) return;
    const reduce = window.matchMedia(REDUCED);
    const wide = window.matchMedia(WIDE);
    const style = getComputedStyle(box);
    const colors: SwarmColors = { bee: style.getPropertyValue("--hive-bee").trim(), glow: style.getPropertyValue("--hive-glow").trim() };
    let model = buildSwarm(LAYOUTS[wide.matches ? "wide" : "tall"]);
    let raf = 0, onScreen = false, elapsed = 0, last = 0, shown = "";

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = box.clientWidth, h = box.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const scale = (w / model.layout.width) * dpr;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const paint = () => {
      ctx.clearRect(0, 0, model.layout.width, model.layout.height);
      const t = elapsed % LOOP_SECONDS;
      drawSwarm(ctx, model, t, colors);
      const entry = clockAt(t);
      const key = `${entry.time}|${entry.caption}`;
      if (key !== shown) {
        shown = key;
        clock.textContent = entry.time;
        caption.textContent = flow.captions[entry.caption];
      }
    };
    const frame = (now: number) => {
      elapsed += Math.min(0.1, (now - last) / 1000);
      last = now;
      paint();
      raf = requestAnimationFrame(frame);
    };
    const settle = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const update = () => {
      const live = onScreen && !reduce.matches && !document.hidden;
      if (live && !raf) {
        head.dataset.live = "true";
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!live && raf) settle();
      if (reduce.matches) {
        settle();
        delete head.dataset.live;
        shown = "";
        caption.textContent = flow.rest;
        ctx.clearRect(0, 0, model.layout.width, model.layout.height);
      }
    };
    const relayout = () => {
      model = buildSwarm(LAYOUTS[wide.matches ? "wide" : "tall"]);
      fit();
      if (!reduce.matches) paint();
    };

    fit();
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); });
    io.observe(box);
    const ro = new ResizeObserver(() => { fit(); if (raf) paint(); });
    ro.observe(box);
    reduce.addEventListener("change", update);
    wide.addEventListener("change", relayout);
    document.addEventListener("visibilitychange", update);
    return () => {
      settle();
      io.disconnect();
      ro.disconnect();
      reduce.removeEventListener("change", update);
      wide.removeEventListener("change", relayout);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div className="hive-stage rounded-[22px] lg:rounded-[30px]">
      <div ref={headRef} className="hive-stage-head" aria-hidden="true">
        <span ref={clockRef} className="hive-clock font-dot" />
        <p ref={captionRef} className="hive-caption">{flow.rest}</p>
        <p className="hive-legend">
          <span><svg width="20" height="6" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="2" /><circle cx="10" cy="3" r="2" /><circle cx="17" cy="3" r="2" /></g></svg>{flow.legend.now}</span>
          <span><svg width="24" height="6" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="3" cy="3" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="21" cy="3" r="2" /></g></svg>{flow.legend.next}</span>
        </p>
      </div>
      <div ref={boxRef} className="hive-stage-box">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
