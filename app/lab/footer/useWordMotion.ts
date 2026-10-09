"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Pivot } from "./aperture";
import { REST_POSE, eggPoseAt, letterDip, rippleLifeMs, stepEgg, type EggPose, type EggState } from "./egg";
import { approach, easeToward, falloff, hoveredLetter, leanAngle, pivotTarget, pressTarget, riseProgress, springStep, type Spring } from "./motion";
import type { FooterSettings, TypeResponse } from "./settings";

// One loop for the wordmark: it reads the pointer over the footer, eases
// each letter's swell, springs its press, clocks the rise from the first
// time the footer is seen, springs the hovered letter's waist slice, eases
// the shutter period's pivot toward the pointer, leans the disc and slab,
// runs the period's Easter egg (its hop, and the ripple that dents each
// letter through its press spring as the wavefront passes), and hands the
// frame to `apply`, which writes attributes directly (no React render per
// frame).

export type Point = { readonly x: number; readonly y: number };
// weight: the procedural stroke; swell: the pointer's share (0 to 1), which a
// typeset face spends on its axes and the constructed face on its stems and
// bars; slice: how far apart the waist slice has slid (0 at rest, 1 the full
// shift, past 1 on the spring's overshoot).
export type LetterFrame = { weight: number; swell: number; squash: number; rise: number; lean: number; grow: number; slice: number };
export type DiscFrame = { comp: number; dx: number; dy: number };

export type MotionConfig = {
  settings: FooterSettings;
  size: number; // the ascender height, px
  centers: readonly Point[]; // each letter's center at rest, stage px
  reduced: boolean;
  stretch: boolean; // a letter may spring taller than at rest (not when the field ends in the letters: no field shows above them)
  typeset: boolean; // Profa or a web font: lean and grow apply
  response: TypeResponse; // what the face does at the pointer, after what it can do
  hit: { halfWidths: readonly number[]; top: number; bottom: number; margin: number }; // the slice's hit test, stage px
  aperture: { index: number; reachPx: number } | null; // the shutter period, when on
  // The Easter egg: its state (shared with the field, which draws the
  // ripples), the period's index and its bottom center at rest (stage px),
  // and the stage's far corner from it, in units (how far a ripple runs).
  egg: { state: EggState; index: number; landing: Point; reach: number } | null;
  apply: (letters: readonly LetterFrame[], disc: DiscFrame, pivot: Pivot, egg: EggPose) => void;
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
    const slices: Spring[] = Array.from({ length: count }, () => ({ x: 0, v: 0 }));
    const centersX: number[] = Array.from({ length: count }, () => 0);
    const pivot: Pivot = { x: 0, y: 0 };
    const disc = { comp: 0, dx: 0, dy: 0 };
    const frames: LetterFrame[] = Array.from({ length: count }, () => ({ weight: 0, swell: 0, squash: 1, rise: 1, lean: 0, grow: 1, slice: 0 }));
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
      const { settings, egg } = config.current;
      if (egg && settings.egg.trigger === "anywhere") egg.state.pending.push({ kind: "point", x: pointer.x, y: pointer.y });
    };
    const onUp = () => {
      pointer.pressed = false;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { settings: s, size, centers, reduced, stretch, typeset, response, hit, aperture, egg, apply } = config.current;
      if (egg) stepEgg(egg.state, now, { e: s.egg, reduced, landing: egg.landing, unitPx: size }, rippleLifeMs(s.egg, egg.reach));
      const ripples = egg && !reduced ? egg.state.ripples : null;
      const radius = s.swellRadius * size;
      const riseOn = s.riseMs > 0 && !reduced;
      const elapsed = riseStart.current === null ? 0 : now - riseStart.current;
      const swelling = response === "swell";
      for (let i = 0; i < count; i++) centersX[i] = centers[i]?.x ?? 0;
      const hovered =
        response === "slice" && pointer.inside && !reduced ? hoveredLetter(pointer.x, pointer.y, centersX, hit.halfWidths, hit.top, hit.bottom, hit.margin) : -1;
      for (let i = 0; i < count; i++) {
        const c = centers[i] ?? { x: 0, y: 0 };
        const near = pointer.inside && !reduced ? falloff(Math.hypot(pointer.x - c.x, pointer.y - c.y), radius) : 0;
        infl[i] = approach(infl[i], near, dt, s.swellEaseS);
        const pressed = pointer.pressed && !reduced ? pressTarget(s.pressDepth, near) : 1;
        // A passing ripple dents the letter through the same spring; the
        // period has its own landing squash.
        const dip = ripples && ripples.length > 0 && i !== egg?.index ? letterDip(c.x, c.y, ripples, now, size, s.egg) : 0;
        const target = Math.min(pressed, 1 - dip);
        springs[i] = reduced ? { x: 1, v: 0 } : springStep(springs[i], target, s.pressStiffness, s.pressDamping, dt);
        const f = frames[i];
        slices[i] = reduced ? { x: 0, v: 0 } : springStep(slices[i], i === hovered ? 1 : 0, s.slice.stiffness, s.slice.damping, dt);
        f.weight = s.weight + (swelling ? s.swellAmount * infl[i] : 0);
        f.swell = swelling ? infl[i] : 0;
        f.slice = slices[i].x;
        f.squash = Math.max(0.05, stretch ? springs[i].x : Math.min(1, springs[i].x));
        f.rise = !riseOn ? 1 : riseStart.current === null ? 0 : riseProgress(elapsed, i, s.riseMs, s.riseStaggerMs, s.riseEase);
        f.lean = typeset && response === "lean" ? leanAngle(s.leanDeg, pointer.x - c.x, infl[i], radius) : 0;
        f.grow = typeset && response === "grow" ? 1 + s.grow * infl[i] : 1;
      }
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      const lean = pointer.inside && !reduced ? s.disc.lean : 0;
      disc.dx = approach(disc.dx, lean * ((pointer.x - w / 2) / (w / 2)), dt, 0.35);
      disc.dy = approach(disc.dy, lean * ((pointer.y - h / 2) / (h / 2)), dt, 0.35);
      // The shutter leans toward the pointer while it is over the footer and
      // eases back to rest when it leaves; reduced motion holds it at rest.
      if (aperture && !reduced) {
        const c = centers[aperture.index] ?? { x: 0, y: 0 };
        const [tx, ty] = pointer.inside ? pivotTarget(pointer.x - c.x, pointer.y - c.y, aperture.reachPx) : [0, 0];
        pivot.x = easeToward(pivot.x, tx, s.aperture.ease, dt);
        pivot.y = easeToward(pivot.y, ty, s.aperture.ease, dt);
      } else {
        pivot.x = 0;
        pivot.y = 0;
      }
      apply(frames, disc, pivot, egg ? eggPoseAt(egg.state, now, s.egg) : REST_POSE);
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const io = new IntersectionObserver(
      (entries) => {
        // A quick scroll out and back can batch both changes into one call;
        // the last entry is the stage as it is now.
        const entry = entries[entries.length - 1];
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
