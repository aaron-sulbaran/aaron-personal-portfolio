"use client";

import { useEffect, useRef, type RefObject } from "react";
import { anchorsFrom, emptyCheckpoints, lightAll, lightUpTo, raiseMark, readingDepth, type CheckpointState } from "@/lib/quick/checkpoints";
import { gsap, ScrollTrigger } from "@/lib/quick/gsap";
import { QUICK_MOTION, timings } from "@/lib/quick/motion";
import { photoWipeIn } from "@/lib/gallery/reveal";
import type { TrackGeometry } from "./useTrackGeometry";

// One ScrollTrigger for the whole track, under gsap.matchMedia. It drives no
// animation: it reports how deep the reader's line sits in the track, the depth
// only rises (lib/quick/checkpoints), and a paused proxy chases it. Each step of
// the chase hands the depth to the variant's drive (the drawn line, the car) and
// lights the checkpoints the line has reached: data-lit on the item and on any
// data-quick-mark of the same key, and the item's data-quick-thumb masks in left
// to right. The server markup is the lit, finished page; arming dims only what
// the reader has not reached yet, and everything on screen at that moment counts
// as reached, so nothing visible ever blinks out. Reduced motion, real or
// previewed, lights everything at once. runKey resets the one-way state.

export type Drive = (depth: number) => void;

type Options = {
  geometry: TrackGeometry | null;
  runKey: string;
  speed: number;
  forceReduced: boolean;
  build: (geometry: TrackGeometry) => Drive;
};

export function useCheckpointTrack(trackRef: RefObject<HTMLElement | null>, { geometry, runKey, speed, forceReduced, build }: Options) {
  const stateRef = useRef<CheckpointState>(emptyCheckpoints());
  const buildRef = useRef(build);
  useEffect(() => {
    buildRef.current = build;
  });

  useEffect(() => {
    stateRef.current = emptyCheckpoints();
  }, [runKey]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !geometry) return;
    const { chaseS, wipeS } = timings(speed);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
      const reduce = forceReduced || Boolean(context.conditions?.reduce);
      const anchors = anchorsFrom(geometry.tops, geometry.height);
      const marked = (key: string) => [...track.querySelectorAll<HTMLElement>(`[data-quick-key="${key}"], [data-quick-mark="${key}"]`)];
      const thumbs = (key: string) => [...track.querySelectorAll<HTMLElement>(`[data-quick-key="${key}"] [data-quick-thumb]`)];
      const wipe = photoWipeIn(QUICK_MOTION.direction);
      const paint = (key: string, lit: boolean, animate: boolean) => {
        for (const el of marked(key)) el.dataset.lit = String(lit);
        for (const thumb of thumbs(key)) {
          if (!lit) gsap.set(thumb, { clipPath: wipe.from });
          else if (animate) {
            const media = thumb.querySelector("[data-quick-media]");
            context.add(() => {
              gsap.fromTo(thumb, { clipPath: wipe.from }, { clipPath: wipe.to, duration: wipeS, ease: QUICK_MOTION.wipeEase, clearProps: "clipPath" });
              if (media) gsap.fromTo(media, { scale: QUICK_MOTION.settle }, { scale: 1, duration: wipeS, ease: QUICK_MOTION.wipeEase, clearProps: "transform" });
            });
          } else gsap.set(thumb, { clearProps: "clipPath" });
        }
      };
      const drive = buildRef.current(geometry);
      const clear = () => {
        for (const el of track.querySelectorAll<HTMLElement>("[data-lit]")) delete el.dataset.lit;
        for (const el of track.querySelectorAll<HTMLElement>("[data-quick-thumb], [data-quick-media]")) {
          gsap.killTweensOf(el);
          el.style.removeProperty("clip-path");
          el.style.removeProperty("transform");
        }
        delete track.dataset.quickState;
      };

      if (reduce) {
        stateRef.current = lightAll(stateRef.current, anchors);
        for (const anchor of anchors) paint(anchor.key, true, false);
        drive(1);
        track.dataset.quickState = "still";
        return clear;
      }

      track.dataset.quickState = "armed";
      const proxy = { depth: stateRef.current.mark };
      const step = (animate: boolean) => {
        drive(proxy.depth);
        const next = lightUpTo(stateRef.current, anchors, proxy.depth);
        stateRef.current = next.state;
        for (const key of next.lit) paint(key, true, animate);
      };
      for (const anchor of anchors) paint(anchor.key, stateRef.current.lit.has(anchor.key), false);
      step(false);
      const chase = gsap.to(proxy, { depth: proxy.depth, duration: chaseS, ease: QUICK_MOTION.chaseEase, paused: true, onUpdate: () => step(true) });

      let measured = false;
      const follow = (self: ScrollTrigger) => {
        const rect = track.getBoundingClientRect();
        const atEnd = self.scroll() >= ScrollTrigger.maxScroll(window) - 2;
        const line = measured ? QUICK_MOTION.readingLine : 1;
        const raised = raiseMark(stateRef.current, readingDepth({ trackTop: rect.top, trackHeight: rect.height, viewportHeight: window.innerHeight, line, atEnd }));
        if (!measured) {
          measured = true;
          stateRef.current = raised.state;
          proxy.depth = raised.state.mark;
          step(false);
        } else if (raised.moved) {
          stateRef.current = raised.state;
          chase.resetTo("depth", raised.state.mark, proxy.depth);
        }
        if (stateRef.current.mark >= 1) queueMicrotask(() => self.kill());
      };
      const trigger = ScrollTrigger.create({ trigger: track, start: "top bottom", end: "bottom top", onUpdate: follow, onRefresh: follow });
      follow(trigger);
      return () => {
        chase.kill();
        trigger.kill();
        clear();
      };
    });
    return () => mm.revert();
  }, [trackRef, geometry, runKey, speed, forceReduced]);
}
