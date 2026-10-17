"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { clipIn, clipOut } from "@/lib/gallery/reveal";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import type { SeriesChoice } from "@/lib/metrics/settings";
import { WAVE_EASE, waveSchedule, type WaveDirection } from "@/lib/metrics/wave";

export const FIGURE_COUNT = 3;

// What the strip shows at any moment of the wave: the series the bars draw
// (and the way the bars sweep), the series each figure slot shows, and
// whether the toolkit band is mounted.
export type WaveView = { bars: SeriesChoice; reverse: boolean; slots: SeriesChoice[]; band: boolean };
export type WaveTimings = { gapMs: number; offsetMs: number; maskMs: number };

const resting = (choice: SeriesChoice): WaveView => ({ bars: choice, reverse: false, slots: Array.from({ length: FIGURE_COUNT }, () => choice), band: choice === "tokens" });
const restingAfter = (choice: SeriesChoice, direction: WaveDirection): WaveView => ({ ...resting(choice), reverse: direction === "rtl" });

// Commits to Tokens as one wave across the strip, left to right: the bars
// switch, then each figure masks out and in with the new one, then the toolkit
// band masks in. Tokens to Commits runs it right to left, the bars last. The
// press is immediate (`choice`); everything else follows the schedule in
// lib/metrics/wave.ts. A press during a wave finishes it at once, and reduced
// motion (read at the press, and live) swaps it all with no masks.
//
// Test hooks on the board: data-wave-state, data-wave-dir, and data-wave-order
// (each event as it starts, reset per wave); data-mask-dir sits on a slot or
// the band while its mask runs.
export function useWave(first: SeriesChoice, timings: WaveTimings) {
  const [choice, setChoice] = useState(first);
  const [view, setView] = useState(() => resting(first));
  const board = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const band = useRef<HTMLElement | null>(null);
  const run = useRef<{ timeline: gsap.core.Timeline; target: SeriesChoice; direction: WaveDirection } | null>(null);
  const choiceNow = useRef(first);
  const timingsNow = useRef(timings);
  const bandTween = useRef<gsap.core.Tween | null>(null);
  const refreshTimer = useRef(0);
  const reduced = useReducedMotionLive();
  useLayoutEffect(() => {
    timingsNow.current = timings;
  });

  const mark = useCallback((attribute: "waveState" | "waveDir" | "waveOrder", value: string) => {
    if (board.current) board.current.dataset[attribute] = value;
  }, []);
  const note = useCallback((event: string) => {
    const order = board.current?.dataset.waveOrder;
    mark("waveOrder", order ? `${order},${event}` : event);
  }, [mark]);

  // The band and the figures change the page's height; the triggers below the strip re-measure.
  const refreshSoon = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => ScrollTrigger.refresh(), 120);
  }, []);

  const clearMasks = useCallback((keepBand: boolean) => {
    for (const el of keepBand ? [...slots.current, band.current] : slots.current) {
      if (!el) continue;
      gsap.set(el, { clearProps: "clipPath" });
      delete el.dataset.maskDir;
    }
  }, []);

  // Finish the running wave where it was heading, or settle a finished one.
  const settle = useCallback(() => {
    const current = run.current;
    run.current = null;
    current?.timeline.kill();
    bandTween.current?.kill();
    bandTween.current = null;
    // A band that is about to unmount keeps its mask, so it never flashes back.
    clearMasks(!current || current.target === "tokens");
    if (current) setView(restingAfter(current.target, current.direction));
    mark("waveState", "idle");
    refreshSoon();
  }, [clearMasks, mark, refreshSoon]);

  const maskThrough = useCallback((el: HTMLElement | null, direction: WaveDirection, mask: "in" | "out", seconds: number, at: gsap.core.Timeline, position: number) => {
    if (!el) return;
    const clip = mask === "in" ? clipIn(direction) : clipOut(direction);
    at.fromTo(el, { clipPath: clip.from }, { clipPath: clip.to, duration: seconds, ease: WAVE_EASE, immediateRender: false }, position);
  }, []);

  const start = useCallback((target: SeriesChoice) => {
    const direction: WaveDirection = target === "tokens" ? "ltr" : "rtl";
    const { gapMs, offsetMs, maskMs } = timingsNow.current;
    const wave = waveSchedule({ direction, figures: FIGURE_COUNT, gapMs, offsetMs, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches, maskMs });
    mark("waveDir", direction);
    mark("waveOrder", "");
    if (wave.instant) {
      note("instant");
      setView(restingAfter(target, direction));
      refreshSoon();
      return;
    }
    mark("waveState", "running");
    const half = maskMs / 1000;
    const timeline = gsap.timeline({ onComplete: settle });
    run.current = { timeline, target, direction };
    const at = (ms: number) => ms / 1000;
    timeline.call(() => {
      note("bars");
      setView((v) => ({ ...v, bars: target, reverse: direction === "rtl" }));
    }, [], at(wave.barsAtMs));
    wave.figureAtMs.forEach((ms, index) => {
      const el = slots.current[index];
      timeline.call(() => {
        note(`figure-${index}`);
        if (el) el.dataset.maskDir = direction;
      }, [], at(ms));
      maskThrough(el, direction, "out", half, timeline, at(ms));
      timeline.call(() => flushSync(() => setView((v) => ({ ...v, slots: v.slots.map((kind, i) => (i === index ? target : kind)) }))), [], at(ms) + half);
      maskThrough(el, direction, "in", half, timeline, at(ms) + half);
    });
    timeline.call(() => {
      note(direction === "ltr" ? "band-in" : "band-out");
      if (direction === "ltr") flushSync(() => setView((v) => ({ ...v, band: true })));
      const el = band.current;
      if (!el) return;
      el.dataset.maskDir = direction;
      const clip = direction === "ltr" ? clipIn(direction) : clipOut(direction);
      bandTween.current = gsap.fromTo(el, { clipPath: clip.from }, { clipPath: clip.to, duration: maskMs / 1000, ease: WAVE_EASE });
    }, [], at(wave.bandAtMs));
    timeline.set({}, {}, at(wave.endMs));
  }, [maskThrough, mark, note, refreshSoon, settle]);

  const choose = useCallback((next: SeriesChoice) => {
    if (next === choiceNow.current) return;
    if (run.current) settle();
    choiceNow.current = next;
    setChoice(next);
    start(next);
  }, [settle, start]);

  // Reduced motion switched on mid-wave: finish it now.
  useEffect(() => {
    if (reduced && run.current) settle();
  }, [reduced, settle]);

  useEffect(() => () => {
    run.current?.timeline.kill();
    bandTween.current?.kill();
    window.clearTimeout(refreshTimer.current);
  }, []);

  const register = useCallback((index: number, el: HTMLDivElement | null) => {
    slots.current[index] = el;
  }, []);
  const registerBand = useCallback((el: HTMLElement | null) => {
    band.current = el;
  }, []);
  return { choice, view, choose, board, register, registerBand };
}
