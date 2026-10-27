"use client";

import { useEffect, useRef } from "react";

// A phone's chrome is the logo (top left) and the Menu pill (top right) and
// nothing else, fixed over the page: with no top bar behind them, scrolling
// paragraphs run under both. On narrow screens only, this is a soft fade of the
// page's background token, 72px tall, behind them (z 30, under the logo and the
// pill at 40 and under the menu's scrim at 35), no blur, no pointer
// (app/globals.css .top-fade). It steps aside while the Coil's stage is in that
// band: the stage's field is a picture the fade would visibly cut. The check is
// a measurement on scroll and resize, written to the element's own attribute so
// nothing renders.
export const TOP_FADE_PX = 72;

export function TopFade() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fade = ref.current;
    if (!fade) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const stage = document.querySelector("[data-coil-stage]");
      const box = stage?.getBoundingClientRect();
      const over = !!box && box.height > 0 && box.top < TOP_FADE_PX && box.bottom > 0;
      if (over) fade.setAttribute("data-over-coil", "");
      else fade.removeAttribute("data-over-coil");
    };
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    soon();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    // The stage mounts and sizes after the first paint (the scene's chunk, a deal).
    const observer = new ResizeObserver(soon);
    observer.observe(document.documentElement);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      observer.disconnect();
    };
  }, []);
  return <div ref={ref} aria-hidden="true" data-top-fade="" className="top-fade" />;
}
