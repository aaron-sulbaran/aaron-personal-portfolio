"use client";
import { getImageProps } from "next/image";
import { useEffect } from "react";
import { popPhotos } from "@/lib/inline/discover";

const POP_LINKS = '[data-inline="pop"][data-inline-key]';
// Loads a photo pop's pictures before anyone hovers it, so the shared label
// opens on its own photo at once instead of an empty card while it downloads.
// Only words on or near the screen are warmed, each once, and only when the
// browser is idle, so the first paint never waits and a pop far down the page
// (or inside a card not yet opened) costs nothing until the reader gets close.
// The request is the label's own (next/image's srcset and sizes for the same
// photo, so the browser picks the same width), which the label then finds in
// the cache. The images are held so their decoded pictures stay warm.
const warmed = new Set<string>();
const held: HTMLImageElement[] = [];

function warm(key: string) {
  if (warmed.has(key)) return;
  warmed.add(key);
  for (const photo of popPhotos(key)) {
    const { props } = getImageProps({ src: photo.src, alt: "", fill: true, sizes: photo.sizes });
    const image = new window.Image();
    if (props.sizes) image.sizes = props.sizes;
    if (props.srcSet) image.srcset = props.srcSet;
    image.src = props.src;
    image.decode().catch(() => {});
    held.push(image);
  }
}

const whenIdle = (run: () => void) =>
  typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 200);

export function usePopWarmup() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const near = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          near.unobserve(entry.target);
          const key = (entry.target as HTMLElement).dataset.inlineKey;
          if (key && !warmed.has(key)) whenIdle(() => warm(key));
        }
      },
      { rootMargin: "50% 0px" },
    );
    // Pop words arrive after mount too (a card's modal, a re-split line): one
    // rescan per burst of changes, observing only words not yet warmed.
    let rescan = 0;
    const scan = () => {
      rescan = 0;
      for (const link of Array.from(document.querySelectorAll<HTMLElement>(POP_LINKS))) {
        if (!warmed.has(link.dataset.inlineKey ?? "")) near.observe(link);
      }
    };
    const changes = new MutationObserver(() => {
      if (!rescan) rescan = window.requestAnimationFrame(scan);
    });
    scan();
    changes.observe(document.body, { childList: true, subtree: true });
    return () => {
      near.disconnect();
      changes.disconnect();
      if (rescan) window.cancelAnimationFrame(rescan);
    };
  }, []);
}
