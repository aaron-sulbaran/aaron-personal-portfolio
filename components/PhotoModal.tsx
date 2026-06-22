"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import {
  useBodyScrollLock,
  useEscapeKey,
  useFocusTrap,
  modalBackdropBlurVariants,
  modalBackdropTintVariants,
} from "@/lib/modal";
import { siteContent, type Photo } from "@/lib/content";

type PhotoModalProps = {
  photo: Photo | null;
  onClose: () => void;
  // On mobile the modal is opened from the carousel, where no flight tile
  // flies into the slot. When true the modal renders its own image so the slot
  // is never empty. Desktop leaves this false; the flown tile fills the slot.
  renderMedia?: boolean;
};

export function PhotoModal({ photo, onClose, renderMedia = false }: PhotoModalProps) {
  const open = photo !== null;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);

  // Blur starts on click (no defer) and ramps the radius in quickly so it reads
  // as responsive without snapping; an earlier deferral felt laggy.
  const blurDelay = 0;

  const panelVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.18 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      }
    : {
        hidden: { opacity: 0, y: 16, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } },
        exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" as const } },
      };

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          key="photo-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={photo.alt}
          ref={dialogRef}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalBackdropBlurVariants(blurDelay)}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 md:px-10 md:py-14"
        >
          <motion.div
            aria-hidden="true"
            variants={modalBackdropTintVariants(blurDelay)}
            className="pointer-events-none absolute inset-0 bg-background/70"
          />
          <motion.div
            variants={panelVariants}
            className="relative flex w-full max-w-4xl flex-col gap-6 overflow-hidden rounded-2xl border border-border/60 bg-background/85 p-5 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl md:flex-row md:gap-10 md:p-8"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={siteContent.modals.closeAriaLabel}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground transition-colors duration-200 hover:text-accent"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>

            {/* Photo slot. On desktop the TileRing's FlyingTile physically
                lives here while the modal is open (no <Image> inside; the flown
                tile is the image), so the aspect + sizing must match the tile's
                3:4 proportions for the flight to land in the exact rect. On
                mobile the modal opens from the carousel with no flight, so
                renderMedia draws the image here directly. The panel stacks
                vertically on mobile, where the full-width image would tuck under
                the top-right close button. The button sits at top-3 (12px) and is
                h-10 (40px), so its bottom edge is 52px below the panel top; with
                the panel's p-5 (20px), mt-12 (48px) starts the image at ~68px,
                clear of the button. Desktop is a row with the image at 46% on the
                left, so no clip (mt resets to 0). */}
            <div
              data-tile-slot="photo"
              className="relative mt-12 aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl md:mt-0 md:w-[46%]"
              aria-hidden={!renderMedia}
            >
              {renderMedia && (
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  quality={90}
                  sizes="(max-width: 768px) 92vw, 46vw"
                  className="object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col justify-center pt-2 md:pt-0">
              <p className="font-serif text-2xl italic leading-[1.25] text-foreground md:text-3xl md:leading-[1.2]">
                {photo.caption}
              </p>
              <p className="mt-5 text-[11px] font-medium uppercase tracking-caps text-muted">
                Press esc to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
