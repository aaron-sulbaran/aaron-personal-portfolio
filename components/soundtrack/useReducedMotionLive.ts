"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

// Reduced motion as a live, hydration-safe value: the server render and the
// hydrating render both read false, then React re-renders with the real
// preference. (framer-motion's hook seeds from the client during hydration,
// so a server-rendered class that depends on it would keep the server value.)
export function useReducedMotionLive(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
