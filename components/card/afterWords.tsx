import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import type { Gallery } from "@/lib/gallery/card";
import { CardLinks } from "./CardLinks";
import { talosAfter } from "./talosParts";

// What a card's modal draws right after one of its paragraphs, in every layout
// (the desktop rows, the phone pager, a phone card's words): Talos's sting and
// Discord channel (talosParts), and the links that belong to that paragraph
// (modal.paragraphLinks: the hackathons card's projects).
export function afterWords(gallery: Gallery, unit: number, flying: boolean): ReactNode {
  if (gallery.key === "talos") return talosAfter(unit, flying);
  const paragraph = gallery.words[unit]?.index ?? unit;
  if (!siteContent.cards[gallery.key].modal.paragraphLinks?.[paragraph]) return null;
  return <CardLinks key={`links-${unit}`} cardKey={gallery.key} paragraph={paragraph} />;
}
