"use client";

import { useEffect } from "react";

// While the player has collapsed into the pill, a press on the pill's capsule
// opens the full player instead of the pill's own card. A capture listener on
// the document runs ahead of React's handlers, so the pill never sees the
// press. Only the capsule is taken; the card's controls are not.
export function usePillIntercept(active: boolean, onPress: () => void) {
  useEffect(() => {
    if (!active) return;
    const intercept = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-pill] .pill-hit")) return;
      event.stopPropagation();
      event.preventDefault();
      onPress();
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [active, onPress]);
}
