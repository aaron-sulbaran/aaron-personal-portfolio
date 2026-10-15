"use client";

import { useEffect, useRef, type RefObject } from "react";
import { anchorsFrom, emptyCheckpoints, lightAll, lightUpTo, raiseMark, readingDepth, type CheckpointState } from "@/lib/quick/checkpoints";
import { gsap, ScrollTrigger } from "@/lib/quick/gsap";
import { QUICK_MOTION, timings } from "@/lib/quick/motion";
import { photoWipeIn } from "@/lib/gallery/reveal";
import { dueTiles, worthAnimating, type TileBox } from "@/lib/quick/reveal";
import type { TrackGeometry } from "./useTrackGeometry";

// One ScrollTrigger for the whole track, under gsap.matchMedia. It drives no
// animation: it reports how deep the reader's line sits in the track, the depth
// only rises (lib/quick/checkpoints), and a paused proxy chases it. Each step of
// the chase hands the depth to the variant's drive (the drawn line, the car) and
// lights the checkpoints the line has reached: data-lit on the item and on any
// data-quick-mark of the same key. A tile's picture (data-quick-thumb) is not a
// checkpoint's: it masks in left to right once, when its tile's top crosses the
// reveal line near the viewport's foot (lib/quick/reveal), so a tile wholly on
// screen is never an empty frame. The server markup is the lit, finished page;
// arming dims only what the reader has not reached yet, and everything on screen
// at that moment counts as reached, so nothing visible ever blinks out. Reduced
// motion, real or previewed, lights and reveals everything at once. runKey
// resets the one-way state.
// marks: a second root whose data-quick-mark elements light too (the trip bar).
// onDepth: the reader's depth as it is, both ways (a car that follows the
// reader rather than the high water); 1 under reduced motion.

export type Drive = (depth: number) => void;

type Options = {
  geometry: TrackGeometry | null;
  runKey: string;
  speed: number;
  forceReduced: boolean;
  build: (geometry: TrackGeometry) => Drive;
  marks?: RefObject<HTMLElement | null>;
  onDepth?: (depth: number, geometry: TrackGeometry) => void;
};

