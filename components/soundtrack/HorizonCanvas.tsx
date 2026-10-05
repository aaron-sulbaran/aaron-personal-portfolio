"use client";

import { useEffect, useState } from "react";
import { Portal } from "@/components/Portal";
import { acquireWaveConductor } from "./waveConductor";
import { createWaveView } from "./waveView";
import { useReducedMotionLive } from "./useReducedMotionLive";
import type { Alphas, Theme } from "./viewParts";

// The horizon strip: the wave following the reader along the bottom of the
// viewport, behind every section (z 0 under the content's z 10), taking no
// pointer events. Portaled to body so no transformed ancestor captures its
// fixed position; its right edge follows --scrollbar-comp so a scroll lock
// never resizes it, which keeps its width equal to the band's (the two tracks
// share one train). Mounted from md up only (BandStage gates it).
const ALPHAS: Record<Theme, Alphas> = {
  light: { muted: 0.4, accent: 0.55 },
  dark: { muted: 0.4, accent: 0.7 },
};

export function HorizonCanvas() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const still = useReducedMotionLive();

  useEffect(() => {
    if (!canvas) return;
    const conductor = acquireWaveConductor(still);
    const view = createWaveView(canvas, conductor, {
      kind: "horizon",
      still,
      avoidRoot: document,
      alphas: (theme) => ALPHAS[theme],
    });
    if (view) conductor.attach(view);
    return () => {
      if (view) {
        conductor.detach(view);
        view.destroy();
      }
      conductor.release();
    };
  }, [canvas, still]);

  return (
    <Portal>
      <div
        data-wave="horizon"
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-0 right-[var(--scrollbar-comp,0px)] z-0 h-[176px]"
      >
        <canvas ref={setCanvas} className="wave-horizon-mask absolute inset-0 h-full w-full" />
      </div>
    </Portal>
  );
}
