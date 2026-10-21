"use client";

import { useEffect, useState } from "react";

// The Menu pill's left edge, for the island that stands beside it. The pill is
// a measured thing (its label and padding, and the Menu's own growth), so it is
// read where it is: undefined until the page has one. Vertical translate (the
// header tucking away) does not move it sideways.
export const readMenuLeft = (): number | undefined => document.querySelector("[data-menu-pill]")?.getBoundingClientRect().left;

export interface HeaderRow {
  viewportWidth: number;
  menuLeft: number | undefined;
}

// The header row's measurements, read again when the window turns or the Menu
// pill changes size.
export function useHeaderRow(): HeaderRow {
  const [row, setRow] = useState<HeaderRow>(() => ({ viewportWidth: window.innerWidth, menuLeft: readMenuLeft() }));
  useEffect(() => {
    const update = () => setRow((current) => {
      const next = { viewportWidth: window.innerWidth, menuLeft: readMenuLeft() };
      return next.viewportWidth === current.viewportWidth && next.menuLeft === current.menuLeft ? current : next;
    });
    update();
    window.addEventListener("resize", update);
    const pill = document.querySelector("[data-menu-pill]");
    const observer = pill ? new ResizeObserver(update) : null;
    if (pill) observer?.observe(pill);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);
  return row;
}
