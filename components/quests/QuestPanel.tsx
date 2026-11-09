"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useId, useRef } from "react";
import { PillToggle } from "@/components/fx/PillToggle";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { Portal } from "@/components/Portal";
import { RunTime } from "@/components/quests/RunTime";
import { Splits, type QuestTarget } from "@/components/quests/Splits";
import { useCoarsePointer } from "@/components/useCoarsePointer";
import { questCopy } from "@/lib/content/quests";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { runProgress } from "@/lib/quests/progress";
import type { QuestCategory, QuestState } from "@/lib/quests/types";

// The run: Any% or 100%, the time, and the splits. A small dialog that rises
// from the foot of the screen (the button sits at the page's end), a sheet
// across a phone. A finished category freezes its time at the finish and says
// so; until then the clock runs live.

const CATEGORIES = ["any", "full"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  state: QuestState;
  category: QuestCategory;
  onCategory: (next: QuestCategory) => void;
  returnTo?: () => HTMLElement | null;
  // A row's way there: the caller closes the run and takes the visitor to it.
  onGo: (target: QuestTarget) => void;
  // The exit has finished, so whatever the close was for can start.
  onClosed?: () => void;
};

export function QuestPanel({ open, onClose, state, category, onCategory, returnTo, onGo, onClosed }: Props) {
  const reduced = useReducedMotionLive();
  const touch = useCoarsePointer();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const introId = useId();
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(panelRef, open, returnTo);
  const copy = questCopy.panel;
  const run = runProgress(state, category);
  const finish = state.finishes[category];
  const shownMs = finish ? finish.ms : state.clockMs;
  const enter = reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 };
  const exit = reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 };
  return (
    <Portal>
      <AnimatePresence onExitComplete={onClosed}>
        {open && (
          <>
            <motion.div
              key="scrim"
              aria-hidden="true"
              className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--color-background)_45%,transparent)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={introId}
              data-quest-panel=""
              className="fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[calc(100dvh-1.5rem)] max-w-[26rem] overflow-y-auto overscroll-contain rounded-2xl bg-glass-strong p-5 backdrop-blur-xl [box-shadow:inset_0_0_0_1px_var(--color-border)] md:bottom-8"
              initial={exit}
              animate={enter}
              exit={exit}
              transition={{ duration: reduced ? 0.15 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id={titleId} className="font-label text-label-lg text-foreground">
                  {copy.title}
                </h2>
                <button type="button" onClick={onClose} aria-label={copy.close} className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                  <X size={18} />
                </button>
              </div>
              <p id={introId} className="mt-1 text-sm text-muted">{copy.intro}</p>
              <div className="mt-3">
                <PillToggle label={copy.title} options={CATEGORIES} value={category} onChange={onCategory} names={{ any: copy.categories.any.label, full: copy.categories.full.label }} />
              </div>
              <p className="mt-2 text-xs text-muted">{copy.categories[category].meaning}</p>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="sr-only">{copy.clock}</span>
                <RunTime ms={shownMs} className={`font-display text-[2.75rem] leading-none ${finish ? "text-accent" : "text-foreground"}`} />
              </div>
              {finish && <p className="mt-2 text-sm text-muted">{questCopy.finish[category]}</p>}
              {finish && <p className="mt-1 text-sm text-muted">{questCopy.finish.saved}</p>}
              <div className="mt-4">
                <Splits groups={run.groups} found={state.found} touch={touch} category={category} onGo={onGo} />
              </div>
              <p className="mt-3 text-xs text-muted">{copy.privacy}</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
