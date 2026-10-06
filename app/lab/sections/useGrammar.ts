"use client";

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { buildSection, registry } from "./grammar";
import type { LabSettings } from "./settings";

// Builds the grammar on every [data-sl-section] under the root, inside one
// gsap.matchMedia: desktop and phone get their own build, and reduced motion
// (the system's, or the panel's simulation) builds nothing, so the sections
// stay at their final, readable state. Any settings change reverts the whole
// context (tweens, ScrollTriggers, splits) and builds again; a reflow of the
// root re-measures the triggers.
export function useGrammar(rootRef: RefObject<HTMLElement | null>, settings: LabSettings, simReduced: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || settings.source !== "grammar" || simReduced) return;
    const mm = gsap.matchMedia(root);
    mm.add(
      { desktop: "(min-width: 768px)", phone: "(max-width: 767px)", reduce: "(prefers-reduced-motion: reduce)" },
      (context) => {
        const { desktop, reduce } = context.conditions as { desktop: boolean; reduce: boolean };
        if (reduce) return;
        root.querySelectorAll<HTMLElement>("[data-sl-section]").forEach((section) => buildSection(section, settings, desktop));
        ScrollTrigger.refresh();
        return () => registry.clear();
      },
    );
    // The panel opening or closing (or a copy edit) reflows the sections
    // without a window resize, so the triggers are re-measured on any change
    // of the root's size, once it settles.
    let timer = 0;
    let last = "";
    const observer = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
      if (size === last) return;
      const first = last === "";
      last = size;
      if (first) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      mm.revert();
      registry.clear();
    };
  }, [rootRef, settings, simReduced]);
}
