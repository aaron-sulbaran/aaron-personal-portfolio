"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type CSSProperties } from "react";
import { siteContent, type CardKey } from "@/lib/content";
import type { CardDeck } from "@/lib/card/deck";
import { galleryOf } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { Portal } from "@/components/Portal";
import { useOutsidePress } from "@/components/modal/useOutsidePress";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardBody } from "./CardBody";
import { DeckRails } from "./DeckRails";
import { useDeckStep } from "./useDeckStep";
import { useGalleryLayout } from "./useGalleryLayout";

// One modal for every card: the house shell (Portal, the lib/modal.ts
// primitives, the panel's rise, a fade alone under reduced motion) around the
// card's body (the tint is its own fixed layer under the dialog: inside the
// scrolling dialog, which carries a backdrop filter, a fixed child scrolls away
// with the content), the tint and the glass as color-mix (bg-background/NN emits
// nothing with var() colors). renderMedia: no flown card lands here, so the
// modal draws its own card picture or header face. flying: a flown card is
// parked over its slot, so the layout holds what it opened with. returnFocus:
// what focus goes back to on close (lib/modal useFocusTrap, never scrolling the
// page), named by whoever opened the modal. deck and onStep: the cards in the
// page's order, and the parent's swap to the one before or after
// (useDeckStep); a step keeps the shell open and lands a new panel in it.

type Props = {
  cardKey: CardKey | null;
  onClose: () => void;
  renderMedia: boolean;
  flying: boolean;
  returnFocus?: () => HTMLElement | null;
  deck?: CardDeck;
  onStep?: (key: CardKey) => void;
};

const tint: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 70%, transparent)" };
const glass: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 85%, transparent)" };
const closeGlass: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 80%, transparent)" };

const PANEL = {
  reduced: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.12 } } },
  full: {
    hidden: { opacity: 0, y: 16, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } },
    exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" as const } },
  },
};

export function CardModal({ cardKey, onClose, renderMedia, flying, returnFocus, deck, onStep }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Live in both directions (framer-motion's useReducedMotion reads the preference once).
  const reduced = useReducedMotionLive();
  const layout = useGalleryLayout(flying);
  const open = cardKey !== null;
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open, returnFocus);
  const outside = useOutsidePress(onClose);
  const gallery = cardKey ? galleryOf(cardKey) : null;
  const rows = layout === "rows";
  const sheet = gallery !== null && !rows && gallery.plan.slides.length > 0;
  // A phone pager owns the arrow keys and the sideways drag, and hands its ends up (onEdge); everywhere else they step here.
  const nav = useDeckStep({ dialogRef, panelRef, cardKey, deck, onStep, keys: !sheet, swipe: !rows && !sheet, reduced });
  // Every open is a fresh body, even of the card still leaving, so its masks
  // replay from the start rather than revive the exiting run. A step is no
  // open: the shell stays, and only the panel's card changes.
  const [opens, setOpens] = useState(0);
  const [openKey, setOpenKey] = useState<CardKey | null>(null);
  if (cardKey !== openKey) {
    setOpenKey(cardKey);
    if (cardKey !== null && openKey === null) setOpens((n) => n + 1);
  }

  return (
    <Portal>
      <AnimatePresence>
        {gallery && (
          <motion.div
            key={`card-tint-${opens}`}
            aria-hidden="true"
            data-card-tint=""
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalBackdropTintVariants(0, true)}
            className="pointer-events-none fixed inset-0 z-50"
            style={tint}
          />
        )}
        {gallery && (
          <motion.div
            key={`card-modal-${opens}`}
            role="dialog"
            aria-modal="true"
            aria-label={siteContent.cards[gallery.key].modal.title}
            data-card-modal={gallery.key}
            data-gallery-layout={layout}
            ref={dialogRef}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalBackdropBlurVariants(0, true)}
            {...outside}
            className={`fixed inset-0 z-50 flex justify-center ${sheet ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden"} overscroll-contain ${rows ? "px-10 py-14" : "px-4 py-6"}`}
          >
            <motion.div
              ref={panelRef}
              variants={reduced ? PANEL.reduced : PANEL.full}
              data-gallery-panel=""
              onMouseDown={(e) => e.stopPropagation()}
              className={`relative my-auto flex w-full flex-col ${rows ? "overflow-clip" : "overflow-hidden"} rounded-2xl border border-border shadow-[var(--shadow-card)] backdrop-blur-xl ${rows ? "p-10" : "p-5"}`}
              style={{ ...glass, maxWidth: rows ? gallery.panelWidth : undefined, height: sheet ? `calc(100dvh - ${GALLERY.pager.sheetInsetPx}px)` : undefined }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label={siteContent.modals.closeAriaLabel}
                data-card-close=""
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
                style={closeGlass}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              <CardBody key={`${gallery.key}-${layout}`} gallery={gallery} layout={layout} renderMedia={renderMedia} flying={flying} onClose={onClose} onEdge={nav.enabled ? nav.step : undefined} />
            </motion.div>
            {rows && nav.enabled && <DeckRails prev={nav.prev} next={nav.next} panelWidth={gallery.panelWidth} onStep={nav.step} />}
            <p className="sr-only" aria-live="polite" data-deck-announce="">
              {nav.announce}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
