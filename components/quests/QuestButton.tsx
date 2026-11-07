"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { Fill, FillArrow, FillSeed } from "@/components/fx/Fill";
import { questCopy } from "@/lib/content/quests";
import { CTA_CLASS, CTA_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";

// The quest line's door, centred in the footer band: the house call to action
// (a hairline pill, its arrow seeding the fill) asking a question, so the
// visitor wonders how they did. The count joins only once it is worth showing,
// since a low number reads as "you barely started". It pulses once, the first
// time it is well in view, then holds still. The run clock lives in the popup.
// A phone is too narrow for the question and the count in one pill, so there
// the count sits on a small line under it.

export type PulseConfig = { delayMs: number; durationMs: number; threshold: number };

type Props = {
  found: number;
  total: number;
  countFrom: number;
  pulse: PulseConfig;
  expanded: boolean;
  onOpen: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  // The lab replays the pulse by bumping this.
  replay?: number;
};

export function QuestButton({ found, total, countFrom, pulse, expanded, onOpen, buttonRef, replay = 0 }: Props) {
  const { label, count, countBelow, open } = questCopy.button;
  // Hydration-safe: framer's useReducedMotion reads the preference during hydration, so the ring below was
  // server-rendered and then dropped on the first client render under reduced motion (React #418).
  const reduced = useReducedMotionLive();
  const [pulseRef, pulseOn] = usePulseOnView(pulse, !reduced, replay);
  const showCount = found >= countFrom;
  const accessibleName = showCount ? `${open}, ${count(found, total)}` : open;
  return (
    <span className="flex flex-col items-center gap-2">
      <span ref={pulseRef} className="relative inline-flex">
        {!reduced && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full [box-shadow:0_0_0_1.5px_var(--color-accent)]"
            initial={false}
            animate={pulseOn ? { opacity: [0, 0.9, 0], scale: [1, 1.02, 1.22] } : { opacity: 0, scale: 1 }}
            transition={{ duration: pulse.durationMs / 1000, times: [0, 0.18, 1], ease: "easeOut" }}
          />
        )}
        <Fill
          as="button"
          type="button"
          ref={buttonRef}
          {...FILL_PICK.cta}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-label={accessibleName}
          onClick={onOpen}
          className={CTA_CLASS}
          overClassName={CTA_OVER_CLASS}
        >
          <span className="whitespace-nowrap">{label}</span>
          {showCount && <span className="hidden whitespace-nowrap tabular-nums text-muted sm:inline">{count(found, total)}</span>}
          <FillSeed className="h-8 w-8">
            <FillArrow dir="right" />
          </FillSeed>
        </Fill>
      </span>
      {showCount && (
        <span aria-hidden="true" className="font-label text-label-sm tabular-nums text-muted sm:hidden">
          {countBelow(found, total)}
        </span>
      )}
    </span>
  );
}

function usePulseOnView(pulse: PulseConfig, enabled: boolean, replay: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    setOn(false);
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || entry.intersectionRatio < pulse.threshold) return;
        observer.disconnect();
        timer = window.setTimeout(() => setOn(true), pulse.delayMs);
      },
      { threshold: [pulse.threshold] },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [enabled, pulse.delayMs, pulse.threshold, replay]);
  return [ref, on] as const;
}
