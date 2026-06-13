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
  // shared-layout morph.
  morph: boolean;
  onClose: () => void;
};

// Text-only modal that answers "My definition of <term>". Reuses the modal
// primitives in lib/modal.ts. The panel animates opacity only (no transform)
// so it never fights the layout projection of the morphing title term inside
// it; the word morph carries the motion.
export function DefinitionModal({ definition, morph, onClose }: DefinitionModalProps) {
  const open = definition !== null;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.22, ease: "easeOut" as const } },
    exit: { opacity: 0, transition: { duration: 0.18, ease: "easeIn" as const } },
  };

  const panelVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.24, ease: "easeOut" as const } },
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
          variants={backdropVariants}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-xl md:px-10 md:py-14"
        >
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
