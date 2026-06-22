"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Render children at document.body, outside any transformed ancestor.
//
// The hero pins #hero-pin with ScrollTrigger, which always leaves a transform
// on it (identity while pinned, a translateY once the pin releases). Any
// transform makes that element the containing block for position:fixed
// descendants, so a modal or flight tile rendered inside #hero-pin anchors to
// the pinned box instead of the viewport and shifts off-screen the moment the
// deck is not at its snapped position. Portaling to body keeps fixed children
// viewport-relative no matter the scroll state.
//
// Mount-gated so the server render and first client render emit nothing (no
// hydration mismatch); the portal attaches after mount.
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
