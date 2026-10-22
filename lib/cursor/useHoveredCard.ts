"use client";

import { useSyncExternalStore } from "react";
import { getSceneHoverKey, subscribeSceneHoverKey } from "./hover";

const serverKey = () => null;

// The key of the card under the pointer in the Coil, or null.
export function useHoveredCard(): string | null {
  return useSyncExternalStore(subscribeSceneHoverKey, getSceneHoverKey, serverKey);
}
