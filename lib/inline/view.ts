import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import type { PopEntry } from "@/lib/content/types";
import { POP_PHOTO_WIDTH } from "@/lib/photoSizes";
import type { TipKind } from "./attrs";

export interface PopPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  displayWidth: number;
  displayHeight: number;
}

export interface TipView {
  text: string | null;
  photo: PopPhoto | null;
  caption: string | null;
  link: { href: string; label: string } | null;
  description: string;
}

// A pop whose photo has not landed (C4) shows its caption, or its alt when it
// has none, so a pop link never opens onto nothing.
export function popView(entry: PopEntry): TipView {
  const photo = entry.file
    ? {
        ...entry.file,
        alt: entry.alt,
        displayWidth: POP_PHOTO_WIDTH,
        displayHeight: Math.round((POP_PHOTO_WIDTH * entry.file.height) / entry.file.width),
      }
    : null;
  return {
    text: photo || entry.caption ? null : entry.alt,
    photo,
    caption: entry.caption,
    link: entry.href ? { href: entry.href, label: entry.hrefLabel ?? entry.href } : null,
    description: [entry.alt, entry.caption].filter(Boolean).join(". "),
  };
}

export function tipView(kind: TipKind, key: string): TipView | null {
  if (kind === "tip") {
    const text = tipText(key);
    return text === null ? null : { text, photo: null, caption: null, link: null, description: text };
  }
  return Object.hasOwn(siteContent.register.pop, key) ? popView(siteContent.register.pop[key]) : null;
}
