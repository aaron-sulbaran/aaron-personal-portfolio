"use client";

import { useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { siteContent } from "@/lib/content";
import { useRingState } from "./TileRing";
import { DefinitionModal } from "./DefinitionModal";

type DefinitionKey = keyof typeof siteContent.definitions;

// Centered hero copy that sits inside the TileRing. Hidden until the ring's
// entrance animation completes, then fades in. Two words in the tagline,
// "products" and "community", open a "My definition of <term>" modal; the
// clicked word shares a layoutId with the modal title so it flies up and
// blooms into the heading.
export function HomeHero() {
  const ring = useRingState();
  const ready = ring.phase === "ready";
  const { name, tagline, scrollHint } = siteContent.home;
  const definitions = siteContent.definitions;
  const prefersReducedMotion = useReducedMotion();
  const morph = !prefersReducedMotion;

  const [openTerm, setOpenTerm] = useState<DefinitionKey | null>(null);
  // Originating word button, refocused when the modal closes so keyboard users
  // do not lose their place (mirrors the photo/work modal focus return).
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openDefinition = (term: DefinitionKey, el: HTMLButtonElement) => {
    if (!ready) return;
    triggerRef.current = el;
    setOpenTerm(term);
  };

  const closeDefinition = () => {
    setOpenTerm(null);
    const el = triggerRef.current;
    triggerRef.current = null;
    if (el) {
      requestAnimationFrame(() => {
        if (el.isConnected) el.focus({ preventScroll: true });
      });
    }
  };

  // Any modal open (this hero's definition modal, or a photo/work modal that
  // TileRing owns) recedes the hero. Receding on open matters because the
  // centered card overlaps the centered hero: without it the sharp "Hi, I'm
  // Aaron" text lingers behind the card until the deferred background blur
  // finally covers it.
  const modalOpen = openTerm !== null || ring.modalOpen;
  const heroVisible = ready && !modalOpen;
  const interactive = ready && !modalOpen;

  return (
    <LayoutGroup>
      <div
        // Width is capped to the ring's interior safe zone (ring diameter is
        // ~82vmin, tiles eat ~9vmin per side, so ~60vmin gives breathing room).
        className="flex w-full max-w-[60vmin] flex-col items-center px-4 ease-out"
        style={{
          opacity: heroVisible ? 1 : 0,
          // Quicker recede when a definition opens so the hero does not linger
          // behind the card; the calmer 420ms is for the entrance and for the
          // fade back in when the modal closes.
          transition: `opacity ${modalOpen ? 240 : 420}ms ease-out`,
        }}
        aria-hidden={!heroVisible}
      >
        <h1 className="font-serif text-display-lg italic">{name}</h1>
        <p className="mt-4 max-w-[44vmin] text-sm leading-relaxed text-muted sm:text-base md:mt-6 md:text-body-lg md:leading-[1.55]">
          {renderTagline(tagline, definitions, { interactive, morph, onOpen: openDefinition })}
        </p>
        <MenuHint label={scrollHint} />
      </div>

      <DefinitionModal
        definition={openTerm ? definitions[openTerm] : null}
        morph={morph}
        onClose={closeDefinition}
      />
    </LayoutGroup>
  );
}

// Split the tagline on the defined terms (whole word, case-insensitive) and
// wrap each matched term in a trigger. Keeping the tagline a single editable
// string in content.ts while auto-wiring any word that has a definition.
function renderTagline(
  tagline: string,
  definitions: typeof siteContent.definitions,
  opts: {
    interactive: boolean;
    morph: boolean;
    onOpen: (term: DefinitionKey, el: HTMLButtonElement) => void;
  },
) {
  const terms = Object.keys(definitions);
  const pattern = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
  const segments = tagline.split(pattern);

  return segments.map((segment, i) => {
    const key = segment.toLowerCase();
    if (terms.includes(key)) {
      return (
        <DefinitionTrigger
          key={`${key}-${i}`}
          term={key as DefinitionKey}
          display={segment}
          interactive={opts.interactive}
          morph={opts.morph}
          onOpen={opts.onOpen}
        />
      );
    }
    return <span key={i}>{segment}</span>;
  });
}

// One interactive hero word. Accent serif italic (matching the modal title so
// the shared-layout morph keeps one font) plus a subtle underline that
// strengthens on hover. Inert until the hero is visible and no modal is open,
// so nothing is focusable while the container is aria-hidden.
function DefinitionTrigger({
  term,
  display,
  interactive,
  morph,
  onOpen,
}: {
  term: DefinitionKey;
  display: string;
  interactive: boolean;
  morph: boolean;
  onOpen: (term: DefinitionKey, el: HTMLButtonElement) => void;
}) {
  const def = siteContent.definitions[term];
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={(e) => onOpen(term, e.currentTarget)}
      data-cursor-hover
      aria-haspopup="dialog"
      aria-label={`${def.titlePrefix} ${def.term}`}
      className="font-serif italic text-accent underline decoration-accent/30 decoration-1 underline-offset-[3px] transition-[color,text-decoration-color] duration-200 hover:text-accent-hover hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
    >
      {morph ? (
        <motion.span layoutId={`def-${term}`} className="inline-block">
          {display}
        </motion.span>
      ) : (
        display
      )}
    </button>
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
