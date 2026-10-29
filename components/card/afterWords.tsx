import type { ReactNode } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { talosAfter } from "./talosParts";

// What a card's modal draws right after one of its paragraphs, in every layout
// (the desktop rows, the phone pager, a phone card's words): Talos's sting and
// Discord channel (talosParts).
export function afterWords(gallery: Gallery, unit: number, flying: boolean): ReactNode {
  return gallery.key === "talos" ? talosAfter(unit, flying) : null;
}
