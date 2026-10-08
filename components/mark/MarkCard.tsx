"use client";

import { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MarkStrike } from "@/components/mark/MarkStrike";
import { useCloseHint } from "@/components/PhotoModal";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { gsap } from "@/lib/gsap";
import { MARK } from "@/lib/mark/constants";
import { buildCardOpen } from "@/lib/mark/timeline";
import { modalBackdropBlurVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { navigateToSection } from "@/lib/scroll";

// The mark's card in the site's modal shell (Portal, scroll lock, Escape,
// focus trap, the shared blur). No veil: the card sits over the blurred page,
// as Aaron approved, so the strike's night dip reads as the lab's did.
// Framer owns the backdrop and the exit; GSAP (lib/mark/timeline) owns the
// strike, the surface and the words; they never animate one element. The
// surface is opaque bg-background, since bg-background/NN emits nothing with
// var() colors. Reduced motion: the static mark, the panel fades in over 180ms.
const COPY = siteContent.mark;

export function MarkCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = !!useReducedMotion();
  const pending = useRef<string | null>(null);
  return (
    <Portal>
      <AnimatePresence
        onExitComplete={() => {
          if (pending.current) navigateToSection(pending.current, reduced);
          pending.current = null;
        }}
      >
        {open && (
          <MarkDialog
            key="mark-card"
            reduced={reduced}
            onClose={onClose}
            onCta={() => {
              pending.current = COPY.cta.href;
              onClose();
            }}
          />
        )}
      </AnimatePresence>
    </Portal>
  );
}

function MarkDialog({ reduced, onClose, onCta }: { reduced: boolean; onClose: () => void; onCta: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeHint = useCloseHint();
  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(dialogRef, true);

  useLayoutEffect(() => {
    const scope = dialogRef.current;
    if (!scope || reduced) return;
    const ctx = gsap.context(() => {
      buildCardOpen(scope).play(0);
    }, scope);
    return () => ctx.revert();
  }, [reduced]);

  const panel = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18, ease: "linear" as const } }, exit: { opacity: 0, transition: { duration: 0.12 } } }
    : { hidden: { opacity: 1 }, visible: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } } };

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={COPY.dialogLabel}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={modalBackdropBlurVariants(0)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 py-6 md:px-10 md:py-14"
    >
      {!reduced && (
        <>
          <div data-cel-night="" aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[var(--loader-bg)] opacity-0" />
          <div data-cel-flash="" aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[var(--loader-name)] opacity-0" />
        </>
      )}
      <motion.div variants={panel} className="relative my-auto w-full max-w-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div data-card="surface" className="absolute inset-0 rounded-2xl border border-border bg-background [box-shadow:var(--shadow-card)]" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-7 md:p-10">
          <button
            type="button"
            data-card="text"
            onClick={onClose}
            aria-label={siteContent.modals.closeAriaLabel}
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors duration-200 hover:text-accent"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          <MarkStrike sizePx={MARK.cardMarkPx} reduced={reduced} />
          <div className="flex min-w-0 flex-col gap-3 sm:pr-6">
            <span data-card="text" className="text-sm text-muted">{COPY.eyebrow}</span>
            <h2 data-card="text" className="font-display text-3xl leading-tight text-foreground">{COPY.title}</h2>
            {COPY.lines.map((line) => (
              <p key={line} data-card="text" className="text-base leading-relaxed text-foreground">{line}</p>
            ))}
            {/* Swap for the controls slice's Fill once components/fx/Fill.tsx exists (Task 10). */}
            <span data-card="text" className="w-fit">
              <a
                href={COPY.cta.href}
                onClick={(e) => {
                  e.preventDefault();
                  onCta();
                }}
                className="text-base font-medium text-accent underline underline-offset-4 transition-colors duration-200 hover:text-accent-hover"
              >
                {COPY.cta.label}
              </a>
            </span>
            <span data-card="text" className="pt-1 text-sm text-muted">{closeHint}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
