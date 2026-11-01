import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import type { PopEntry, PopFocus } from "@/lib/content/types";
import { POP_PHOTO, popPhotoBox, popSquareSizes } from "@/lib/photoSizes";
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
  // Where its crop is centred when it is cropped (register PopEntry.focus); absent for the middle.
  focus?: PopFocus;
}

// One photo of a cycling pop, in the pop's square frame (every photo is cropped to it).
export interface PopCycleFrame {
  photo: PopPhoto;
  caption: string | null;
}

export interface TipView {
  text: string | null;
  photo: PopPhoto | null;
  caption: string | null;
  link: { href: string; label: string } | null;
  description: string;
  // A pop that cycles its photos: present only then, and then photo and caption are null.
  cycle?: readonly PopCycleFrame[];
}

// A pop whose photo has not landed (C4) shows its caption, or its alt when it
// has none, so a pop link never opens onto nothing.
export function popView(entry: PopEntry): TipView {
  if (entry.cycle?.length) return cycleView(entry, entry.cycle);
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
          ...(entry.focus ? { focus: entry.focus } : {}),
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

// A cycling pop is its photos in the register's order, each in a square frame at the pop height. It is described by its
// words and then each photo's, since the label that shows them is hidden from assistive tech.
function cycleView(entry: PopEntry, frames: NonNullable<PopEntry["cycle"]>): TipView {
  const side = POP_PHOTO.height.desktop;
  return {
    text: null,
    photo: null,
    caption: null,
    link: null,
    description: [entry.alt, ...frames.map((frame) => [frame.alt, frame.caption].filter(Boolean).join(". "))].join(". "),
    cycle: frames.map((frame) => ({
      photo: { ...frame.file, alt: frame.alt, displayWidth: side, displayHeight: side, fit: "cover", sizes: popSquareSizes(frame.file.width / frame.file.height), focus: frame.focus },
      caption: frame.caption ?? null,
    })),
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
