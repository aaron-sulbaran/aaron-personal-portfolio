"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { siteContent } from "@/lib/content";
import { gsap } from "@/lib/gsap";
import { siteEase } from "@/lib/coil/motion";
import { LOADER, coilDebugFlags, displayPercent, homeLoad, reportHomeLoad } from "@/lib/loader/progress";
import { landName, nameTarget } from "@/lib/loader/handoff";
import { landing, landingGradient, landingOpacity, landingTransform, parseRgb } from "@/lib/loader/continuity";
import { LOADER_CSS, LOADER_NOSCRIPT, LOADER_SKIP_SCRIPT } from "./loaderMarkup";

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

// How long a CSS animation on `el` has run, or null when it cannot be read.
function animationTime(el: Element, name: string): number | null {
  if (typeof el.getAnimations !== "function") return null;
  const found = el.getAnimations().find((a) => (a as CSSAnimation).animationName === name);
  const time = found?.currentTime;
  return typeof time === "number" ? time : null;
}

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

type LoaderParts = {
  root: HTMLDivElement;
  pane: HTMLDivElement;
  name: HTMLDivElement;
  base: HTMLSpanElement;
  fill: HTMLDivElement;
  count: HTMLDivElement;
  num: HTMLSpanElement;
  bg: HTMLDivElement;
};

// The loader's run: the tally loop, the guard, the hold and the exit.
// Returns the cleanup.
function runLoader(
  parts: LoaderParts,
  reduced: boolean,
  reveal: (startMs: number, nameFromLoader: boolean) => void,
  mountedAt: number,
): () => void {
  const { root, pane, count, num } = parts;
  const tally = homeLoad();
  let disposed = false;
  let raf = 0;
  let shown = 0; // the displayed progress, easing toward the tally
  let last = performance.now();
  let finishing = false;
  let timeline: gsap.core.Timeline | null = null;
  let holdTimer = 0;
  const note = debugLog(root);
  note("run", { reduced, items: tally ? tally.progress() : null });

  // The name's face: Profa's real metrics, once loaded, then the tally hears it.
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
  Promise.all([document.fonts.load(`900 100px ${family}`), document.fonts.ready])
    .then(() => {
      if (disposed) return;
      measureName(pane, family);
      reportHomeLoad("fonts");
    })
    .catch(() => reportHomeLoad("fonts"));

  const paint = (done: boolean) => {
    pane.style.setProperty("--p", shown.toFixed(4));
    const percent = displayPercent(shown, done && shown >= 1);
    num.textContent = String(percent);
    pane.setAttribute("aria-valuenow", String(percent));
    // Full: the whole name in the accent (no paper hairline above the clip).
    if (shown >= 1) root.setAttribute("data-full", "");
  };

  const guardPassed = () => {
    const time = animationTime(root, "coil-loader-in");
    return (time ?? performance.now() - mountedAt) >= LOADER.guardMs;
  };

  const gone = () => {
    root.setAttribute("data-state", "gone");
  };

  const tick = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
    last = now;
    tally?.check(now);
    const target = tally ? tally.progress() : 1;
    const done = tally ? tally.done() : true;
    // A short, honest ease toward the tally, never slower than 1.5 per second.
    shown += Math.max((target - shown) * (1 - Math.exp(-dt * 12)), Math.min(target - shown, 1.5 * dt));
    if (target - shown < 0.002) shown = target;
    paint(done);
    note("frame", { tally: target, shown, done });
    if (done && !finishing) {
      finishing = true;
      if (!guardPassed()) {
        // Everything was ready inside the guard: straight to the hero.
        gone();
        note("skipped");
        reveal(performance.now(), false);
        return;
      }
      const numberTime = animationTime(count, "coil-loader-count");
      if (numberTime !== null && numberTime < LOADER.numberAfterMs) count.setAttribute("data-hidden", "");
      note("done", { numberTime, numberHidden: count.hasAttribute("data-hidden"), gaveUp: tally?.gaveUp() ?? false });
    }
    if (finishing && shown >= 1) {
      note("100");
      holdTimer = window.setTimeout(exit, LOADER.holdMs);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  function exit() {
    if (disposed) return;
    root.setAttribute("data-state", "live");
    root.style.pointerEvents = "none";
    const target = reduced ? null : nameTarget();
    if (!target) {
      // Reduced motion, or no scene to land on: a plain fade.
      const fadeS = LOADER.reducedFadeMs / 1000;
      note("fade");
      reveal(performance.now() + LOADER.reducedFadeMs, false);
      timeline = gsap.timeline({ onComplete: gone });
      timeline.to(root, { opacity: 0, duration: fadeS, ease: "none" });
      return;
    }
    continuity(target);
  }

  function continuity(target: NonNullable<ReturnType<typeof nameTarget>>) {
    const { name, base, fill, bg } = parts;
    const accent = parseRgb(getComputedStyle(fill.firstElementChild ?? fill).color) ?? target.gradient.from;
    const nameStyle = getComputedStyle(name);
    const matrix = new DOMMatrixReadOnly(nameStyle.transform === "none" ? undefined : nameStyle.transform);
    const fontPx = parseFloat(nameStyle.fontSize);
    const capTop = parseFloat(getComputedStyle(pane).getPropertyValue("--capTop")) || 0.11364;
    const box = {
      left: name.offsetLeft,
      top: name.offsetTop,
      width: name.offsetWidth,
      height: name.offsetHeight,
      rotationDeg: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
    };
    const land = landing(box, target);
    const glyphTop = -capTop * fontPx;
    const durationS = LOADER.exitMs / 1000;

    // The fill is complete; the base glyph carries the color from here.
    fill.style.visibility = "hidden";
    base.style.color = "transparent";
    base.style.setProperty("-webkit-background-clip", "text");
    base.style.backgroundClip = "text";
    count.setAttribute("data-exit", "");

    const state = { e: 0, c: 0, bg: 1, count: 1 };
    const apply = () => {
      name.style.transform = landingTransform(land, state.e);
      name.style.opacity = String(landingOpacity(target, state.c));
      base.style.backgroundImage = landingGradient(accent, target, box, glyphTop, state.c);
      bg.style.opacity = String(state.bg);
      count.style.opacity = String(state.count);
    };
    apply();
    note("exit", { land });
    // ?coildebug=handoff: the exit pauses on its last frame (cards held back)
    // until window.__coilLoader.finish(), to compare the frames either side.
    const holdHandoff = coilDebugFlags(window.location.search).has("handoff");
    reveal(performance.now() + (holdHandoff ? 600000 : LOADER.exitMs - LOADER.entranceOverlapMs), true);
    timeline = gsap.timeline({
      onUpdate: apply,
      onComplete: () => {
        // One frame: the canvas draws its name now, the DOM name leaves now.
        landName();
        gone();
        note("handoff");
      },
    });
    timeline.to(state, { e: 1, duration: durationS, ease: siteEase }, 0);
    timeline.to(state, { c: 1, duration: durationS * 0.85, ease: "power1.inOut" }, 0);
    timeline.to(state, { bg: 0, duration: durationS * 0.75, ease: "power1.out" }, 0);
    timeline.to(state, { count: 0, duration: durationS * 0.35, ease: "power1.out" }, 0);
    if (holdHandoff) {
      const running = timeline;
      running.addPause(durationS - 1e-4);
      const host = window as unknown as { __coilLoader?: { finish?: () => void } };
      if (host.__coilLoader) host.__coilLoader.finish = () => running.play();
    }
  }

  return () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(holdTimer);
    timeline?.kill();
  };
}

