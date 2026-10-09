"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";

// A copy of the house modal shell (components/PhotoModal.tsx and
// WorkModal.tsx) with a children slot, which neither real modal has. Same
// primitives from lib/modal.ts (scroll lock, Escape stack, focus trap, the
// blur and tint variants), same classes, with three lab changes:
// - no Portal: the lab's frame is transformed, which captures position:fixed,
//   so the shell fills the frame instead of the window;
// - the md: classes are chosen in JS from the frame's width, since a 390px
//   frame on a wide screen would otherwise get the desktop padding;
// - the tint and glass are written as color-mix, because bg-background/70 and
//   /85 emit nothing under Tailwind 3 with var() colors (AGENTS.md, Known
//   issues), so the real modal shows the blur with no dim.

type Props = {
  open: boolean;
  onClose: () => void;
  reduced: boolean;
  compact: boolean;
  panelWidth: number;
  label: string;
  // Round four's pager: the panel fills the frame's height less the
  // backdrop's padding, and only a page's words scroll.
  sheetHeight?: number;
  children: ReactNode;
};

const tint: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 70%, transparent)" };
const glass: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 85%, transparent)" };
const button: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 80%, transparent)" };

export function GalleryModal({ open, onClose, reduced, compact, panelWidth, label, sheetHeight, children }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);

  const panelVariants = reduced
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
      {open && (
        <motion.div
          key="gallery-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          data-gallery-dialog=""
          ref={dialogRef}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalBackdropBlurVariants(0, true)}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className={`fixed inset-0 z-50 flex justify-center overscroll-contain ${sheetHeight ? "overflow-hidden" : "overflow-y-auto"} ${compact ? "px-4 py-6" : "px-10 py-14"}`}
        >
          <motion.div aria-hidden="true" variants={modalBackdropTintVariants(0, true)} className="pointer-events-none fixed inset-0" style={tint} />
          <motion.div
            variants={panelVariants}
            className={`relative my-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl ${compact ? "gap-6 p-5" : "gap-8 p-10"}`}
            style={{ ...glass, maxWidth: compact ? undefined : panelWidth, height: sheetHeight }}
            onMouseDown={(e) => e.stopPropagation()}
            data-gallery-panel=""
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={siteContent.modals.closeAriaLabel}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
              style={button}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
