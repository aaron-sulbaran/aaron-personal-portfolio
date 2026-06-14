"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRef } from "react";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { siteContent, type Definition } from "@/lib/content";

type DefinitionModalProps = {
  definition: Definition | null;
  // When true, the title term shares a layoutId with the hero word so it flies
  // up and blooms into the title. False under reduced motion: plain fade, no
  // shared-layout morph and no deferred blur.
  morph: boolean;
  onClose: () => void;
};

// Text-only modal that answers "My definition of <term>". Reuses the modal
// primitives in lib/modal.ts.
//
// The full-screen blur and dim are DEFERRED and animated, not applied on click:
// the word morphs up into the title over a sharp background first, then the
// background blur radius and the dim ease in once the card is materializing, so
// the background does not snap to blurred the instant a word is clicked. The
// card keeps its own backdrop-blur so it still reads as a glass panel arriving.
export function DefinitionModal({ definition, morph, onClose }: DefinitionModalProps) {
  const open = definition !== null;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);

  // Hold the ambient blur/dim until the word has begun flying up. Under reduced
  // motion there is no morph, so there is nothing to wait for: no delay.
  const ambientDelay = morph ? 0.22 : 0;

  // Animate the blur RADIUS (not just opacity) so it eases in cleanly.
  const blurVariants = {
    hidden: { backdropFilter: "blur(0px)", WebkitBackdropFilter: "blur(0px)" },
    visible: {
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      transition: { delay: ambientDelay, duration: 0.4, ease: "easeOut" as const },
    },
    exit: {
      backdropFilter: "blur(0px)",
      WebkitBackdropFilter: "blur(0px)",
      transition: { duration: 0.2, ease: "easeIn" as const },
    },
  };

  // Dim tint, fades in alongside the blur (same delay) so the background dims
  // and blurs together after the morph, not on click.
  const tintVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { delay: ambientDelay, duration: 0.4, ease: "easeOut" as const } },
    exit: { opacity: 0, transition: { duration: 0.18, ease: "easeIn" as const } },
  };

  // The card itself appears immediately, so the word has a panel to fly into.
  const panelVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.26, ease: "easeOut" as const } },
    exit: { opacity: 0, transition: { duration: 0.16, ease: "easeIn" as const } },
  };

  return (
    <AnimatePresence>
      {definition && (
        <motion.div
          key="definition-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${definition.titlePrefix} ${definition.term}`}
          ref={dialogRef}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={blurVariants}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 md:px-10 md:py-14"
        >
          {/* Dim tint. pointer-events-none so a click on the unblurred area
              still reaches the backdrop and closes the modal. */}
          <motion.div
            aria-hidden="true"
            variants={tintVariants}
            className="pointer-events-none absolute inset-0 bg-background/70"
          />

          <motion.div
            variants={panelVariants}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-border/60 bg-background/85 p-6 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl md:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={siteContent.modals.closeAriaLabel}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground transition-colors duration-200 hover:text-accent"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>

            <h2 className="max-w-[85%] font-serif text-3xl leading-[1.15] text-foreground md:text-4xl">
              {definition.titlePrefix}{" "}
              {morph ? (
                <motion.span
                  layoutId={`def-${definition.term}`}
                  className="inline-block italic text-accent"
                >
                  {definition.term}
                </motion.span>
              ) : (
                <span className="italic text-accent">{definition.term}</span>
              )}
            </h2>

            <p className="text-base leading-relaxed text-foreground md:text-lg">
              {definition.body}
            </p>

            <p className="mt-1 text-[11px] font-medium uppercase tracking-caps text-muted">
              Press esc to close
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
