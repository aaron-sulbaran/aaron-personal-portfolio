"use client";

import { useEffect, useState } from "react";

// Mounts on show and keeps the node through its exit: [mounted, on]. on turns
// true two frames after the mount, so a CSS transition plays in, and false at
// once on hide; the node unmounts exitMs later.
export function useAppear(shown: boolean, exitMs: number): [boolean, boolean] {
  const [mounted, setMounted] = useState(shown);
  const [on, setOn] = useState(false);
  if (shown && !mounted) setMounted(true);
  if (!shown && on) setOn(false);
  useEffect(() => {
    if (shown) {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setOn(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [shown, exitMs]);
  return [mounted, on];
}
