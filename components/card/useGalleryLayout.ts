"use client";

import { useState, useSyncExternalStore } from "react";
import { GALLERY } from "@/lib/gallery/constants";

export type GalleryLayout = "rows" | "pager";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(GALLERY.wideQuery);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}
const read = (): GalleryLayout => (window.matchMedia(GALLERY.wideQuery).matches ? "rows" : "pager");
const server = (): GalleryLayout => "rows";

// The rows from 1024px up and the pager below, following the window. While a
// flown card is parked over its slot (hold), the layout keeps what it had, so
// the slot it landed on (the card picture or a header's tile) never jumps to
// the other layout's slot under it.
export function useGalleryLayout(hold: boolean): GalleryLayout {
  const live = useSyncExternalStore(subscribe, read, server);
  const [held, setHeld] = useState<GalleryLayout | null>(null);
  if (hold && held === null) setHeld(live);
  if (!hold && held !== null) setHeld(null);
  return hold ? (held ?? live) : live;
}
