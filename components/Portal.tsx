"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Render children at document.body, outside any transformed ancestor.
//
// Any transform on an ancestor (a reveal, a Framer or GSAP tween, a pin)
// makes that element the containing block for position:fixed descendants, so
// a modal, flight or loader rendered inside one anchors to it instead of the
// viewport and drifts with it (the retired ring's pinned hero shifted its
// modals about 900px this way). Portaling to body keeps fixed children
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
