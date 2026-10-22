"use client";

import { useEffect, useState, type RefObject } from "react";
import { INTRO_HEADING_ID } from "@/lib/home/introId";

// The field's stage (the block that holds the heading) and the heading's box in
// it, in CSS px, kept current: the stage and the heading resizing, the window,
// the fonts landing, and `watch` changing (a position the lab moved the
// heading to without resizing either element).
export type StageBox = {
  stage: { width: number; height: number };
  heading: { left: number; top: number; width: number; height: number };
  viewportH: number;
};

const same = (a: StageBox, b: StageBox) =>
  a.stage.width === b.stage.width &&
  a.stage.height === b.stage.height &&
  a.viewportH === b.viewportH &&
  a.heading.left === b.heading.left &&
  a.heading.top === b.heading.top &&
  a.heading.width === b.heading.width &&
  a.heading.height === b.heading.height;

export function useStageBox(layer: RefObject<HTMLElement | null>, watch: string): StageBox | null {
  const [box, setBox] = useState<StageBox | null>(null);

  useEffect(() => {
    const stage = layer.current?.parentElement;
    const heading = document.getElementById(INTRO_HEADING_ID);
    if (!stage || !heading) return;
    const measure = () => {
      const s = stage.getBoundingClientRect();
      const h = heading.getBoundingClientRect();
      const next: StageBox = {
        stage: { width: s.width, height: s.height },
        heading: { left: h.left - s.left, top: h.top - s.top, width: h.width, height: h.height },
        viewportH: window.innerHeight,
      };
      setBox((prev) => (prev && same(prev, next) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(heading);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [layer, watch]);

  return box;
}
