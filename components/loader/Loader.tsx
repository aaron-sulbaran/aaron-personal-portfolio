"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { siteContent } from "@/lib/content";
import { LOADER_CSS, LOADER_NOSCRIPT, LOADER_SKIP_SCRIPT } from "./loaderMarkup";
import { runLoader } from "./runLoader";

// The Coil's loader: a giant "Aaron" (with "Hi, I'm" above it) whose letters
// fill with the accent from the baseline up as the page's real assets resolve
// (lib/loader/progress), a small number at the top, and a continuity exit
// that shrinks and dims the lockup onto the one the scene draws behind the
// helix. Under it, from first paint, the resting lockup: the exit's landed
// pose, where the canvas will draw it, so the fallback h1 never shows while a
// scene is on its way.
//
// The overlay is in the server's HTML, armed by CSS alone: the pane shows
// only after 250ms, so a fast load never flashes it. Hydration then moves the
// node itself to <body> (a createPortal could not render on the server), out
// of the page's z-10 content layer, so it covers the header at z 60. From
// there it runs imperatively, one rAF loop, no per-frame React state.
//
//   off   a fast start (deep reload): gone before paint, the h1 as before
//   on    tally done before the guard ends: the resting lockup holds until
//         the scene has drawn, then hands to the canvas in one frame and the
//         entrance plays; else fill to 100, hold 150ms, then the continuity
//         exit (800ms, the site ease) that lands the lockup and hands it to
//         the canvas in one frame; the entrance starts 200ms before the exit
//         ends
//   on + reduced motion (or no scene to land on): no resting lockup, the
//         name in accent, the number counts, a 300ms fade
//
// The number shows only for loads still running at 600ms, never a status word.

// scene: a scene has claimed the entrance (it may still fail to draw).
export type LoaderMode = { kind: "pending" } | { kind: "off" } | { kind: "on"; reducedMotion: boolean; scene: boolean };

type Props = {
  mode: LoaderMode;
  // The pane is being handed to the hero: the entrance starts at startMs (the
  // performance.now() clock), and nameFromLoader says the loader lands the name.
  onReveal: (startMs: number, nameFromLoader: boolean) => void;
  // The hero shows the canvas (data-scene="on"): the DOM lockup may leave.
  sceneOn: boolean;
};

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;


export function Loader({ mode, onReveal, sceneOn }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const greetRef = useRef<HTMLSpanElement>(null);
  const restRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const onRevealRef = useRef(onReveal);
  const mountedAtRef = useRef(0);
  const sceneOnRef = useRef(sceneOn);

  useEffect(() => {
    onRevealRef.current = onReveal;
    sceneOnRef.current = sceneOn;
  });

  // Out of the content layer to <body>, before paint; back home before React
  // removes it, so its own removeChild finds it where it left it.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const home = root?.parentNode;
    if (!root || !home) return;
    mountedAtRef.current = performance.now();
    // Re-inserting a node restarts its CSS animations, which would re-arm the
    // guard (and flash a loader already showing), so they carry their clocks over.
    const clocks = root.getAnimations?.({ subtree: true }).map((a) => ({
      name: (a as CSSAnimation).animationName,
      target: (a.effect as KeyframeEffect | null)?.target ?? null,
      time: a.currentTime,
    }));
    root.setAttribute("data-js", "");
    document.body.appendChild(root);
    if (clocks?.length) {
      root.getAnimations({ subtree: true }).forEach((a) => {
        const name = (a as CSSAnimation).animationName;
        const target = (a.effect as KeyframeEffect | null)?.target ?? null;
        const before = clocks.find((c) => c.name === name && c.target === target);
        if (before && typeof before.time === "number") a.currentTime = before.time;
      });
    }
    return () => {
      if (root.parentNode !== home) home.appendChild(root);
    };
  }, []);

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || mode.kind === "pending") return;
    if (mode.kind === "off") {
      root.setAttribute("data-state", "gone");
      return;
    }
    // This page decides from here on (a later client visit must not inherit the skip).
    document.documentElement.removeAttribute("data-coil-loader");
    const resting = !mode.reducedMotion && mode.scene;
    // No scene to hand to: the h1 carries the hero from this paint.
    if (!resting) root.setAttribute("data-rest", "off");
    const parts = {
      root,
      pane: paneRef.current!,
      name: nameRef.current!,
      base: baseRef.current!,
      fill: fillRef.current!,
      count: countRef.current!,
      num: numRef.current!,
      bg: bgRef.current!,
      greet: greetRef.current!,
      rest: restRef.current!,
    };
    return runLoader(
      parts,
      { reduced: mode.reducedMotion, resting, sceneShown: () => sceneOnRef.current },
      (startMs, nameFromLoader) => onRevealRef.current(startMs, nameFromLoader),
      mountedAtRef.current,
    );
  }, [mode.kind]);

  const { name, progressLabel } = siteContent.loader;
  const { greeting, name: heroName } = siteContent.hero;

  return (
    <div ref={rootRef} className="coil-loader">
      <style href="coil-loader" precedence="medium">
        {LOADER_CSS}
      </style>
      <div hidden dangerouslySetInnerHTML={{ __html: `<script>${LOADER_SKIP_SCRIPT}</script>` }} />
      <noscript dangerouslySetInnerHTML={{ __html: LOADER_NOSCRIPT }} />
      <div ref={restRef} className="coil-loader__rest" aria-hidden="true">
        <span className="coil-loader__rest-greet">{greeting}</span>
        <span className="coil-loader__rest-name">{heroName}</span>
      </div>
      <div ref={bgRef} className="coil-loader__bg" />
      <div
        ref={paneRef}
        className="coil-loader__pane"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <div ref={nameRef} className="coil-loader__name" aria-hidden="true">
          <span ref={greetRef} className="coil-loader__greet">
            {greeting}
          </span>
          <span ref={baseRef} className="coil-loader__glyph coil-loader__base">
            {name}
          </span>
          <div ref={fillRef} className="coil-loader__fill">
            <span className="coil-loader__glyph">{name}</span>
          </div>
        </div>
        <div ref={countRef} className="coil-loader__count" aria-hidden="true">
          <span ref={numRef} className="coil-loader__num">
            0
          </span>
          %
        </div>
      </div>
    </div>
  );
}
