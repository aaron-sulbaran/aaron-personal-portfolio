"use client";

import { useEffect, useRef } from "react";
import { acquireWaveConductor } from "../waveConductor";
import { useReducedMotionLive } from "../useReducedMotionLive";
import { createPathView } from "./pathView";

// The wave path's layer: absolutely placed from the band's top to the footer's
// bottom inside the content's stacking context, at z -1, so it scrolls
// natively and paints behind every word. The path view fills it with tiles.
export function PathLayer() {
  const ref = useRef<HTMLDivElement | null>(null);
  const still = useReducedMotionLive();
  useEffect(() => {
    const layer = ref.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    const conductor = acquireWaveConductor(still);
    const view = createPathView(layer, root, conductor);
    conductor.attach(view);
    return () => {
      conductor.detach(view);
      view.destroy();
      conductor.release();
    };
  }, [still]);
  return <div ref={ref} data-wave-path aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ zIndex: -1 }} />;
}
