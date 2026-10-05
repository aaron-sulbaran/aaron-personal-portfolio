"use client";

import { useEffect, useRef, useState } from "react";
import { createPathEngine, type PathEngine } from "./pathEngine";
import type { WaveSettings } from "./settings";
import type { SpinePoint } from "./spines";

declare global {
  interface Window {
    __wavePath?: PathEngine;
  }
}

// The Path placement's layer: an absolutely positioned box over the whole
// content (band to footer) at z -1 inside the content's stacking context, so
// it scrolls natively with the page and paints behind every word. The engine
// fills it with canvas tiles and measures the sections around it.
export function PathLayer({ settings, reduced, points }: { settings: WaveSettings; reduced: boolean; points: SpinePoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [engine] = useState(() => createPathEngine(settings));

  useEffect(() => {
    const layer = ref.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    const detach = engine.attach(layer, root);
    window.__wavePath = engine;
    return () => {
      detach();
      if (window.__wavePath === engine) window.__wavePath = undefined;
    };
  }, [engine]);

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    engine.update(settings, reduced, points);
  }, [engine, settings, reduced, points]);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: -1 }} />;
}
