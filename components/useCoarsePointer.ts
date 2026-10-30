"use client";

import { useSyncExternalStore } from "react";

// Whether the primary pointer is coarse (a touch screen), following the device. False on the server and until the browser answers, so a
// hint set by it starts as the mouse and keyboard's and settles to the touch one on a phone.
const COARSE_POINTER = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(COARSE_POINTER);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COARSE_POINTER).matches, () => false);
}
