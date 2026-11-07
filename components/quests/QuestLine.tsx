"use client";

import { useEffect, useRef, useState } from "react";
import { QuestButton } from "@/components/quests/QuestButton";
import { QuestPanel } from "@/components/quests/QuestPanel";
import type { QuestTarget } from "@/components/quests/Splits";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";
import { navigateToSection } from "@/lib/scroll";
import { QUEST } from "@/lib/quests/constants";
import { totalFound, totalQuests, useQuestState } from "@/lib/quests";
import type { QuestCategory } from "@/lib/quests/types";

// The quest line in the footer: the button, and the run it opens, on the
// visitor's own progress (lib/quests; QuestMount in the layout feeds it).
// The popup opens on Any% until that is finished, then on 100%. A row's way
// there closes the run, then travels in the same commit (the panel's scroll
// lock lets go first, since a child's effects run before this one):
// the cards to page 2, the pop-ups to page 1, the MVP through its transition.
const SECTION: Record<Exclude<QuestTarget, "mvp">, string> = { cards: "#work", pops: "#about" };

export function QuestLine() {
  const state = useQuestState();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<QuestCategory>("any");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<QuestTarget | null>(null);
  const reduced = useReducedMotionLive();
  useEffect(() => {
    const target = pending.current;
    if (open || !target) return;
    pending.current = null;
    if (target === "mvp") goTo(EXPRESS_PATH);
    else navigateToSection(SECTION[target], reduced);
  }, [open, reduced]);
  const go = (target: QuestTarget) => {
    pending.current = target;
    setOpen(false);
  };
  const openRun = () => {
    setCategory(state.finishes.any ? "full" : "any");
    setOpen(true);
  };
  return (
    <>
      <QuestButton
        found={totalFound(state)}
        total={totalQuests()}
        countFrom={QUEST.countFrom}
        pulse={QUEST.pulse}
        expanded={open}
        onOpen={openRun}
        buttonRef={buttonRef}
      />
      <QuestPanel open={open} onClose={() => setOpen(false)} state={state} category={category} onCategory={setCategory} returnTo={() => buttonRef.current} onGo={go} />
    </>
  );
}
