"use client";

import { useEffect, useRef, type RefObject } from "react";
import { approach, falloff, leanAngle, pressTarget, riseProgress, springStep, type Spring } from "./motion";
import type { FooterSettings } from "./settings";

// One loop for the wordmark: it reads the pointer over the footer, eases
// each letter's swell, springs its press, clocks the rise from the first
// time the footer is seen, leans the disc and slab, and hands the frame to
// `apply`, which writes attributes directly (no React render per frame).

export type Point = { readonly x: number; readonly y: number };
export type LetterFrame = { weight: number; squash: number; rise: number; lean: number; grow: number };
export type DiscFrame = { comp: number; dx: number; dy: number };

export type MotionConfig = {
  settings: FooterSettings;
  size: number; // the ascender height, px
  centers: readonly Point[]; // each letter's center at rest, stage px
  reduced: boolean;
  apply: (letters: readonly LetterFrame[], disc: DiscFrame) => void;
};

export const COMPOSITIONS = 3;

export function useWordMotion(stage: RefObject<HTMLElement | null>, config: RefObject<MotionConfig>, count: number, replay: number) {
  const riseStart = useRef<number | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    if (seen.current) riseStart.current = performance.now();
  }, [replay]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const pointer = { x: 0, y: 0, inside: false, pressed: false };
    const infl = Array.from({ length: count }, () => 0);
    const springs: Spring[] = Array.from({ length: count }, () => ({ x: 1, v: 0 }));
    const disc = { comp: 0, dx: 0, dy: 0 };
    const frames: LetterFrame[] = Array.from({ length: count }, () => ({ weight: 0, squash: 1, rise: 1, lean: 0, grow: 1 }));
    let visible = false;
    let raf = 0;
    let last = performance.now();

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    const onMove = (e: PointerEvent) => {
      local(e);
      pointer.inside = true;
    };
    const onLeave = () => {
      pointer.inside = false;
      pointer.pressed = false;
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest("a, button, input, select")) return;
      local(e);
      pointer.inside = true;
      pointer.pressed = true;
      disc.comp = (disc.comp + 1) % COMPOSITIONS;
    };
    const onUp = () => {
      pointer.pressed = false;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { settings: s, size, centers, reduced, apply } = config.current;
      const radius = s.swellRadius * size;
      const riseOn = s.riseMs > 0 && !reduced;
      const elapsed = riseStart.current === null ? 0 : now - riseStart.current;
      for (let i = 0; i < count; i++) {
        const c = centers[i] ?? { x: 0, y: 0 };
        const near = pointer.inside && !reduced ? falloff(Math.hypot(pointer.x - c.x, pointer.y - c.y), radius) : 0;
        infl[i] = approach(infl[i], near, dt, s.swellEaseS);
        const target = pointer.pressed && !reduced ? pressTarget(s.pressDepth, near) : 1;
        springs[i] = reduced ? { x: 1, v: 0 } : springStep(springs[i], target, s.pressStiffness, s.pressDamping, dt);
        const f = frames[i];
        f.weight = s.weight + s.swellAmount * infl[i];
        f.squash = Math.max(0.05, springs[i].x);
        f.rise = !riseOn ? 1 : riseStart.current === null ? 0 : riseProgress(elapsed, i, s.riseMs, s.riseStaggerMs, s.riseEase);
        f.lean = s.face === "profa" && s.profaResponse === "lean" ? leanAngle(s.leanDeg, pointer.x - c.x, infl[i], radius) : 0;
        f.grow = s.face === "profa" && s.profaResponse === "grow" ? 1 + s.grow * infl[i] : 1;
      }
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      const lean = pointer.inside && !reduced ? s.disc.lean : 0;
      disc.dx = approach(disc.dx, lean * ((pointer.x - w / 2) / (w / 2)), dt, 0.35);
      disc.dy = approach(disc.dy, lean * ((pointer.y - h / 2) / (h / 2)), dt, 0.35);
      apply(frames, disc);
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !seen.current && entry.intersectionRatio >= 0.3) {
          seen.current = true;
          riseStart.current = performance.now();
        }
        if (visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: [0, 0.3] },
    );
    io.observe(el);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [stage, config, count]);
}
