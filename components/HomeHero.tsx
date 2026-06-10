"use client";

import { siteContent } from "@/lib/content";
import { useRingState } from "./TileRing";

// Centered hero copy that sits inside the TileRing. Hidden until the ring's
// entrance animation completes, then fades in. Purposefully does not drive
// any scroll behavior; home is a single locked view, so the "explore" hint
// points users to the menu.
export function HomeHero() {
  const state = useRingState();
  const ready = state === "ready";
  const { name, tagline, scrollHint } = siteContent.home;

  const fadeClass = ready ? "opacity-100" : "opacity-0";

  return (
    <div
      // Width is capped to the ring's interior safe zone (ring diameter is
      // ~82vmin, tiles eat ~9vmin per side, so ~60vmin gives breathing room).
      // Padding keeps a guaranteed gutter even at the smallest viewports.
      className={`flex w-full max-w-[60vmin] flex-col items-center px-4 transition-opacity duration-[420ms] ease-out ${fadeClass}`}
      aria-hidden={!ready}
    >
      <h1 className="font-serif text-display-lg italic">{name}</h1>
      <p className="mt-4 max-w-[44vmin] text-sm leading-relaxed text-muted sm:text-base md:mt-6 md:text-body-lg md:leading-[1.55]">
        {tagline}
      </p>
      <MenuHint label={scrollHint} />
    </div>
  );
}

// Small caps signpost. Clicking it opens the site menu via the hamburger's
// id (no state plumbing needed; Menu owns its own open state). Becomes
// clickable once the hero is visible.
function MenuHint({ label }: { label: string }) {
  const openMenu = () => {
    const trigger = document.getElementById("site-menu-trigger");
    trigger?.click();
  };

  return (
    <button
      type="button"
      onClick={openMenu}
      data-cursor-hover
      className="group mt-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-caps text-muted transition-colors duration-200 hover:text-accent focus-visible:text-accent md:mt-10"
    >
      <span>{label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3 w-3 -translate-y-px transition-transform duration-200 group-hover:-translate-y-[3px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 13V3" />
        <path d="M4 7l4-4 4 4" />
      </svg>
    </button>
  );
}
