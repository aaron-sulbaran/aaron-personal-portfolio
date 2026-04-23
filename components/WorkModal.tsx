"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { siteContent, type WorkItem } from "@/lib/content";

type WorkModalProps = {
  item: WorkItem | null;
  onClose: () => void;
};

export function WorkModal({ item, onClose }: WorkModalProps) {
  const open = item !== null;
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

  const cta = siteContent.work.cta;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key="work-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.title} preview`}
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
            className="relative flex w-full max-w-xl flex-col gap-6 overflow-hidden rounded-2xl border border-border/60 bg-background/85 p-6 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl md:p-10"
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

            <div className="flex items-center gap-5 pr-12">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-glass shadow-[0_8px_20px_-12px_rgba(10,10,10,0.4)]">
                <Image src={item.logo} alt={`${item.title} logo`} fill sizes="80px" className="object-contain p-3" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-caps text-muted">
                  {item.role} · {item.year}
                </span>
                <h2 className="font-serif text-3xl italic leading-tight text-foreground md:text-4xl">
                  {item.title}
                </h2>
              </div>
            </div>

            <p className="text-base leading-relaxed text-foreground/90 md:text-lg md:leading-[1.55]">
              {item.teaser}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <Link
                href={`/work/${item.slug}`}
                className="group inline-flex items-center gap-2 text-lg font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
                onClick={onClose}
              >
                {cta}
                <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <span className="text-[11px] font-medium uppercase tracking-caps text-muted">
                Press esc to close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
