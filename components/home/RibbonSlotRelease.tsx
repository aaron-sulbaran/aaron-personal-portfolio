"use client";

import { useSlotRelease } from "./useSlotRelease";

// Closes the first screen's ribbon slot once the deal has taken the ribbon away
// and the reader has scrolled past it (components/home/useSlotRelease.ts). It
// renders nothing: the slot itself is server markup.
export function RibbonSlotRelease() {
  useSlotRelease();
  return null;
}
