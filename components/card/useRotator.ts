"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { GALLERY } from "@/lib/gallery/constants";
import { sweepInsets, textIn, textOut, type Span } from "@/lib/gallery/reveal";
import { remainingAfter, rotatorRuns, wrap } from "@/lib/gallery/rotator";

// A group of photos taking turns in one frame: the desktop row and a phone
// page's stage share this clock and this change (the gallery lab's round six).
// The clock starts after the landing and the start delay, loops, holds while
// the group is held, paused, mostly off screen or (on a phone) on a page that
// is not current, and resumes with the time it had left; under reduced motion
// it never turns on its own and a step is instant. The change: one clip edge
// crosses the frame from the left in the frame's coordinates, the new photo
// left of it and the old one right of it, the new photo settling as it comes;
// the old caption's clip closes left to right first and the new one's opens
// after it. React says which photo is current; GSAP writes the change and
// clears what it wrote. The markup under rootRef: [data-rotator-layer] per
// photo, [data-rotator-media] inside each, [data-rotator-caption] per photo.

type Options = { count: number; reduced: boolean; paused?: boolean; held?: boolean; active?: boolean };

const WRITTEN = "clipPath,visibility,transform,zIndex";

export function useRotator(rootRef: RefObject<HTMLElement | null>, frameRef: RefObject<HTMLElement | null>, { count, reduced, paused = false, held = false, active = true }: Options) {
  const { intervalMs, changeMs, delayMs, visible: share, captionOut, captionInAt } = GALLERY.rotate;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const remaining = useRef<number>(intervalMs);
  const shown = useRef(0);
  const change = useRef<gsap.core.Timeline | null>(null);
  const runs = rotatorRuns({ count, reduced, started, paused, held, visible: visible && active });

  useEffect(() => {
    const id = window.setTimeout(() => setStarted(true), GALLERY.mask.landingMs + delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= share - 0.01), { threshold: [0, share, 0.66, 1] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [frameRef, share]);

  // A new photo gets the whole interval; this runs before the timer below, so
  // a change starts it full.
  useEffect(() => {
    remaining.current = intervalMs;
  }, [index, intervalMs, reduced]);

  // Reduced motion turning on mid-change ends the sweep at once and clears
  // what the change wrote.
  useEffect(() => {
    if (!reduced) return;
    change.current?.kill();
    change.current = null;
    const root = rootRef.current;
    if (!root) return;
    const written = ["data-rotator-layer", "data-rotator-media", "data-rotator-caption"].flatMap((attr) => [...root.querySelectorAll<HTMLElement>(`[${attr}]`)]);
    gsap.set(written, { clearProps: WRITTEN });
  }, [reduced, rootRef]);

  useEffect(() => {
    if (!runs) return;
    const startedAt = performance.now();
    const id = window.setTimeout(() => setIndex((i) => wrap(i + 1, count)), remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = remainingAfter(remaining.current, performance.now() - startedAt);
    };
  }, [runs, index, count]);

  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = index;
    const root = rootRef.current;
    if (from === index || !root) return;
    const pick = (attr: string) => [...root.querySelectorAll<HTMLElement>(`[${attr}]`)];
    const layers = pick("data-rotator-layer");
    const media = pick("data-rotator-media");
    const captions = pick("data-rotator-caption");
    const written = [...layers, ...media, ...captions];
    change.current?.kill();
    gsap.set(written, { clearProps: WRITTEN });
    const [incoming, outgoing] = [layers[index], layers[from]];
    if (reduced || !incoming || !outgoing) return;
    const duration = changeMs / 1000;
    const ease = GALLERY.ease.gsap;
    const [captionIn, captionLeaving] = [captions[index], captions[from]];
    // The old photo and caption stay drawn under the new ones until the change
    // is done; the stylesheet hides every one that is not current.
    gsap.set(outgoing, { visibility: "visible", zIndex: 1 });
    gsap.set(incoming, { zIndex: 2 });
    if (captionLeaving) gsap.set(captionLeaving, { visibility: "visible" });
    const tl = gsap.timeline({ onComplete: () => gsap.set(written, { clearProps: WRITTEN }) });
    change.current = tl;
    const frameWidth = frameRef.current?.offsetWidth ?? incoming.offsetWidth;
    const span = (el: HTMLElement): Span => ({ left: el.offsetLeft, width: el.offsetWidth });
    const sweep = { progress: 0 };
    const draw = () => {
      const insets = sweepInsets(sweep.progress, frameWidth, span(incoming), span(outgoing));
      incoming.style.clipPath = insets.incoming;
      outgoing.style.clipPath = insets.outgoing;
    };
    draw();
    tl.to(sweep, { progress: 1, duration, ease, onUpdate: draw }, 0);
    if (media[index]) tl.fromTo(media[index], { scale: GALLERY.mask.settle }, { scale: 1, duration, ease }, 0);
    if (captionIn && captionLeaving) {
      const [enter, leave] = [textIn(GALLERY.direction), textOut(GALLERY.direction)];
      tl.fromTo(captionLeaving, leave.from, { ...leave.to, duration: duration * captionOut, ease }, 0);
      tl.fromTo(captionIn, enter.from, { ...enter.to, duration: duration * (1 - captionInAt), ease }, duration * captionInAt);
    }
    // Only a new index starts a change; the rest is read as it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => () => void change.current?.kill(), []);

  // Steps to a photo (wrapping) and says which it landed on.
  const step = (next: number) => {
    const target = wrap(next, count);
    setIndex(target);
    return target;
  };

  return { index, step, runs };
}
