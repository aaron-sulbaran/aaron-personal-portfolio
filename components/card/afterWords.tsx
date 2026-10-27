import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import type { Gallery } from "@/lib/gallery/card";
import { CardVideo } from "./CardVideo";
import { talosAfter } from "./talosParts";

// What a card's modal draws right after one of its paragraphs, in every layout
// (the desktop rows, the phone pager, a phone card's words): Talos's sting and
// Discord channel (talosParts), and a card's demo video after the paragraph it
// sits beside (modal.video.beside).
export function afterWords(gallery: Gallery, unit: number, flying: boolean): ReactNode {
  if (gallery.key === "talos") return talosAfter(unit, flying);
  const video = siteContent.cards[gallery.key].modal.video;
  const word = gallery.words[unit];
  if (video && word?.kind === "block" && word.index === video.beside) return <CardVideo key="video" cardKey={gallery.key} />;
  return null;
}
