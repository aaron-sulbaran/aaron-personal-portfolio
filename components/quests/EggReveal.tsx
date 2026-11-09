"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { TrailingIcon } from "@/components/quests/TrailingIcon";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { questCopy } from "@/lib/content/quests";
import { questIds } from "@/lib/quests/registry";

// The easter eggs give themselves away in two asks: the row's teaser opens to a
// "Reveal" button, and only that shows the clues. A clue already found is
// ticked, so the list still reads as progress. Reopening the run starts closed.

type Step = "closed" | "asked" | "revealed";

export function EggReveal({ found, touch }: { found: Readonly<Record<string, number>>; touch: boolean }) {
  const [step, setStep] = useState<Step>("closed");
  const reduced = useReducedMotionLive();
  const regionId = useId();
  const copy = questCopy.panel.eggs;
  const eggs = questIds("eggs");
  const open = step !== "closed";
  const grow = reduced ? { opacity: 1 } : { opacity: 1, height: "auto" };
  const shrink = reduced ? { opacity: 0 } : { opacity: 0, height: 0 };
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setStep(open ? "closed" : "asked")}
        className="group/egg mt-0.5 self-start rounded-sm text-left text-sm text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <TrailingIcon text={copy.teaser(eggs.length)} icon={<ChevronDown aria-hidden="true" size={14} strokeWidth={2.25} className={`ml-1 inline-block align-[-2px] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={regionId} key="eggs" className="overflow-hidden" initial={shrink} animate={grow} exit={shrink} transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}>
            {step === "asked" ? (
              <button
                type="button"
                onClick={() => setStep("revealed")}
                className="mt-2 inline-flex h-8 items-center rounded-full px-3.5 font-label text-label text-accent [box-shadow:inset_0_0_0_1px_var(--color-border)] transition-[box-shadow] hover:[box-shadow:inset_0_0_0_1px_var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {copy.reveal}
              </button>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5" aria-live="polite">
                {eggs.map((id) => {
                  const clue: { text: string; touch?: string } = copy.clues[id as keyof typeof copy.clues];
                  const isFound = id in found;
                  return (
                    <li key={id} className={`flex items-start gap-2 text-sm ${isFound ? "text-muted" : "text-foreground"}`}>
                      <span aria-hidden="true" className={`mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${isFound ? "bg-accent text-background" : "[box-shadow:inset_0_0_0_1px_var(--color-muted)]"}`}>
                        {isFound && <Check size={9} strokeWidth={3.5} />}
                      </span>
                      <span>
                        {isFound && <span className="sr-only">{copy.found}: </span>}
                        {touch && clue.touch ? clue.touch : clue.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
