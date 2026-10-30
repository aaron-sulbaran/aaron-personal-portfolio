"use client";

import { useEffect, useRef } from "react";
import { joinFillPool } from "@/components/coil/fill/pool";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import type { NameCanvasRuntime } from "@/components/coil/nameCanvas/start";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { HOLDING_MODE } from "@/lib/holding";
import { reportIntroLoad } from "@/lib/home/introLoad";
import { provideNameHandoff } from "@/lib/home/nameHandoff";

// The page's name, drawn in a canvas of its own by the fill every numbered
// page's title wears (components/coil/fill: the field inside the letters and
// the grainy sheen that follows the cursor), laid over the h1's lockup in the
// stage that holds both (Intro.tsx). The chunk (three and the name's parts) is
// imported only after first paint and only when it can run: not under reduced
// motion, not in holding mode, and with a WebGL 2 context this browser can
// actually create. The name is one of the titles in the fill's pool
// (components/coil/fill/pool.ts): it holds a context while it is near the
// viewport and lets it go once it is far, so with the titles at most two are
// alive on top of the Coil's.
//
// Until its first canvas has drawn its first frame the stage says
// data-name-canvas="off" and the DOM name waits; once one is drawing, "on" (the
// DOM name, whose sr-only text is still the heading, stays hidden); while it
// holds none after that (the reader is pages away), "rest" (the DOM name shows
// in its CSS fill, so a jump back never finds it blank); where none can run it
// is "still" and the CSS fallback shows (text with the field as its fill).
// Reduced motion is live: turning it on tears the canvas down, off builds it
// again. The loader lands its lockup on the canvas name (lib/home/nameHandoff.ts)
// and the loader's tally hears the canvas's first frame, or that none will come.
export function NameCanvas() {
  const hostRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionLive();

  useEffect(() => {
    const host = hostRef.current;
    const stage = host?.parentElement;
    if (!host || !stage) return;
    const say = (state: "off" | "on" | "rest" | "still") => stage.setAttribute("data-name-canvas", state);
    if (reduced || HOLDING_MODE || typeof WebGL2RenderingContext === "undefined") {
      say("still");
      reportIntroLoad("field");
      return;
    }
    say("off");
    let runtime: NameCanvasRuntime | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let generation = 0;
    let failed = false;
    let drawn = false; // some canvas has drawn the name this page load
    let framesBefore = 0; // QA: the frames earlier canvases drew
    let releaseHandoff = () => {};

    const stopRuntime = () => {
      generation += 1;
      releaseHandoff();
      releaseHandoff = () => {};
      if (runtime) framesBefore += runtime.stats().frames;
      runtime?.dispose();
      runtime = null;
      canvas?.remove();
      canvas = null;
    };
    const giveUp = () => {
      if (failed) return;
      failed = true;
      stopRuntime();
      say("still");
      reportIntroLoad("field");
      member.update();
    };
    const release = () => {
      stopRuntime();
      if (!failed) say(drawn ? "rest" : "off");
    };
    const acquire = () => {
      const mine = ++generation;
      if (!canCreateWebGL2()) return giveUp();
      const next = document.createElement("canvas");
      next.setAttribute("aria-hidden", "true");
      next.setAttribute("data-name-canvas-el", "");
      next.setAttribute("data-fill-canvas", "");
      host.appendChild(next);
      canvas = next;
      // Only the first canvas meets the loader; a later one is made mid-scroll and compiles off the main thread.
      const compileAsync = drawn;
      import("@/components/coil/sceneChunk").then(
        ({ startNameCanvas }) => {
          if (mine !== generation) return;
          try {
            runtime = startNameCanvas(
              next,
              {
                onFirstFrame: () => {
                  if (mine !== generation) return;
                  drawn = true;
                  say("on");
                  reportIntroLoad("field");
                },
                onContextLost: giveUp,
                onError: (error) => {
                  console.error("The name canvas failed; the page's own name carries on.", error);
                  giveUp();
                },
              },
              { compileAsync },
            );
          } catch (error) {
            console.error("The name canvas failed to start; the page's own name carries on.", error);
            return giveUp();
          }
          const live = runtime;
          releaseHandoff = provideNameHandoff({ target: () => live.nameRect(), land: () => live.landName() });
        },
        giveUp,
      );
    };

    const member = joinFillPool({ id: "name", el: stage, eligible: () => !failed, acquire, release });
    // A load far down the page (a deep link) starts no canvas: the loader's tally hears that none is coming yet.
    const firstLook = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!member.alive() && !failed) reportIntroLoad("field");
      }),
    );
    // QA (?coildebug): the name across its canvases, the frames counted over all of them.
    if (/coildebug/.test(window.location.search)) {
      (window as unknown as { __nameCanvas?: NameCanvasRuntime }).__nameCanvas = {
        nameRect: () => runtime?.nameRect() ?? null,
        landName: () => runtime?.landName() ?? false,
        relayout: () => runtime?.relayout(),
        dispose: () => runtime?.dispose(),
        stats: () => {
          const now = runtime?.stats() ?? { frames: 0, running: false, paused: false, size: [0, 0] as [number, number], clock: 0, wakeActive: false, landed: false };
          return { ...now, frames: framesBefore + now.frames };
        },
      };
    }
    return () => {
      cancelAnimationFrame(firstLook);
      member.leave();
      stopRuntime();
      delete (window as unknown as { __nameCanvas?: NameCanvasRuntime }).__nameCanvas;
    };
  }, [reduced]);

  return <span ref={hostRef} aria-hidden="true" data-name-canvas-host="" className="intro-name__canvas" />;
}
