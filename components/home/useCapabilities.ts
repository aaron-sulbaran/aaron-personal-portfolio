"use client";

import { useSyncExternalStore } from "react";
import { sameDrivers, selectDrivers, type Drivers } from "@/lib/coil/drivers";

// What this device can do, read live: the two drivers (composition by aspect,
// input by capability, lib/coil/drivers.ts) and reduced motion. One snapshot,
// cached so React sees a stable object until something really changes; the
// server's is the wide, fine-pointer one the markup is written for.

export type CapabilitySnapshot = { drivers: Drivers; reducedMotion: boolean };

const SERVER_CAPABILITIES: CapabilitySnapshot = {
  drivers: { composition: "wide", input: "fine", scene: true },
  reducedMotion: false,
};

export const QUERIES = {
  reduce: "(prefers-reduced-motion: reduce)",
  fine: "(pointer: fine)",
  hover: "(hover: hover)",
} as const;

let cachedCapabilities: CapabilitySnapshot = SERVER_CAPABILITIES;

function readCapabilities(): CapabilitySnapshot {
  const reducedMotion = window.matchMedia(QUERIES.reduce).matches;
  const drivers = selectDrivers({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    finePointer: window.matchMedia(QUERIES.fine).matches,
    canHover: window.matchMedia(QUERIES.hover).matches,
    reducedMotion,
  });
  if (cachedCapabilities.reducedMotion !== reducedMotion || !sameDrivers(cachedCapabilities.drivers, drivers)) {
    cachedCapabilities = { drivers, reducedMotion };
  }
  return cachedCapabilities;
}

function subscribeCapabilities(onChange: () => void) {
  const lists = Object.values(QUERIES).map((query) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", onChange));
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    lists.forEach((list) => list.removeEventListener("change", onChange));
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

const serverCapabilities = () => SERVER_CAPABILITIES;

export function useCapabilities(): CapabilitySnapshot {
  return useSyncExternalStore(subscribeCapabilities, readCapabilities, serverCapabilities);
}
