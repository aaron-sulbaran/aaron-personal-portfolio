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
        <h1 className="font-serif text-display-lg italic">{renderName(name)}</h1>
        <p className="mt-4 max-w-[44vmin] text-sm leading-relaxed text-muted sm:text-base md:mt-6 md:text-body-lg md:leading-[1.55]">
          {renderTagline(tagline, definitions, { interactive, morph, onOpen: openDefinition })}
        </p>
        <ScrollCue label={scrollHint} animate={!prefersReducedMotion} />
      </div>

      <DefinitionModal
        definition={openTerm ? definitions[openTerm] : null}
        morph={morph}
        onClose={closeDefinition}
      />
    </LayoutGroup>
  );
}

// Render the hero name with the first name accented. Split on "Aaron" so the
// rest of the heading ("Hi, I'm" and the period) keeps the foreground color.
function renderName(name: string) {
  const word = "Aaron";
  const idx = name.indexOf(word);
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <span className="text-accent">{word}</span>
      {name.slice(idx + word.length)}
    </>
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
  // The underline lives on the inner span, not the button: the morph span is
  // inline-block (an atomic inline box), and text-decoration is not painted
  // across atomic inline descendants, so a button-level underline silently
  // never draws over the word. group-hover carries the button's hover state
  // down to the span's decoration color.
  const underlineClasses =
    "underline decoration-accent/40 decoration-1 underline-offset-[3.5px] [text-decoration-skip-ink:auto] transition-[text-decoration-color] duration-200 group-hover:decoration-accent";
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={(e) => onOpen(term, e.currentTarget)}
      data-cursor-hover
      aria-haspopup="dialog"
      aria-label={`${def.titlePrefix} ${def.term}`}
      className="group font-serif italic text-accent transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
    >
      {morph ? (
        <motion.span layoutId={`def-${term}`} className={`inline-block ${underlineClasses}`}>
          {display}
        </motion.span>
      ) : (
        <span className={underlineClasses}>{display}</span>
      )}
    </button>
  );
}

// Minimal scroll affordance that replaces the old "open the menu" hint: scroll
// is now the invitation. A small down chevron that gently bobs (still under
// reduced motion, just static) with a screen-reader-only label. No teaching or
// onboarding beyond this; richer navigation hints are a deferred feature.
function ScrollCue({ label, animate }: { label: string; animate: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className={`mt-6 text-muted md:mt-10${animate ? " scrollcue-bob" : ""}`}
    >
      <span className="sr-only">{label}</span>
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3v10" />
        <path d="M4 9l4 4 4-4" />
      </svg>
    </motion.div>
  );
}
