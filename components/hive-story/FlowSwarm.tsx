"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { FLOW_STEPS, LAYOUTS, LOOP_SECONDS, SUMMARY_HOLD, clockAt, flowStepAt, stillAt } from "@/lib/hive-story/flow";
import { buildSwarm, drawSwarm, type SwarmColors, type SwarmModel } from "./drawSwarm";
import { StepControls } from "./StepControls";

const { flow } = hiveStoryCopy;
const WIDE = "(min-width: 1024px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

// The honey stage: the clock and caption on top, the static diagram (children,
// server-rendered) over a canvas of flying bees, and the step controls. It plays
// on its own while on screen; Back and Next play one step and hold, Play goes
// back to the loop. The summary is the first beat: the scene's clock starts
// SUMMARY_HOLD seconds early, and when it reaches 0 the head goes live and CSS
// crossfades step 1 and the clock in. Under reduced motion nothing plays: the
// stage rests on its summary and Back and Next show each step as a still frame.
export function FlowSwarm({ children }: { children: ReactNode }) {
  const headRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ goTo: (step: number) => void; setAuto: (auto: boolean) => void } | null>(null);
  const [step, setStep] = useState(0);
  const [auto, setAutoState] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const head = headRef.current, clock = clockRef.current, caption = captionRef.current, box = boxRef.current, canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!head || !clock || !caption || !box || !canvas || !ctx) return;
    const reduce = window.matchMedia(REDUCED);
    const wide = window.matchMedia(WIDE);
    const style = getComputedStyle(box);
    const colors: SwarmColors = { bee: style.getPropertyValue("--hive-bee").trim(), glow: style.getPropertyValue("--hive-glow").trim() };
    let model: SwarmModel = buildSwarm(LAYOUTS[wide.matches ? "wide" : "tall"]);
    let raf = 0, onScreen = false, elapsed = -SUMMARY_HOLD, last = 0, shown = "", isAuto = !reduce.matches, holdAt: number | null = null, stepShown = 0;

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(box.clientWidth * dpr);
      canvas.height = Math.round(box.clientHeight * dpr);
      const scale = (box.clientWidth / model.layout.width) * dpr;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const paint = () => {
      ctx.clearRect(0, 0, model.layout.width, model.layout.height);
      if (elapsed < 0) return; // the summary's beat: nothing flies yet
      const t = elapsed % LOOP_SECONDS;
      drawSwarm(ctx, model, t, colors);
      const entry = clockAt(t);
      const key = `${entry.time}|${entry.caption}`;
      if (key !== shown) {
        shown = key;
        clock.textContent = entry.time;
        caption.textContent = flow.captions[entry.caption];
        head.dataset.live = "true";
      }
      const s = flowStepAt(t);
      if (s !== stepShown) { stepShown = s; setStep(s); }
    };
    const frame = (now: number) => {
      elapsed += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (holdAt !== null && elapsed >= holdAt) { elapsed = holdAt; paint(); raf = 0; return; }
      paint();
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const rest = () => {
      stop();
      delete head.dataset.live;
      shown = "";
      ctx.clearRect(0, 0, model.layout.width, model.layout.height);
    };
    const update = () => {
      setReduced(reduce.matches);
      if (reduce.matches && isAuto) { isAuto = false; setAutoState(false); holdAt = null; rest(); return; }
      if (onScreen && !document.hidden && (isAuto || (holdAt !== null && elapsed < holdAt))) start();
      else stop();
    };
    api.current = {
      goTo: (s) => {
        isAuto = false;
        setAutoState(false);
        stop();
        stepShown = s;
        setStep(s);
        if (reduce.matches) { elapsed = stillAt(s); holdAt = elapsed; paint(); return; }
        elapsed = FLOW_STEPS[s].start;
        holdAt = FLOW_STEPS[s].end - 0.01;
        start();
      },
      setAuto: (on) => {
        if (reduce.matches) return;
        isAuto = on;
        setAutoState(on);
        holdAt = null;
        if (on) start(); else stop();
      },
    };

    fit();
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); });
    io.observe(box);
    const ro = new ResizeObserver(() => { fit(); if (shown) paint(); });
    ro.observe(box);
    const relayout = () => { model = buildSwarm(LAYOUTS[wide.matches ? "wide" : "tall"]); fit(); if (shown) paint(); };
    reduce.addEventListener("change", update);
    wide.addEventListener("change", relayout);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      reduce.removeEventListener("change", update);
      wide.removeEventListener("change", relayout);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const back = useCallback(() => api.current?.goTo(Math.max(0, step - 1)), [step]);
  const next = useCallback(() => api.current?.goTo(Math.min(FLOW_STEPS.length - 1, step + 1)), [step]);
  const toggle = useCallback(() => api.current?.setAuto(!auto), [auto]);

  return (
    <div className="hive-stage rounded-[22px] lg:rounded-[30px]">
      <div ref={headRef} className="hive-stage-head" aria-hidden="true">
        <span ref={clockRef} className="hive-clock font-dot">13:17</span>
        <div className="hive-captions">
          <p className="hive-summary">{flow.rest}</p>
          <p ref={captionRef} className="hive-caption">{flow.captions[0]}</p>
        </div>
        <p className="hive-legend">
          <span><svg width="20" height="6" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="2" /><circle cx="10" cy="3" r="2" /><circle cx="17" cy="3" r="2" /></g></svg>{flow.legend.now}</span>
          <span><svg width="24" height="6" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="3" cy="3" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="21" cy="3" r="2" /></g></svg>{flow.legend.next}</span>
        </p>
      </div>
      <div ref={boxRef} className="hive-stage-box">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        {children}
      </div>
      <div className="hive-stage-foot">
        <StepControls step={step} count={FLOW_STEPS.length} playing={auto && !reduced} canPlay={!reduced} onBack={back} onNext={next} onToggle={toggle} label={flow.label} />
      </div>
    </div>
  );
}
