"use client";

import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { photoMoveIn, photoMoveOut, photoWipeIn, photoWipeOut, sweepInsets, textIn, textOut, type Span } from "./reveal";
import { EASES, type Settings } from "./settings";
import { remainingAfter, ROTATOR_VISIBLE, rotatorRuns, wrap } from "./stage";

// A group of photos taking turns in one frame: the desktop row (round five)
// and, from round six, a phone page's stage. One clock and one change for
// both. The clock loops on a timer that starts after the landing and the
// start delay, and stops while the frame is held (hovered or touched,
// keyboard-focused, paused, mostly off screen, or on a page that is not the
// current one), resuming with the time it had left; under reduced motion it
// never turns on its own and a step is instant. The change is the photo mask
// in the rotator's direction (left to right: one clip edge crosses the frame,
// the new photo left of it, the old right of it; bottom up: the new photo
// wipes up as the old clears) or a cross-fade, the caption changing with it
// in the caption's direction. React only says which photo is current; GSAP
// writes the change and clears what it wrote.
//
// The markup under rootRef: [data-rotator-layer] per photo (each at its own
// box inside the frame), [data-rotator-media] inside each for the settle,
// and [data-rotator-caption] per photo when the group has captions.

type Options = {
  count: number;
  s: Settings;
  reduced: boolean;
  paused?: boolean;
  hovered?: boolean;
  focused?: boolean;
  // A phone page's rotator runs only on the current page.
  active?: boolean;
};

const WRITTEN = "clipPath,opacity,visibility,transform,zIndex";

export function useRotator(rootRef: RefObject<HTMLElement | null>, frameRef: RefObject<HTMLElement | null>, { count, s, reduced, paused = false, hovered = false, focused = false, active = true }: Options) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalMs = Math.round(s.rotateSeconds * 1000);
  const remaining = useRef(intervalMs);
  const shown = useRef(0);
  const change = useRef<gsap.core.Timeline | null>(null);
  const runs = rotatorRuns({ count, reduced, started, paused, hovered, focused, visible: visible && active });

  useEffect(() => {
    const id = window.setTimeout(() => setStarted(true), s.landingMs + s.rotateDelayMs);
    return () => window.clearTimeout(id);
  }, [s.landingMs, s.rotateDelayMs]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= ROTATOR_VISIBLE - 0.01), { threshold: [0, ROTATOR_VISIBLE, 0.66, 1] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [frameRef]);

  // A new photo gets the whole interval; a stopped timer keeps what it had
  // left. The reset runs before the timer, so a change starts it full.
  useEffect(() => {
    remaining.current = intervalMs;
  }, [index, intervalMs]);

  useEffect(() => {
    if (!runs) return;
    const startedAt = performance.now();
    const id = window.setTimeout(() => setIndex((i) => wrap(i + 1, count)), remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = remainingAfter(remaining.current, performance.now() - startedAt);
    };
  }, [runs, index, intervalMs, count]);

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
    if (reduced || s.rotateMs <= 0 || !incoming || !outgoing) return;

    const duration = s.rotateMs / 1000;
    const fade = s.rotateStyle === "fade";
    const ease = fade ? "none" : EASES[s.ease].gsap;
    const settle = 1 + s.settle / 100;
    const [captionIn, captionOut] = [captions[index], captions[from]];
    // The old photo and caption stay drawn under the new ones until the
    // change is done; the stylesheet hides every one that is not current.
    gsap.set(outgoing, { visibility: "visible", zIndex: 1 });
    gsap.set(incoming, { zIndex: 2 });
    if (captionOut) gsap.set(captionOut, { visibility: "visible" });
    const tl = gsap.timeline({ onComplete: () => gsap.set(written, { clearProps: WRITTEN }) });
    change.current = tl;

    if (fade) {
      tl.fromTo([incoming, captionIn].filter(Boolean), { opacity: 0 }, { opacity: 1, duration, ease }, 0);
      tl.fromTo([outgoing, captionOut].filter(Boolean), { opacity: 1 }, { opacity: 0, duration, ease }, 0);
      return;
    }
    if (s.photoMask === "wipe") {
      if (s.rotateDirection === "ltr") {
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
      } else {
        const [wipeIn, wipeOut] = [photoWipeIn("up"), photoWipeOut("up")];
        tl.fromTo(incoming, { clipPath: wipeIn.from }, { clipPath: wipeIn.to, duration, ease }, 0);
        tl.fromTo(outgoing, { clipPath: wipeOut.from }, { clipPath: wipeOut.to, duration, ease }, 0);
      }
      if (settle > 1 && media[index]) tl.fromTo(media[index], { scale: settle }, { scale: 1, duration, ease }, 0);
    } else {
      const [moveIn, moveOut] = [photoMoveIn(s.rotateDirection), photoMoveOut(s.rotateDirection)];
      if (media[index]) tl.fromTo(media[index], { ...moveIn.from, scale: settle }, { ...moveIn.to, scale: 1, duration, ease }, 0);
      if (media[from]) tl.fromTo(media[from], moveOut.from, { ...moveOut.to, duration, ease }, 0);
    }
    if (captionIn && captionOut) {
      const [enter, leave] = [textIn(s.captionDirection), textOut(s.captionDirection)];
      tl.fromTo(captionIn, enter.from, { ...enter.to, duration, ease }, 0);
      tl.fromTo(captionOut, leave.from, { ...leave.to, duration, ease }, 0);
    }
    // Only the photo index starts a change; the settings are read as it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => () => void change.current?.kill(), []);

  // Steps to a photo (wrapping) and says which it landed on.
  const step = (next: number) => {
    const target = wrap(next, count);
    setIndex(target);
    return target;
  };

  return { index, step, runs, intervalMs };
}
