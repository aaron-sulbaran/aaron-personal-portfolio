"use client";

import { useEffect, useMemo, useRef } from "react";
import type { DealKnobs } from "@/lib/home/dealKnobs";
import { firstOpenStore } from "@/lib/home/firstOpen";
import { openedCardCount, promptDue, promptPlan, type PromptPlan } from "@/lib/home/clickPrompt";
import { getSeen } from "@/lib/home/seen";
import type { Quad } from "@/lib/coil/geometry";
import { createPromptRun, promptParts, type PromptRun } from "@/lib/home/promptRun";

// The big moment's run, kept in a ref that outlives the deal's session (as the
// cutscene's lock is): a session can end (a skip, reduced motion switched on)
// while the line is still playing.
export type DealPrompt = {
  // null: not a first visit, or the page has no overlay or resting line.
  // cardQuads: the cards' corners now or `aheadMs` on, which the big line keeps clear of.
  start: (section: HTMLElement, knobs: DealKnobs, cardQuads?: (aheadMs?: number) => readonly Quad[]) => { run: PromptRun; plan: PromptPlan } | null;
  // The line rests in its spot now.
  finish: () => void;
  // Back to before the deal (the lab's replay).
  stop: () => void;
  // A card was opened: a run still playing is retired; a landed line stays.
  retire: () => void;
  // An input the cutscene's lock swallowed while the line shows: lands it now.
  fastForward: () => void;
};

// onEarlyEnd: the line landed early or a first open retired it, so the lock's wait is over and the columns come in.
export function useDealPrompt(onEarlyEnd?: () => void): DealPrompt {
  const afterEarlyEnd = useRef(onEarlyEnd);
  useEffect(() => {
    afterEarlyEnd.current = onEarlyEnd;
  });
  const current = useRef<PromptRun | null>(null);
  // The run that last landed: a replay's stop() still has to reset its hosts.
  const landed = useRef<PromptRun | null>(null);

  const api = useMemo<DealPrompt>(() => {
    const retire = (how: "finish" | "kill") => {
      const run = current.current;
      current.current = null;
      if (how === "finish" && run) landed.current = run;
      run?.[how]();
    };
    return {
      start(section, knobs, cardQuads) {
        retire("kill");
        landed.current = null;
        // The resting line's rule (promptDue): a card opened in this tab counts too, not only the once-ever key.
        if (!promptDue({ opened: openedCardCount(getSeen()), openedBefore: firstOpenStore().openedBefore() })) return null;
        const parts = promptParts(section);
        if (!parts.stage || !parts.overlay || !parts.text || parts.hosts.length === 0) return null;
        const plan = promptPlan(knobs);
        const run = createPromptRun(parts, plan, () => afterEarlyEnd.current?.(), cardQuads);
        current.current = run;
        return { run, plan };
      },
      finish: () => retire("finish"),
      retire: () => retire("kill"),
      fastForward() {
        current.current?.fastForward();
      },
      stop() {
        retire("kill");
        landed.current?.kill();
        landed.current = null;
      },
    };
  }, []);

  // A card opened while the big text plays retires it at once. The lab's
  // "First visit again" notifies the same listeners and must not kill a fresh run.
  useEffect(() => {
    const store = firstOpenStore();
    const unsubscribe = store.subscribe(() => {
      // Only a live run: a landed line stays (it reads the count by then).
      if (!store.openedBefore()) return;
      const live = current.current !== null;
      api.retire();
      if (live) afterEarlyEnd.current?.();
    });
    return () => {
      unsubscribe();
      api.stop();
    };
  }, [api]);

  return api;
}
