"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { FOOTER } from "@/lib/footer/constants";
import type { EggPose } from "@/lib/footer/egg";
import { createWordState, stepWord, type LetterFrame, type Pointer, type WordInput } from "@/lib/footer/word";

// The wordmark's one loop: it reads a mouse or pen over the footer (touch
// does nothing to the letters; a tap reaches the period button), clocks the
// rise from the first time the footer is seen, steps the frame
// (lib/footer/word.ts) and hands it to `apply`, which writes attributes
// directly (no React render per frame). It runs only while the footer is on
// screen and something moves, and sleeps at rest until the pointer, the egg
// or the view wakes it. `paint` draws the current frame now, without moving
// time, so a new geometry lands before the browser paints, and wakes the loop
// when that frame is still moving (a swell under a resting pointer, a rise).

export type MotionConfig = Omit<WordInput, "pointer" | "riseStart"> & {
  apply: (frames: readonly LetterFrame[], pose: EggPose, phase: "waiting" | "moving" | "rest") => void;
};

export type WordMotion = { wake: () => void; paint: () => void };

const NOOP: WordMotion = { wake: () => {}, paint: () => {} };

export function useWordMotion(stage: RefObject<HTMLElement | null>, config: RefObject<MotionConfig>, count: number) {
  const motion = useRef<WordMotion>(NOOP);

  // A layout effect, so the first frame is written before the first paint
  // (the wordmark mounts on the client only, after the footer is measured).
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const state = createWordState(count);
    const pointer: Pointer = { x: 0, y: 0, inside: false, pressed: false };
    let riseStart: number | null = null;
    let visible = false;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number, dt: number) => {
      const c = config.current;
      const { pose, busy } = stepWord(state, { ...c, pointer, riseStart }, now, dt);
      c.apply(state.frames, pose, riseStart === null && !c.reduced ? "waiting" : busy ? "moving" : "rest");
      return busy;
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (frame(now, dt) && visible) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!visible || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    motion.current = {
      wake,
      paint: () => {
        if (frame(performance.now(), 0)) wake();
      },
    };

    const fine = (e: PointerEvent) => e.pointerType !== "touch";
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    const onMove = (e: PointerEvent) => {
      if (!fine(e)) return;
      local(e);
      pointer.inside = true;
      wake();
    };
    const onLeave = () => {
      pointer.inside = false;
      pointer.pressed = false;
      wake();
    };
    const onDown = (e: PointerEvent) => {
      // Only a primary press dents the letters: a right or middle press can open a menu and lose its pointerup.
      if (!fine(e) || e.button !== 0 || (e.target as Element | null)?.closest("a, button")) return;
      local(e);
      pointer.inside = true;
      pointer.pressed = true;
      wake();
    };
    const onUp = () => {
      if (!pointer.pressed) return;
      pointer.pressed = false;
      wake();
    };
    const io = new IntersectionObserver(
      (entries) => {
        // A quick scroll out and back can batch both changes; the last entry is now.
        const entry = entries[entries.length - 1];
        visible = entry.isIntersecting;
        if (visible && riseStart === null && entry.intersectionRatio >= FOOTER.rise.seenShare) riseStart = performance.now();
        if (visible) wake();
        else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: [0, FOOTER.rise.seenShare] },
    );
    io.observe(el);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    frame(performance.now(), 0);
    return () => {
      cancelAnimationFrame(raf);
      motion.current = NOOP;
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [stage, config, count]);

  return motion;
}
