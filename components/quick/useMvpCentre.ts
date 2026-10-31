"use client";

import { useLayoutEffect, type RefObject } from "react";
import { mvpCentreShift } from "@/lib/quick/mvpCentre";

// Writes --mvp-shift on a centred MVP link (page 1's line, [data-mvp-centre]):
// how far its sentence glides left while "MVP" fades to the full name, so the
// whole sentence ends centred (lib/quick/mvpCentre, globals.css "The MVP
// unfurl"). It reads the two widths of the link's MvpUnfurl, the short word's
// room (.mvp-unfurl) and the full name (.mvp-full), and measures again whenever
// either resizes (the font arriving, a resize). ResizeObserver reports layout
// sizes, so the glide's own translate never feeds back into the number.
export function useMvpCentre(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    const short = root?.querySelector<HTMLElement>(".mvp-unfurl");
    const full = root?.querySelector<HTMLElement>(".mvp-full");
    if (!root || !short || !full) return;
    const widths = new Map<Element, number>();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) widths.set(entry.target, entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width);
      root.style.setProperty("--mvp-shift", `${mvpCentreShift(widths.get(short) ?? 0, widths.get(full) ?? 0)}px`);
    });
    observer.observe(short);
    observer.observe(full);
    return () => observer.disconnect();
  }, [ref]);
}