// Profa's real metrics for "Aaron" at this browser's rendering, as the lab
// does: the ink's width and left bearing, the cap height, and where the cap
// line sits under a line-height 1 box. Kept only when they look sane.
function measureName(pane: HTMLElement, family: string) {
  const g = document.createElement("canvas").getContext("2d");
  if (!g) return;
  g.font = `900 1000px ${family}`;
  const m = g.measureText(siteContent.loader.name);
  const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 1000;
  const inkL = m.actualBoundingBoxLeft / 1000;
  const capR = m.actualBoundingBoxAscent / 1000;
  if (!(inkW > 2 && inkW < 3.5) || !(capR > 0.5 && capR < 0.8)) return;
  pane.style.setProperty("--inkW", inkW.toFixed(5));
  pane.style.setProperty("--inkL", inkL.toFixed(5));
  pane.style.setProperty("--capR", capR.toFixed(5));
  const ascent = m.fontBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent;
  if (Number.isFinite(ascent) && Number.isFinite(descent) && ascent > 0) {
    // Line-height 1: the half-leading splits (1em - content) above and below.
    const baseline = ascent + (1000 - ascent - descent) / 2;
    const capTop = (baseline - m.actualBoundingBoxAscent) / 1000;
    if (capTop > 0 && capTop < 0.3) pane.style.setProperty("--capTop", capTop.toFixed(5));
  }
}

// QA behind ?coildebug: every loader event with its time, plus each time the
// body scroll lock engages or releases, on window.__coilLoader.
type LoaderEvent = { t: number; event: string; data?: unknown };
function debugLog(root: HTMLElement): (event: string, data?: unknown) => void {
  if (!new URLSearchParams(window.location.search).has("coildebug")) return () => {};
  const events: LoaderEvent[] = [];
  const host = window as unknown as { __coilLoader?: { events: LoaderEvent[]; locks: LoaderEvent[] } };
  const locks: LoaderEvent[] = [];
  let locked = document.body.style.overflow === "hidden";
  locks.push({ t: performance.now(), event: locked ? "locked" : "unlocked" });
  new MutationObserver(() => {
    const now = document.body.style.overflow === "hidden";
    if (now === locked) return;
    locked = now;
    locks.push({ t: performance.now(), event: now ? "locked" : "unlocked" });
  }).observe(document.body, { attributes: true, attributeFilter: ["style"] });
  host.__coilLoader = { events, locks };
  const inAnimation = root.getAnimations?.().find((a) => (a as CSSAnimation).animationName === "coil-loader-in");
  events.push({ t: performance.now(), event: "armed", data: { animationTime: inAnimation?.currentTime ?? null } });
  return (event, data) => events.push({ t: performance.now(), event, data });
}
