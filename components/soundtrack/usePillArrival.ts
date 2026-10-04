"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { DOCK, setDocked, takeDockSource } from "@/lib/waveform/dock";

// The pill's arrival at the dock and its return (spec section 5). Timed, not
// scrubbed: one GSAP tween on the pill's inner wrapper, never on the fixed
// root, and every transform is cleared at rest so the hover preview's own
// transitions own the capsule again.
//
//   Arrival: born at the band control the visitor pressed (or the one it
//   last returned into), while that is on screen: from its centre at 0.6
//   scale and 0.4 opacity to the dock over DOCK.arriveMs on the site's ease
//   (--ease-out is a quint out, GSAP's power4.out). Otherwise a 12px rise.
//   Return: back into that control (or the band's controls) if on screen,
//   shrinking and fading as it goes; otherwise a fade down. The band's
//   controls fade out while the pill is out (setDocked) and back once it is in.
//   Reduced motion: opacity only, both ways.
//
// A reversal mid-flight tweens from wherever the pill is, never jumps.

const SOURCE_SCALE = 0.6;
const SOURCE_OPACITY = 0.4;
const RISE_PX = 12;
const RISE_MS = 420;
const RETURN_MS = 480;
const FADE_MS = 300;

type Rect = { left: number; top: number; width: number; height: number; bottom: number };

const centre = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const onScreen = (r: Rect) => r.bottom > 0 && r.top < window.innerHeight;
const toViewport = (page: DOMRect): Rect => {
  const top = page.y - window.scrollY;
  return { left: page.x - window.scrollX, top, width: page.width, height: page.height, bottom: top + page.height };
};
const bandControls = (): DOMRect | null => {
  const r = document.querySelector("[data-band-controls]")?.getBoundingClientRect();
  return r ? new DOMRect(r.x + window.scrollX, r.y + window.scrollY, r.width, r.height) : null;
};

// `present`: the root shows (the pill is out or on its way back). `landed`:
// the arrival has come to rest, which is when the label's hold starts.
export function usePillArrival(target: RefObject<HTMLElement | null>, shown: boolean, reduce: boolean) {
  const [exiting, setExiting] = useState(false);
  const [landed, setLanded] = useState(false);
  const [previous, setPrevious] = useState(shown);
  const home = useRef<DOMRect | null>(null); // page coordinates
  const tween = useRef<gsap.core.Tween | null>(null);
  const out = useRef(false);
  const still = useRef(reduce);

  if (shown !== previous) {
    setPrevious(shown);
    setExiting(!shown);
    setLanded(false);
  }

  useLayoutEffect(() => {
    still.current = reduce;
  }, [reduce]);

  useLayoutEffect(() => {
    const el = target.current;
    if (shown === out.current) return;
    out.current = shown;
    const running = tween.current?.isActive() ?? false;
    tween.current?.kill();
    tween.current = null;

    // No wrapper (the phone query matched): nothing to tween, nothing docked.
    if (!el) {
      out.current = false;
      setDocked(false);
      gsap.delayedCall(0, () => setExiting(false));
      return;
    }

    if (shown) {
      setDocked(true);
      const pressed = takeDockSource();
      if (pressed) home.current = pressed;
      const land = () => {
        gsap.set(el, { clearProps: "transform,opacity" });
        tween.current = null;
        setLanded(true);
      };
      if (still.current) {
        tween.current = gsap.fromTo(el, { opacity: running ? gsap.getProperty(el, "opacity") : 0 }, { opacity: 1, duration: FADE_MS / 1000, ease: "none", onComplete: land });
        return;
      }
      if (running) {
        tween.current = gsap.to(el, { x: 0, y: 0, scale: 1, opacity: 1, duration: DOCK.arriveMs / 1000, ease: "power4.out", onComplete: land });
        return;
      }
      const source = home.current ? toViewport(home.current) : null;
      if (source && onScreen(source)) {
        gsap.set(el, { clearProps: "transform,opacity" });
        const from = centre(source);
        const to = centre(el.getBoundingClientRect());
        tween.current = gsap.fromTo(
          el,
          { x: from.x - to.x, y: from.y - to.y, scale: SOURCE_SCALE, opacity: SOURCE_OPACITY },
          { x: 0, y: 0, scale: 1, opacity: 1, duration: DOCK.arriveMs / 1000, ease: "power4.out", onComplete: land },
        );
      } else {
        tween.current = gsap.fromTo(el, { y: RISE_PX, opacity: 0 }, { y: 0, opacity: 1, duration: RISE_MS / 1000, ease: "power2.out", onComplete: land });
      }
      return;
    }

    // The wrapper keeps its 0 opacity until the next arrival sets its own:
    // clearing it here would flash the pill at rest for the frame before
    // React hides the root.
    const gone = () => {
      gsap.set(el, { clearProps: "transform" });
      tween.current = null;
      setDocked(false);
      setExiting(false);
    };
    if (still.current) {
      tween.current = gsap.to(el, { opacity: 0, duration: FADE_MS / 1000, ease: "none", onComplete: gone });
      return;
    }
    const page = home.current ?? bandControls();
    const dest = page ? toViewport(page) : null;
    if (page && dest && onScreen(dest)) {
      home.current = page;
      const now = el.getBoundingClientRect();
      const rest = { x: centre(now).x - Number(gsap.getProperty(el, "x")), y: centre(now).y - Number(gsap.getProperty(el, "y")) };
      const into = centre(dest);
      tween.current = gsap.to(el, {
        x: into.x - rest.x,
        y: into.y - rest.y,
        scale: SOURCE_SCALE,
        opacity: 0,
        duration: RETURN_MS / 1000,
        ease: "power3.in",
        onComplete: gone,
      });
    } else {
      tween.current = gsap.to(el, { y: RISE_PX, opacity: 0, duration: FADE_MS / 1000, ease: "power2.in", onComplete: gone });
    }
  }, [shown, target]);

  useLayoutEffect(
    () => () => {
      tween.current?.kill();
      setDocked(false);
    },
    [],
  );

  return { present: shown || exiting, landed };
}
