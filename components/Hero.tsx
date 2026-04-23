"use client";

import { useRef } from "react";
import { PhotoRing } from "./PhotoRing";
import { ScrollIndicator } from "./ScrollIndicator";
import { siteContent } from "@/lib/content";

// Outer container is taller than the viewport. The inner content is pinned
// (sticky) while the user scrolls through the container, which gives the ring
// animation a scroll "arena" to play through without the hero leaving the
// viewport.
const SCROLL_ARENA = "h-[180vh] md:h-[200vh]";

export function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const { name, tagline, scrollLabel } = siteContent.hero;

  return (
    <section
      ref={ref}
      aria-label="Introduction"
      className={`relative w-full ${SCROLL_ARENA}`}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-10">
        {/* Ambient radial wash behind the ring so glass frames read on the warm bg */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(ellipse_at_center,var(--color-glass)_0%,transparent_62%)]"
        />

        <PhotoRing containerRef={ref} />

        <div className="relative z-20 mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="font-serif text-display-lg italic">{name}</h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted md:text-body-lg md:leading-[1.55]">
            {tagline}
          </p>
        </div>

        <ScrollIndicator label={scrollLabel} />
      </div>
    </section>
  );
}
