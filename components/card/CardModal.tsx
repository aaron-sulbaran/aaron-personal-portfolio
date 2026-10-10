"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, type CSSProperties } from "react";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf } from "@/lib/gallery/card";
import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { Portal } from "@/components/Portal";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardBody } from "./CardBody";
import { useGalleryLayout } from "./useGalleryLayout";

// One modal for every card: the house shell (Portal, the lib/modal.ts
// primitives, the panel's rise, a fade alone under reduced motion) around the
// card's body, the tint and the glass as color-mix (bg-background/NN emits
// nothing with var() colors). renderMedia: no flown card lands here, so the
// modal draws its own card picture or header face. flying: a flown card is
// parked over its slot, so the layout holds what it opened with.

type Props = { cardKey: CardKey | null; onClose: () => void; renderMedia: boolean; flying: boolean };

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

export function CardModal({ cardKey, onClose, renderMedia, flying }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Live in both directions (framer-motion's useReducedMotion reads the preference once).
  const reduced = useReducedMotionLive();
  const layout = useGalleryLayout(flying);
  const open = cardKey !== null;
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);
  const gallery = cardKey ? galleryOf(cardKey) : null;
  const rows = layout === "rows";

  return (
    <Portal>
      <AnimatePresence>
        {gallery && (
          <motion.div
            key="card-modal"
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
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
            className={`fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain ${rows ? "px-10 py-14" : "px-4 py-6"}`}
          >
            <motion.div aria-hidden="true" variants={modalBackdropTintVariants(0, true)} className="pointer-events-none fixed inset-0" style={tint} />
            <motion.div
              variants={reduced ? PANEL.reduced : PANEL.full}
              data-gallery-panel=""
              onMouseDown={(e) => e.stopPropagation()}
              className={`relative my-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)] backdrop-blur-xl ${rows ? "p-10" : "p-5"}`}
              style={{ ...glass, maxWidth: rows ? gallery.panelWidth : undefined }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label={siteContent.modals.closeAriaLabel}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
                style={closeGlass}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              <CardBody key={`${gallery.key}-${layout}`} gallery={gallery} layout={layout} renderMedia={renderMedia} flying={flying} onClose={onClose} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
