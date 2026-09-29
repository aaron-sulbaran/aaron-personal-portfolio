"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { siteContent } from "@/lib/content";
import { LOADER_CSS, LOADER_NOSCRIPT, LOADER_SKIP_SCRIPT } from "./loaderMarkup";
import { runLoader } from "./runLoader";

// The Coil's loader: a giant "Aaron" whose letters fill with the accent from
// the baseline up as the page's real assets resolve (lib/loader/progress), a
// small number at the top, and a continuity exit that shrinks and dims the
// name onto the one the scene draws behind the helix.
//
// The overlay is in the server's HTML, armed by CSS alone: nothing shows for
// the first 250ms, so a fast load never flashes it. Hydration then moves the
// node itself to <body> (a createPortal could not render on the server), out
// of the page's z-10 content layer, so it covers the header at z 60. From
// there it runs imperatively, one rAF loop, no per-frame React state.
//
//   off   a fast start (deep reload): gone before paint
//   on    tally done before the guard ends: gone, the entrance plays at once;
//         else fill to 100, hold 150ms, then the continuity exit (800ms, the
//         site ease) that lands the name and hands it to the canvas in one
//         frame; the entrance starts 200ms before the exit ends
//   on + reduced motion (or no scene to land on): the name in accent, the
//         number counts, a 300ms fade
//
// The number shows only for loads still running at 600ms, never a status word.

export type LoaderMode = { kind: "pending" } | { kind: "off" } | { kind: "on"; reducedMotion: boolean };

type Props = {
  mode: LoaderMode;
  // The pane is being handed to the hero: the entrance starts at startMs (the
  // performance.now() clock), and nameFromLoader says the loader lands the name.
  onReveal: (startMs: number, nameFromLoader: boolean) => void;
};

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;


export function Loader({ mode, onReveal }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const onRevealRef = useRef(onReveal);
  const mountedAtRef = useRef(0);

  useEffect(() => {
    onRevealRef.current = onReveal;
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
    const parts = {
      root,
      pane: paneRef.current!,
      name: nameRef.current!,
      base: baseRef.current!,
      fill: fillRef.current!,
      count: countRef.current!,
      num: numRef.current!,
      bg: bgRef.current!,
    };
    return runLoader(
      parts,
      mode.kind === "on" && mode.reducedMotion,
      (startMs, nameFromLoader) => onRevealRef.current(startMs, nameFromLoader),
      mountedAtRef.current,
    );
  }, [mode.kind]);

  const { name, progressLabel } = siteContent.loader;

  return (
    <div ref={rootRef} className="coil-loader">
      <style href="coil-loader" precedence="medium">
        {LOADER_CSS}
      </style>
      <div hidden dangerouslySetInnerHTML={{ __html: `<script>${LOADER_SKIP_SCRIPT}</script>` }} />
      <noscript dangerouslySetInnerHTML={{ __html: LOADER_NOSCRIPT }} />
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
