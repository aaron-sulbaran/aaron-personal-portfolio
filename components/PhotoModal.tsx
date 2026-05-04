"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import type { Photo } from "@/lib/content";

type PhotoModalProps = {
  photo: Photo | null;
  onClose: () => void;
};

export function PhotoModal({ photo, onClose }: PhotoModalProps) {
  const open = photo !== null;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.22, ease: "easeOut" as const } },
    exit: { opacity: 0, transition: { duration: 0.18, ease: "easeIn" as const } },
  };

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
          variants={backdropVariants}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-xl md:px-10 md:py-14"
        >
          <motion.div
            variants={panelVariants}
            className="relative flex w-full max-w-4xl flex-col gap-6 overflow-hidden rounded-2xl border border-border/60 bg-background/85 p-5 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl md:flex-row md:gap-10 md:p-8"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground transition-colors duration-200 hover:text-accent"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>

            {/* Photo slot — the TileRing's FlyingTile physically lives here
                while the modal is open. No <Image> rendered inside; the flown
                tile is the image. aspect + sizing must match the tile's 3:4
                proportions so the flight lands in the exact rect. */}
            <div
              data-tile-slot="photo"
              className="relative aspect-[3/4] w-full shrink-0 rounded-xl md:w-[46%]"
              aria-hidden="true"
            />

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
