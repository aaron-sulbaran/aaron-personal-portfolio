"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import { LOADER_REPLAY_EVENT } from "@/lib/home/introReplay";
import { lockupVars } from "@/lib/home/lockup";
import { runIntroLoader } from "./runIntroLoader";

// The loader: "Hi, I'm" over a giant "Aaron" whose letters fill with the accent
// from the baseline up as the page's real assets resolve, a small number for a
// slow load, and then the shrink that lands the lockup on page 1's heading. The
// markup is in the server's HTML and armed by CSS alone (app/globals.css, from
// the head script's <html data-intro-loader="on">), so it covers the page from
// first paint, and it sits at body level (the page renders it outside the
// content layer) so its z 60 covers the header. Hydration only runs it: one rAF
// loop, no per-frame React state (components/home/loader/runIntroLoader.ts).
// Unarmed, it does nothing and is not there: reduced motion, a deep load, no
// JavaScript, a client visit back to the home.
export function IntroLoader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  // Each replay (the lab's button) runs it again from a clean start.
  const [run, setRun] = useState(0);
  const { greeting, name } = siteContent.hero;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const replay = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      window.scrollTo({ top: 0, behavior: "instant" });
      setRun((n) => n + 1);
    };
    window.addEventListener(LOADER_REPLAY_EVENT, replay);
    return () => window.removeEventListener(LOADER_REPLAY_EVENT, replay);
  }, []);

  useEffect(() => {
    const parts = { root: rootRef.current, ground: groundRef.current, lockup: lockupRef.current, count: countRef.current, num: numRef.current };
    if (!parts.root || !parts.ground || !parts.lockup || !parts.count || !parts.num) return;
    // Armed by the head script on a fresh load, or by a replay.
    if (run === 0 && document.documentElement.dataset.introLoader !== "on") return;
    return runIntroLoader({ root: parts.root, ground: parts.ground, lockup: parts.lockup, count: parts.count, num: parts.num });
  }, [run]);

  return (
    <div
      ref={rootRef}
      data-intro-loader-root=""
      className="intro-loader"
      style={lockupVars() as CSSProperties}
      role="progressbar"
      aria-label={siteContent.loader.progressLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div ref={groundRef} className="intro-loader__ground" />
      <div ref={lockupRef} className="name-lockup intro-loader__lockup" aria-hidden="true">
        <span className="name-lockup__greet">{greeting}</span>
        <span className="name-lockup__name">
          <span className="intro-loader__base">{name}</span>
          <span className="intro-loader__fill">{name}</span>
        </span>
      </div>
      <div ref={countRef} className="intro-loader__count" aria-hidden="true">
        <span ref={numRef}>0</span>%
      </div>
    </div>
  );
}
