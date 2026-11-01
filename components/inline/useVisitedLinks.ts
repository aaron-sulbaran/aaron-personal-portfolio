"use client";
import { useEffect } from "react";
import { getVisited, markVisited, subscribeVisited, visitedId, visitedStyle, VISITED_STYLE_ID } from "@/lib/inline/visited";

// Writes the visited rule (lib/inline/visited) into the one style element the
// head script may already have made, so a returning visitor's links are filled
// before first paint and a word met just now fills for good.
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

// An external link counts as followed when it is activated in any way that
// fires a click (a mouse click, a tap, Enter or Space, assistive tech) or a
// middle click. A def, tip or pop word is not marked here: it is discovered
// when its content shows (useTipController, useDefinition), not when clicked.
export function useVisitedLinks() {
  useEffect(() => {
    paintVisited();
    const unsubscribe = subscribeVisited(paintVisited);
    const onActivate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLElement>(".inline-link") : null;
      if (!link || link.dataset.inline !== "external") return;
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
