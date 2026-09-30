"use client";

import { useEffect, useRef } from "react";
import { createWaveEngine, type WaveEngine } from "./waveEngine";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The band's waveform: a decorative canvas that fills its parent. `active` is
// the band's own visibility (its IntersectionObserver) and `frozen` the
// visitor's freeze toggle; under reduced motion it draws one still line.
export function WaveCanvas({ active, frozen }: { active: boolean; frozen: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WaveEngine | null>(null);
  const still = useReducedMotionLive();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createWaveEngine(canvas, still);
    engineRef.current = engine;
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, [still]);

  useEffect(() => engineRef.current?.setActive(active), [active, still]);
  useEffect(() => engineRef.current?.setFrozen(frozen), [frozen, still]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
