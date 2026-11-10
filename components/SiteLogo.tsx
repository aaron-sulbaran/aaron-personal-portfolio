"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { MarkTrigger } from "@/components/mark/MarkTrigger";
import { siteContent } from "@/lib/content";
import { wordsUnderLogo } from "@/lib/logoClear";
import { closeMenu, getMenuOpen, useMenuOpen } from "@/lib/menu";
import { navigateToSection } from "@/lib/scroll";

// The chrome (hero rework, slice 5): the logo, top left, and the Menu pill, top
// right (components/menu), and nothing else, on every route. There is no top
// bar: the Menu lists the four pages, with their numbers, and takes the reader to
// each. Both stay where they are as the page scrolls.
//
// The logo lives in the pill's layer (z-40), above the menu scrim, so it stays
// sharp and clickable while the menu is open. It is MarkTrigger: a click scrolls
// to the top (closing the menu first when it is open), a 650ms hold opens the
// logo's card.
//
// Page 2's list runs through the logo's corner, so while any part of it marked
// data-logo-clear is under the logo, the logo's button carries
// data-words-under and app/globals.css fades it out from 640px up (a phone has
// the top fade instead), never with the Menu open, under keyboard focus or
// under a pointer already resting on it (lib/logoClear.ts). The check is a
// measurement on scroll and resize, written to the button's own attribute so
// nothing renders, as components/TopFade.tsx does.
export function SiteLogo() {
  const reducedMotion = !!useReducedMotion();
  const menuOpen = useMenuOpen();
  const wrapRef = useRef<HTMLDivElement>(null);
  const goTop = () => {
    const jump = () => navigateToSection("#main", reducedMotion);
    if (getMenuOpen()) closeMenu(jump);
    else jump();
  };

  useEffect(() => {
    const logo = wrapRef.current?.querySelector<HTMLElement>("[data-mark-trigger]");
    if (!logo) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const words = [...document.querySelectorAll("[data-logo-clear]")].map((el) => el.getBoundingClientRect());
      if (!menuOpen && wordsUnderLogo(logo.getBoundingClientRect(), words)) logo.setAttribute("data-words-under", "");
      else logo.removeAttribute("data-words-under");
    };
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    soon();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    // The list moves without a scroll when the deal lays the page out.
    const observer = new ResizeObserver(soon);
    observer.observe(document.documentElement);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      observer.disconnect();
    };
  }, [menuOpen]);

  return (
    <div ref={wrapRef} className="contents">
      <MarkTrigger
        ariaLabel={siteContent.menu.markAriaLabel}
        onActivate={goTop}
        className="fixed left-4 top-4 z-40 block h-8 w-8 text-foreground sm:left-6 sm:h-10 sm:w-10"
      />
    </div>
  );
}
