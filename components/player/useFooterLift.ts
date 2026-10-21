"use client";

import { useEffect } from "react";
import { BAR_BOTTOM_PX, footerLift, footerReaches, ISLE_BOTTOM_PX } from "@/lib/player/footer";
import type { FooterMode } from "@/lib/player/settings";

// Keeps the isle off the footer (the lab's "The isle at the footer"). As the
// footer scrolls in it writes how far the isle must rise as two CSS variables
// on <html>; lab.css moves the real pill, the docked sheet and the phone bar
// with them, so the isle sits above the footer's top edge and the period stays
// free. Hide mode instead sets data-lab-isle="hidden" while they would meet.
// Everything is removed again when the lab turns off.
export function useFooterLift(enabled: boolean, mode: FooterMode) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const footer = document.querySelector("footer[data-footer]");
    if (!footer) return;
    const write = () => {
      const top = footer.getBoundingClientRect().top;
      const height = window.innerHeight;
      const isle = footerLift(top, height, ISLE_BOTTOM_PX);
      root.style.setProperty("--lab-isle-lift", mode === "lift" ? `${isle}px` : "0px");
      root.style.setProperty("--lab-bar-lift", mode === "lift" ? `${footerLift(top, height, BAR_BOTTOM_PX)}px` : "0px");
      root.dataset.labIsle = mode === "hide" && footerReaches(isle) ? "hidden" : "on";
    };
    write();
    window.addEventListener("scroll", write, { passive: true });
    window.addEventListener("resize", write);
    return () => {
      window.removeEventListener("scroll", write);
      window.removeEventListener("resize", write);
      root.style.removeProperty("--lab-isle-lift");
      root.style.removeProperty("--lab-bar-lift");
      delete root.dataset.labIsle;
    };
  }, [enabled, mode]);
}
