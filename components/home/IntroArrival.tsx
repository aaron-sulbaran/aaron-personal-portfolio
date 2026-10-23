"use client";

import { useEffect } from "react";
import { arrivalPlan } from "@/lib/home/introArrival";
import { getIntroKnobs } from "@/lib/home/introKnobs";
import { LOADER_REPLAY_EVENT } from "@/lib/home/introReplay";

// Plays page 1's words arriving, once per page load (slice 5). The head script
// (lib/home/introWordsInit.ts) sets <html data-intro-words="wait"> before the
// first paint on a fresh load, and app/globals.css holds the [data-arrive]
// items at their start meanwhile. This sets it to "play" the moment the loader
// has handed the name over (the loader's own attribute reaches "done", or the
// loader was never armed and the page has hydrated), which starts each item's
// transition at its step's delay, and clears the attribute once the last one
// is done so no transition or will-change lingers. Reduced motion, live, ends it
// at once. Nothing replays on scroll: the attribute is only ever "wait" before
// a load's one play. The lab's loader replay (dev only) holds the words again
// and plays them after that run's handoff. Renders nothing.
const WORDS = "data-intro-words";
const LOADER = "data-intro-loader";

export function IntroArrival() {
  useEffect(() => {
    const html = document.documentElement;
    if (html.getAttribute(WORDS) !== "wait") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    // A replay holds the words until it has seen its loader start, so a loader
    // that has not begun yet is not mistaken for one that is done.
    let sawLoader = html.getAttribute(LOADER) === "on" || html.getAttribute(LOADER) === "shrink";
    let expectLoader = false;

    const loaderRunning = () => {
      const value = html.getAttribute(LOADER);
      return value === "on" || value === "shrink";
    };
    const clear = () => {
      window.clearTimeout(timer);
      html.removeAttribute(WORDS);
    };
    const play = () => {
      if (html.getAttribute(WORDS) !== "wait") return;
      if (motion.matches) return clear();
      html.setAttribute(WORDS, "play");
      const { doneMs } = arrivalPlan({
        arrivalTotalMs: getIntroKnobs().arrivalTotalMs,
        arrivalStaggerMs: getIntroKnobs().arrivalStaggerMs,
        arrivalRisePx: getIntroKnobs().arrivalRisePx,
      });
      window.clearTimeout(timer);
      timer = window.setTimeout(clear, doneMs + 150);
    };
    const onLoader = () => {
      if (loaderRunning()) {
        sawLoader = true;
        expectLoader = false;
        return;
      }
      if (!expectLoader && sawLoader) play();
    };
    const observer = new MutationObserver(onLoader);
    observer.observe(html, { attributes: true, attributeFilter: [LOADER] });

    const onMotion = () => {
      if (motion.matches) clear();
    };
    motion.addEventListener("change", onMotion);

    // Dev only: the lab's loader replay runs the loader again, and the words wait for it.
    const onReplay = () => {
      if (motion.matches) return;
      window.clearTimeout(timer);
      html.setAttribute(WORDS, "wait");
      sawLoader = false;
      expectLoader = true;
    };
    window.addEventListener(LOADER_REPLAY_EVENT, onReplay);

    // Not armed for a loader (the lab has it off): the page has hydrated, so the words come now.
    const frame = loaderRunning() ? 0 : requestAnimationFrame(play);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      window.removeEventListener(LOADER_REPLAY_EVENT, onReplay);
    };
  }, []);
  return null;
}
