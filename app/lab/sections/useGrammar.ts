"use client";

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { buildSection, registry } from "./grammar";
import type { LabSettings } from "./settings";

// Builds the grammar on every [data-sl-section] under the root, inside one
// gsap.matchMedia: desktop and phone get their own build, and reduced motion
// (the system's, or the panel's simulation) builds nothing, so the sections
// stay at their final, readable state. Any settings change reverts the whole
// context (tweens, ScrollTriggers, splits) and builds again.
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
    return () => {
      mm.revert();
      registry.clear();
    };
  }, [rootRef, settings, simReduced]);
}
