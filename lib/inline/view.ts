import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import type { PopEntry } from "@/lib/content/types";
import { popPhotoBox } from "@/lib/photoSizes";
import type { TipKind } from "./attrs";

export interface PopPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  // The box the stylesheet draws it in on desktop (lib/photoSizes, popPhotoBox): one height for every photo pop, the width following the photo.
  displayWidth: number;
  displayHeight: number;
  // "cover": drawn at the pop height. "whole": a very wide photo, shown uncropped with its height following its width.
  fit: "cover" | "whole";
  // The request width: the box's width, since a photo has its own shape there.
  sizes: string;
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
  const box = entry.file ? popPhotoBox(entry.file.width, entry.file.height) : null;
  const photo =
    entry.file && box
      ? {
          ...entry.file,
          alt: entry.alt,
          displayWidth: box.width,
          displayHeight: box.height,
          fit: box.fit,
          sizes: `${box.width}px`,
        }
      : null;
  return {
    text: photo || entry.caption ? null : entry.alt,
    photo,
    caption: entry.caption ?? null,
    link: entry.href ? { href: entry.href, label: entry.hrefLabel ?? entry.href } : null,
    description: [entry.alt, entry.caption].filter(Boolean).join(". "),
  };
}

export function tipView(kind: TipKind, key: string): TipView | null {
  if (kind === "def") {
    const hint = Object.hasOwn(siteContent.register.def, key) ? siteContent.register.def[key].hint : undefined;
    return hint ? { text: hint, photo: null, caption: null, link: null, description: hint } : null;
  }
  if (kind === "tip") {
    const text = tipText(key);
    const link = Object.hasOwn(siteContent.register.tip, key) ? (siteContent.register.tip[key].link ?? null) : null;
    return text === null ? null : { text, photo: null, caption: null, link, description: text };
  }
  return Object.hasOwn(siteContent.register.pop, key) ? popView(siteContent.register.pop[key]) : null;
}

// A tip that holds a link: the pointer may leave its word for the label (lib/inline/tipState).
export function holdsLink(kind: TipKind, key: string): boolean {
  return kind === "tip" && !!tipView(kind, key)?.link;
}

// The link a showing label offers: a tip's whenever it shows; a pop's only once a tap pinned it.
export function shownLink(kind: TipKind, key: string, via: "hover" | "focus" | "tap" | "grace" | null): TipView["link"] {
  const link = tipView(kind, key)?.link ?? null;
  return kind === "tip" || via === "tap" ? link : null;
}
