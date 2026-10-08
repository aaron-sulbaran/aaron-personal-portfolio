"use client";

import { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { Fill, FillArrow, FillSeed } from "@/components/fx/Fill";
import { MarkStrike } from "@/components/mark/MarkStrike";
import { useCloseHint } from "@/components/PhotoModal";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { CTA_CLASS, CTA_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
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
// A close mid-strike pauses the open and GSAP lifts the night and flash within
// the panel's exit, so the page never pops back at unmount.
const COPY = siteContent.mark;
const EXIT_S = 0.2;
const DIP_LIFT_S = 0.16;

type Props = { open: boolean; onClose: () => void; onExited: () => void };

export function MarkCard({ open, onClose, onExited }: Props) {
  const reduced = !!useReducedMotion();
  const pending = useRef<string | null>(null);
  return (
    <Portal>
      <AnimatePresence
        onExitComplete={() => {
          onExited();
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

  const isPresent = useIsPresent();
  const strike = useRef<{ ctx: gsap.Context; open: gsap.core.Timeline } | null>(null);

  useLayoutEffect(() => {
    const scope = dialogRef.current;
    if (!scope || reduced) return;
    const built: { open?: gsap.core.Timeline } = {};
    const ctx = gsap.context(() => {
      built.open = buildCardOpen(scope).play(0);
    }, scope);
    if (built.open) strike.current = { ctx, open: built.open };
    return () => {
      strike.current = null;
      ctx.revert();
    };
  }, [reduced]);

  useLayoutEffect(() => {
    const live = strike.current;
    const dips = dialogRef.current?.querySelectorAll("[data-cel-night], [data-cel-flash]");
    if (isPresent || !live || !dips?.length) return;
    live.ctx.add(() => {
      live.open.pause();
      gsap.to(dips, { opacity: 0, duration: DIP_LIFT_S, ease: "power1.out", overwrite: true });
    });
  }, [isPresent]);

  const panel = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18, ease: "linear" as const } }, exit: { opacity: 0, transition: { duration: 0.12 } } }
    : { hidden: { opacity: 1 }, visible: { opacity: 1 }, exit: { opacity: 0, transition: { duration: EXIT_S, ease: "easeIn" as const } } };

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
            <span data-card="text" className="w-fit">
              <Fill as="link" {...FILL_PICK.cta} href={COPY.cta.href} onClick={(e) => { e.preventDefault(); onCta(); }} className={CTA_CLASS} overClassName={CTA_OVER_CLASS}>
                {COPY.cta.label}
                <FillSeed className="h-8 w-8">
                  <FillArrow />
                </FillSeed>
              </Fill>
            </span>
            <span data-card="text" className="pt-1 text-sm text-muted">{closeHint}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
