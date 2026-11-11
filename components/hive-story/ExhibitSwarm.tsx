"use client";

import { useEffect, useRef, useState } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { BEE_R, EXHIBIT_BOX, EXHIBIT_LOOP, EXHIBIT_STEPS, exhibitFrame, exhibitStepAt, outlineAt } from "@/lib/hive-story/exhibit";
import { StepControls } from "./StepControls";

const { exhibit } = hiveStoryCopy.why;
const REST = outlineAt(EXHIBIT_STEPS[3].start);
const r2 = (n: number) => Math.round(n * 100) / 100;

// The exhibit, as an aside: a swarm that finds a person and waves with them.
// The still frame (the person in bees) is in the server HTML; the canvas takes
// over while it plays. Back and Next play one step and hold; reduced motion
// never plays and shows each step as a still frame.
export function ExhibitSwarm() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ goTo: (s: number) => void; setAuto: (on: boolean) => void } | null>(null);
  const [step, setStep] = useState(3);
  const [auto, setAutoState] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const box = boxRef.current, canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!box || !canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ink = getComputedStyle(box).getPropertyValue("--hive-bee").trim();
    let raf = 0, onScreen = false, elapsed = 0, last = 0, holdAt: number | null = null, isAuto = !reduce.matches, shownStep = -1;

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(box.clientWidth * dpr);
      canvas.height = Math.round(box.clientHeight * dpr);
      const scale = (box.clientWidth / EXHIBIT_BOX.width) * dpr;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const paint = () => {
      const t = elapsed % EXHIBIT_LOOP;
      const frame = exhibitFrame(t);
      ctx.clearRect(0, 0, EXHIBIT_BOX.width, EXHIBIT_BOX.height);
      ctx.fillStyle = ink;
      if (frame.outline > 0) {
        ctx.globalAlpha = 0.3 * frame.outline;
        for (const p of outlineAt(t)) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      for (const p of frame.bees) { ctx.beginPath(); ctx.arc(p.x, p.y, BEE_R, 0, Math.PI * 2); ctx.fill(); }
      box.dataset.live = "true";
      const s = exhibitStepAt(t);
      if (s !== shownStep) { shownStep = s; setStep(s); }
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
    const update = () => {
      setReduced(reduce.matches);
      if (reduce.matches && isAuto) { isAuto = false; setAutoState(false); stop(); delete box.dataset.live; ctx.clearRect(0, 0, EXHIBIT_BOX.width, EXHIBIT_BOX.height); return; }
      if (onScreen && !document.hidden && (isAuto || (holdAt !== null && elapsed < holdAt))) start();
      else stop();
    };
    api.current = {
      goTo: (s) => {
        isAuto = false;
        setAutoState(false);
        stop();
        if (reduce.matches) { elapsed = EXHIBIT_STEPS[s].still; holdAt = elapsed; paint(); return; }
        elapsed = EXHIBIT_STEPS[s].start;
        holdAt = EXHIBIT_STEPS[s].end;
        start();
      },
      setAuto: (on) => { if (reduce.matches) return; isAuto = on; setAutoState(on); holdAt = null; if (on) start(); else stop(); },
    };

    fit();
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); });
    io.observe(box);
    const ro = new ResizeObserver(() => { fit(); if (box.dataset.live) paint(); });
    ro.observe(box);
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      reduce.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <figure className="hive-exhibit m-0">
      <p className="hive-aside-tag font-label text-label-sm">{exhibit.tag}</p>
      <div ref={boxRef} className="hive-exhibit-box">
        <svg viewBox={`0 0 ${EXHIBIT_BOX.width} ${EXHIBIT_BOX.height}`} className="hive-exhibit-still block h-auto w-full" aria-hidden="true" focusable="false">
          <g fill="var(--hive-bee)">{REST.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={BEE_R} />)}</g>
        </svg>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      </div>
      <p className="mt-2 min-h-[1.5rem] text-center text-sm font-semibold" aria-hidden="true">{exhibit.steps[step]}</p>
      <figcaption className="mt-3 text-[1.0625rem] leading-[1.5]">{exhibit.body}</figcaption>
      <p className="mt-1 text-sm text-muted">{exhibit.note}</p>
      <div className="mt-4">
        <StepControls step={step} count={EXHIBIT_STEPS.length} playing={auto && !reduced} canPlay={!reduced} onBack={() => api.current?.goTo(Math.max(0, step - 1))} onNext={() => api.current?.goTo(Math.min(EXHIBIT_STEPS.length - 1, step + 1))} onToggle={() => api.current?.setAuto(!auto)} label={exhibit.tag} />
      </div>
    </figure>
  );
}
