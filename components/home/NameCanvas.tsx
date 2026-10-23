"use client";

import { useEffect, useRef } from "react";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import type { NameCanvasRuntime } from "@/components/coil/nameCanvas/start";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { HOLDING_MODE } from "@/lib/holding";
import { reportIntroLoad } from "@/lib/home/introLoad";
import { provideNameHandoff } from "@/lib/home/nameHandoff";

// The page's name, drawn in a canvas of its own (components/coil/nameCanvas/start.ts:
// the scene's name layer with the field inside the letters and the grainy sheen
// that follows the cursor), laid over the h1's lockup in the stage that holds
// both (Intro.tsx). The chunk (three and the name's parts) is imported only
// after first paint and only when it can run: not under reduced motion, not in
// holding mode, and with a WebGL 2 context this browser can actually create.
// Until it has drawn its first frame the stage says data-name-canvas="off" and
// the DOM name waits; once it is drawing, "on" (the DOM name, whose sr-only
// text is still the heading, stays hidden); where none can run it is "still"
// and the CSS fallback shows (text with the field as its fill). Reduced motion
// is live: turning it on tears the canvas down, off builds it again. The loader
// lands its lockup on the canvas name (lib/home/nameHandoff.ts) and the
// loader's tally hears the canvas's first frame, or that none will come.
export function NameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotionLive();

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const say = (state: "off" | "on" | "still") => stage.setAttribute("data-name-canvas", state);
    if (reduced || HOLDING_MODE || typeof WebGL2RenderingContext === "undefined") {
      say("still");
      reportIntroLoad("field");
      return;
    }
    say("off");
    let cancelled = false;
    let runtime: NameCanvasRuntime | null = null;
    let release = () => {};
    const giveUp = () => {
      if (cancelled) return;
      cancelled = true;
      release();
      runtime?.dispose();
      runtime = null;
      say("still");
      reportIntroLoad("field");
    };
    // After first paint: the page's text is already on screen.
    const frame = requestAnimationFrame(() => {
      if (!canCreateWebGL2()) return giveUp();
      import("@/components/coil/nameCanvas/start").then(
        ({ startNameCanvas }) => {
          if (cancelled) return;
          try {
            runtime = startNameCanvas(canvas, {
              onFirstFrame: () => {
                if (cancelled) return;
                say("on");
                reportIntroLoad("field");
              },
              onContextLost: giveUp,
              onError: (error) => {
                console.error("The name canvas failed; the page's own name carries on.", error);
                giveUp();
              },
            });
          } catch (error) {
            console.error("The name canvas failed to start; the page's own name carries on.", error);
            return giveUp();
          }
          const live = runtime;
          release = provideNameHandoff({ target: () => live.nameRect(), land: () => live.landName() });
          if (/coildebug/.test(window.location.search)) (window as unknown as { __nameCanvas?: NameCanvasRuntime }).__nameCanvas = live;
        },
        giveUp,
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      release();
      runtime?.dispose();
      runtime = null;
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" data-name-canvas-el="" className="intro-name__canvas" />;
}
