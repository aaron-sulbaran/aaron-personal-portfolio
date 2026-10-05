"use client";

import { useEffect, useRef } from "react";
import { acquireWaveConductor, type WaveConductor } from "./waveConductor";
import { createWaveView, type WaveViewHandle } from "./waveView";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The band's waveform: a decorative canvas that fills its parent, painted by a
// view on the shared wave conductor. `active` is the band's own visibility
// (its IntersectionObserver) and `frozen` the visitor's freeze toggle, which
// freezes the whole wave; under reduced motion it draws one still line.
export function WaveCanvas({ active, frozen }: { active: boolean; frozen: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<WaveViewHandle | null>(null);
  const conductorRef = useRef<WaveConductor | null>(null);
  const still = useReducedMotionLive();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const conductor = acquireWaveConductor(still);
    const view = createWaveView(canvas, conductor, {
      kind: "band",
      still,
      avoidRoot: canvas.closest("section") ?? document,
      alphas: { muted: 0.55, accent: 0.9 },
    });
    if (view) conductor.attach(view);
    viewRef.current = view;
    conductorRef.current = conductor;
    return () => {
      if (view) {
        conductor.detach(view);
        view.destroy();
      }
      conductor.release();
      viewRef.current = null;
      conductorRef.current = null;
    };
  }, [still]);

  useEffect(() => viewRef.current?.setActive(active), [active, still]);
  useEffect(() => conductorRef.current?.setFrozen(frozen), [frozen, still]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
