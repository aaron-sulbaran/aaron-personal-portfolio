"use client";

import { useReducedMotion } from "framer-motion";
import { MarkTrigger } from "@/components/mark/MarkTrigger";
import { siteContent } from "@/lib/content";
import { closeMenu, getMenuOpen } from "@/lib/menu";
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
export function SiteLogo() {
  const reducedMotion = !!useReducedMotion();
  const goTop = () => {
    const jump = () => navigateToSection("#main", reducedMotion);
    if (getMenuOpen()) closeMenu(jump);
    else jump();
  };
  return (
    <MarkTrigger
      ariaLabel={siteContent.menu.markAriaLabel}
      onActivate={goTop}
      className="fixed left-4 top-4 z-40 block h-8 w-8 text-foreground sm:left-6 sm:h-10 sm:w-10"
    />
  );
}
