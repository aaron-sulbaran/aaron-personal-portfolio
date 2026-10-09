"use client";
import { useEffect } from "react";
import { getVisited, markVisited, subscribeVisited, visitedId, visitedStyle, VISITED_STYLE_ID } from "@/lib/inline/visited";

// Writes the visited rule (lib/inline/visited) into the one style element the
// head script may already have made, so a returning visitor's links are filled
// before first paint and a click fills its link for good.
function paintVisited() {
  const css = visitedStyle(Array.from(getVisited()));
  let element = document.getElementById(VISITED_STYLE_ID);
  if (!element) {
    if (!css) return;
    element = document.createElement("style");
    element.id = VISITED_STYLE_ID;
    document.head.appendChild(element);
  }
  if (element.textContent !== css) element.textContent = css;
}

// A link counts as clicked when it is activated in any way that fires a click
// (a mouse click, a tap, Enter or Space, assistive tech) or a middle click.
export function useVisitedLinks() {
  useEffect(() => {
    paintVisited();
    const unsubscribe = subscribeVisited(paintVisited);
    const onActivate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLElement>(".inline-link") : null;
      if (!link) return;
      const id = visitedId({ kind: link.dataset.inline, key: link.dataset.inlineKey, href: link.getAttribute("href") });
      if (id) markVisited(id);
    };
    document.addEventListener("click", onActivate);
    document.addEventListener("auxclick", onActivate);
    return () => {
      unsubscribe();
      document.removeEventListener("click", onActivate);
      document.removeEventListener("auxclick", onActivate);
    };
  }, []);
}
