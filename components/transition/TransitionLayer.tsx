"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearQuietArrival, markQuietArrival } from "@/lib/home/arrival";
import { useBodyScrollLock } from "@/lib/modal";
import { HOME_PATH, isExpressSwap, sweepOf, TRANSITION_MS } from "@/lib/quick/transition";
import { dispatchTransition, registerTransitionLayer, useTransitionState } from "@/lib/quick/transitionStore";

// The two-way transition between the full site and the Express lane, mounted
// once in the root layout so it outlives the route change (lib/quick/transition
// is the state machine). Leaving: the accent mask sweeps over the page (from
// the home, the Coil's stage swells and fades under it), the route changes
// under the mask, the arriving page gets a moment to draw, then the mask sweeps
// off and focus lands on the new page's h1. Back and forward: the router has
// already moved, so the mask snaps on in the same task and only sweeps off.
// Reduced motion: the page's own background fades over and away, a plain
// crossfade. One scroll lock while it runs (lib/modal). z-[57]: over the flight
// (55), under the inline label (58) and the loader (60).

const EASE_IN = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const FULL = "inset(0% 0% 0% 0%)";
const REDUCE = "(prefers-reduced-motion: reduce)";

// Forward: in from the right edge, off to the left; back mirrors it.
const clips = (to: string | null) =>
  sweepOf(to) === "forward"
    ? { before: "inset(0% 0% 0% 100%)", after: "inset(0% 100% 0% 0%)" }
    : { before: "inset(0% 100% 0% 0%)", after: "inset(0% 0% 0% 100%)" };

function show(el: HTMLElement, reduced: boolean, clip: string, opacity: number) {
  el.dataset.tone = reduced ? "fade" : "mask";
  el.style.visibility = "visible";
  el.style.clipPath = reduced ? FULL : clip;
  el.style.opacity = String(opacity);
}

function hide(el: HTMLElement) {
  el.style.visibility = "hidden";
  el.style.opacity = "0";
}

function focusHeading() {
  const heading = document.querySelector<HTMLElement>("main h1");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

// The home has drawn its Coil (or its still) or the wait is over.
function whenDrawn(path: string, onDrawn: () => void): () => void {
  const started = performance.now();
  let frame = 0;
  let frames = 0;
  const tick = () => {
    frames += 1;
    const scene = path === HOME_PATH ? document.querySelector("section[data-scene]")?.getAttribute("data-scene") : "on";
    const drawn = frames >= 2 && scene !== "off";
    if (drawn || performance.now() - started > TRANSITION_MS.settleMax) onDrawn();
    else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export function TransitionLayer() {
  const router = useRouter();
  const pathname = usePathname();
  const state = useTransitionState();
  const coverRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Animation | null>(null);
  const pathRef = useRef(pathname);
  const active = state.phase !== "idle";
  useBodyScrollLock(active);

  useEffect(() => registerTransitionLayer(), []);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Registered before the router's own listener (a child's effects run first),
  // so the mask is on before the router renders the page it is going back to.
  useEffect(() => {
    const onPop = () => {
      const from = pathRef.current;
      const to = window.location.pathname;
      const cover = coverRef.current;
      if (!cover || !isExpressSwap(from, to)) return;
      const reduced = window.matchMedia(REDUCE).matches;
      if (to === HOME_PATH) markQuietArrival();
      show(cover, reduced, FULL, 1);
      dispatchTransition({ type: "pop", from, to, reduced });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useLayoutEffect(() => {
    const cover = coverRef.current;
    if (!cover || state.phase !== "leaving") return;
    const { before } = clips(state.to);
    show(cover, state.reduced, before, state.reduced ? 0 : 1);
    const sweep = state.reduced
      ? cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TRANSITION_MS.fadeIn, easing: "linear" })
      : cover.animate([{ clipPath: before }, { clipPath: FULL }], { duration: TRANSITION_MS.cover, easing: EASE_IN });
    const stage = !state.reduced && state.from === HOME_PATH ? document.querySelector<HTMLElement>("[data-coil-stage]") : null;
    stageRef.current = stage?.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.08)", opacity: 0.35 }], { duration: TRANSITION_MS.cover, easing: EASE_IN, fill: "forwards" }) ?? null;
    let done = false;
    sweep.finished.then(
      () => {
        done = true;
        show(cover, state.reduced, FULL, 1);
        dispatchTransition({ type: "covered" });
      },
      () => {},
    );
    return () => {
      if (!done) sweep.cancel();
    };
  }, [state.phase, state.reduced, state.to, state.from]);

  useEffect(() => {
    if (state.phase !== "covered" || !state.to) return;
    if (state.via === "push") {
      if (state.to === HOME_PATH) markQuietArrival();
      router.push(state.to);
    }
    const giveUp = window.setTimeout(() => {
      const cover = coverRef.current;
      if (cover) hide(cover);
      stageRef.current?.cancel();
      clearQuietArrival();
      dispatchTransition({ type: "abort" });
    }, TRANSITION_MS.giveUp);
    return () => window.clearTimeout(giveUp);
  }, [state.phase, state.via, state.to, router]);

  useEffect(() => {
    if (state.phase !== "covered" || !state.to || pathname !== state.to) return;
    const to = state.to;
    return whenDrawn(to, () => dispatchTransition({ type: "arrived", path: to }));
  }, [state.phase, state.to, pathname]);

  useLayoutEffect(() => {
    const cover = coverRef.current;
    if (!cover || state.phase !== "arriving") return;
    const { after } = clips(state.to);
    focusHeading();
    const sweep = state.reduced
      ? cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TRANSITION_MS.fadeOut, easing: "linear" })
      : cover.animate([{ clipPath: FULL }, { clipPath: after }], { duration: TRANSITION_MS.reveal, easing: EASE_OUT });
    let done = false;
    sweep.finished.then(
      () => {
        done = true;
        hide(cover);
        clearQuietArrival();
        dispatchTransition({ type: "revealed" });
      },
      () => {},
    );
    return () => {
      if (!done) sweep.cancel();
    };
  }, [state.phase, state.reduced, state.to]);

  return (
    <div
      ref={coverRef}
      aria-hidden="true"
      data-transition={state.phase}
      className="fixed inset-0 z-[57] bg-accent data-[tone=fade]:bg-background data-[transition=idle]:pointer-events-none"
      style={{ visibility: "hidden", opacity: 0 }}
    />
  );
}
