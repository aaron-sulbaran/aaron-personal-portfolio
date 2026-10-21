"use client";

import { useEffect } from "react";
import { footerLift } from "@/lib/player/lift";

// Keeps the desktop isle off the footer. As the footer scrolls in it writes how
// far the isle must rise as --isle-lift on <html>; globals.css moves the stock
// capsule pill and the player's pill with it, so the isle sits a gap above the
// footer's top edge and the period stays free. A page with no footer writes
// nothing. The property is removed again when the page changes.
export function useIsleLift(pathname: string) {
  useEffect(() => {
    const footer = document.querySelector("footer[data-footer]");
    if (!footer) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty("--isle-lift", `${footerLift(footer.getBoundingClientRect().top, window.innerHeight)}px`);
    write();
    window.addEventListener("scroll", write, { passive: true });
    window.addEventListener("resize", write);
    return () => {
      window.removeEventListener("scroll", write);
      window.removeEventListener("resize", write);
      root.style.removeProperty("--isle-lift");
    };
  }, [pathname]);
}