export function useCheckpointTrack(trackRef: RefObject<HTMLElement | null>, { geometry, runKey, speed, forceReduced, build, marks, onDepth }: Options) {
  const stateRef = useRef<CheckpointState>(emptyCheckpoints());
  const revealedRef = useRef<Set<string>>(new Set());
  const buildRef = useRef(build);
  const onDepthRef = useRef(onDepth);
  useEffect(() => {
    buildRef.current = build;
    onDepthRef.current = onDepth;
  });

  useEffect(() => {
    stateRef.current = emptyCheckpoints();
    revealedRef.current = new Set();
  }, [runKey]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !geometry) return;
    const { chaseS, wipeS } = timings(speed);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
      const reduce = forceReduced || Boolean(context.conditions?.reduce);
      const anchors = anchorsFrom(geometry.tops, geometry.height);
      const markRoot = marks?.current ?? null;
      const marked = (key: string) => [
        ...track.querySelectorAll<HTMLElement>(`[data-quick-key="${key}"], [data-quick-mark="${key}"]`),
        ...(markRoot && !track.contains(markRoot) ? markRoot.querySelectorAll<HTMLElement>(`[data-quick-mark="${key}"]`) : []),
      ];
      const thumbs = (key: string) => [...track.querySelectorAll<HTMLElement>(`[data-quick-key="${key}"] [data-quick-thumb]`)];
      const tiles = [...track.querySelectorAll<HTMLElement>("[data-quick-key]")].filter((el) => el.querySelector("[data-quick-thumb]"));
      const wipe = photoWipeIn(QUICK_MOTION.direction);
      const paint = (key: string, lit: boolean) => {
        for (const el of marked(key)) el.dataset.lit = String(lit);
      };
      const hideThumbs = (key: string) => {
        for (const thumb of thumbs(key)) gsap.set(thumb, { clipPath: wipe.from });
      };
      const showThumbs = (key: string, animate: boolean) => {
        for (const thumb of thumbs(key)) {
          if (!animate) {
            gsap.set(thumb, { clearProps: "clipPath" });
            continue;
          }
          const media = thumb.querySelector("[data-quick-media]");
          context.add(() => {
            gsap.fromTo(thumb, { clipPath: wipe.from }, { clipPath: wipe.to, duration: wipeS, ease: QUICK_MOTION.wipeEase, clearProps: "clipPath" });
            if (media) gsap.fromTo(media, { scale: QUICK_MOTION.settle }, { scale: 1, duration: wipeS, ease: QUICK_MOTION.wipeEase, clearProps: "transform" });
          });
        }
      };
      const boxOf = (el: HTMLElement): TileBox => {
        const rect = el.getBoundingClientRect();
        return { key: el.dataset.quickKey ?? "", top: rect.top, bottom: rect.bottom };
      };
      // Reveals every tile whose top has crossed the line. The first pass opens
      // what is already on screen without a wipe.
      const reveal = (line: number, animate: boolean) => {
        const revealed = revealedRef.current;
        if (revealed.size >= tiles.length) return;
        const height = window.innerHeight;
        const pending = tiles.filter((el) => !revealed.has(el.dataset.quickKey ?? "")).map(boxOf);
        for (const box of dueTiles(pending, height, line, revealed)) {
          revealed.add(box.key);
          showThumbs(box.key, animate && worthAnimating(box, height));
        }
      };
      const drive = buildRef.current(geometry);
      const clear = () => {
        for (const el of track.querySelectorAll<HTMLElement>("[data-lit]")) delete el.dataset.lit;
        for (const el of markRoot?.querySelectorAll<HTMLElement>("[data-lit]") ?? []) delete el.dataset.lit;
        for (const el of track.querySelectorAll<HTMLElement>("[data-quick-thumb], [data-quick-media]")) {
          gsap.killTweensOf(el);
          el.style.removeProperty("clip-path");
          el.style.removeProperty("transform");
        }
        delete track.dataset.quickState;
      };

      if (reduce) {
        stateRef.current = lightAll(stateRef.current, anchors);
        for (const anchor of anchors) paint(anchor.key, true);
        for (const el of tiles) {
          revealedRef.current.add(el.dataset.quickKey ?? "");
          showThumbs(el.dataset.quickKey ?? "", false);
        }
        drive(1);
        onDepthRef.current?.(1, geometry);
        track.dataset.quickState = "still";
        return clear;
      }

      track.dataset.quickState = "armed";
      const proxy = { depth: stateRef.current.mark };
      const step = () => {
        drive(proxy.depth);
        const next = lightUpTo(stateRef.current, anchors, proxy.depth);
        stateRef.current = next.state;
        for (const key of next.lit) paint(key, true);
      };
      for (const anchor of anchors) paint(anchor.key, stateRef.current.lit.has(anchor.key));
      for (const el of tiles) {
        const key = el.dataset.quickKey ?? "";
        if (revealedRef.current.has(key)) showThumbs(key, false);
        else hideThumbs(key);
      }
      step();
      const chase = gsap.to(proxy, { depth: proxy.depth, duration: chaseS, ease: QUICK_MOTION.chaseEase, paused: true, onUpdate: step });

      let measured = false;
      const follow = (self: ScrollTrigger) => {
        const rect = track.getBoundingClientRect();
        const atEnd = self.scroll() >= ScrollTrigger.maxScroll(window) - 2;
        const at = (line: number) => readingDepth({ trackTop: rect.top, trackHeight: rect.height, viewportHeight: window.innerHeight, line, atEnd });
        const live = at(QUICK_MOTION.readingLine);
        reveal(atEnd || !measured ? 1 : QUICK_MOTION.revealLine, measured);
        onDepthRef.current?.(live, geometry);
        const raised = raiseMark(stateRef.current, measured ? live : at(1));
        if (!measured) {
          measured = true;
          stateRef.current = raised.state;
          proxy.depth = raised.state.mark;
          step();
        } else if (raised.moved) {
          stateRef.current = raised.state;
          chase.resetTo("depth", raised.state.mark, proxy.depth);
        }
        if (stateRef.current.mark >= 1 && revealedRef.current.size >= tiles.length && !onDepthRef.current) queueMicrotask(() => self.kill());
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
  }, [trackRef, geometry, runKey, speed, forceReduced, marks]);
}
