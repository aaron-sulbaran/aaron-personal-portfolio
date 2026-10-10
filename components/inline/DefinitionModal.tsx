"use client";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId, useRef } from "react";
import { Portal } from "@/components/Portal";
import { useCloseHint } from "@/components/modal/useCloseHint";
import { siteContent } from "@/lib/content";
import type { DefinitionEntry } from "@/lib/content/types";
import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { InlineCopy } from "./InlineCopy";
const RISE = { hidden: { opacity: 0, y: 16, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } }, exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" as const } } };
const FADE = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.12 } } };
// The house text modal for a definition link (the card modal's shell: Portal, the
// lib/modal hooks, the shared backdrop). No flight and no layoutId bloom:
// the word sits in a masked SplitText line. Reduced motion fades.
export function DefinitionModal({ entry, onClose }: { entry: DefinitionEntry | null; onClose: () => void }) {
  const open = entry !== null;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const reduced = useReducedMotion();
  const closeHint = useCloseHint();
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);
  return (
    <Portal>
      <AnimatePresence>
        {entry && (
          <motion.div key="definition-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
            initial="hidden" animate="visible" exit="exit" variants={modalBackdropBlurVariants(0)}
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
            className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 py-6 md:px-10 md:py-14">
            <motion.div aria-hidden="true" variants={modalBackdropTintVariants(0)} className="pointer-events-none fixed inset-0 bg-glass" />
            <motion.div data-definition-panel variants={reduced ? FADE : RISE} onMouseDown={(event) => event.stopPropagation()}
              className="relative my-auto flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-glass-strong p-6 shadow-[var(--shadow-card)] backdrop-blur-xl md:p-10">
              <button type="button" onClick={onClose} aria-label={siteContent.modals.closeAriaLabel}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors duration-200 hover:text-accent">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              <h2 id={titleId} className="pr-12 font-display text-3xl leading-tight text-foreground md:text-4xl">{entry.title}</h2>
              <p className="text-base leading-relaxed text-foreground md:text-lg md:leading-[1.55]"><InlineCopy source={entry.body} /></p>
              <span className="font-label text-label text-muted">{closeHint}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
