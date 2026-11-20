"use client";

import { useEffect, useMemo, useRef } from "react";
import type { DealKnobs } from "@/lib/home/dealKnobs";
import { openedCardCount, promptDue, promptPlan, type PromptPlan } from "@/lib/home/clickPrompt";
import { getSeen } from "@/lib/home/seen";
import type { Quad } from "@/lib/coil/geometry";
import { createPromptRun, promptParts, type PromptRun } from "@/lib/home/promptRun";

// The click prompt's big moment, kept in a ref that outlives the deal's session
// (as the cutscene's lock is): a session can end (a skip, reduced motion
// switched on) while the line is still playing.
export type DealPrompt = {
  // null: a card has been opened in this tab, or the page has no overlay or resting line.
  // cardQuads: the cards' corners now or `aheadMs` on, which the big line keeps clear of.
  start: (section: HTMLElement, knobs: DealKnobs, cardQuads?: (aheadMs?: number) => readonly Quad[]) => { run: PromptRun; plan: PromptPlan } | null;
  // The line rests in its spot now.
  finish: () => void;
  // Back to before the deal (the lab's replay).
  stop: () => void;
  // An input the cutscene's lock swallowed while the line shows: lands it now.
  fastForward: () => void;
};

// cardOpen: a card's modal is open. onEarlyEnd: the line landed early or an open retired it, so the lock's
// wait is over and the columns come in.
export function useDealPrompt(cardOpen: boolean, onEarlyEnd?: () => void): DealPrompt {
  const afterEarlyEnd = useRef(onEarlyEnd);
  useEffect(() => {
    afterEarlyEnd.current = onEarlyEnd;
  });
  // The latest deal's run, playing or landed: a landed one is kept so a replay can reset its hosts.
  const current = useRef<PromptRun | null>(null);

  const api = useMemo<DealPrompt>(() => {
    const stop = () => {
      const run = current.current;
      current.current = null;
      run?.kill();
    };
    return {
      start(section, knobs, cardQuads) {
        stop();
        // The resting line's rule (promptDue): every visit with no card opened in this tab.
        if (!promptDue(openedCardCount(getSeen()))) return null;
        const parts = promptParts(section);
        if (!parts.stage || !parts.overlay || !parts.text || parts.hosts.length === 0) return null;
        const plan = promptPlan(knobs);
        const run = createPromptRun(parts, plan, () => afterEarlyEnd.current?.(), cardQuads);
        current.current = run;
        return { run, plan };
      },
      finish: () => current.current?.finish(),
      stop,
      fastForward() {
        current.current?.fastForward();
      },
    };
  }, []);

  // A card opened while the big line plays retires it at once, on any visit; a landed line stays (it reads
  // the prompt until that card is left, then the count).
  useEffect(() => {
    if (!cardOpen) return;
    const run = current.current;
    if (!run || run.over()) return;
    api.stop();
    afterEarlyEnd.current?.();
  }, [cardOpen, api]);

  useEffect(() => () => api.stop(), [api]);

  return api;
}
