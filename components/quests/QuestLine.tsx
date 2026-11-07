"use client";

import { useRef, useState } from "react";
import { QuestButton } from "@/components/quests/QuestButton";
import { QuestPanel } from "@/components/quests/QuestPanel";
import { QUEST } from "@/lib/quests/constants";
import { totalFound, totalQuests, useQuestState } from "@/lib/quests";
import type { QuestCategory } from "@/lib/quests/types";

// The quest line in the footer: the button, and the run it opens, on the
// visitor's own progress (lib/quests; QuestMount in the layout feeds it).
// The popup opens on Any% until that is finished, then on 100%.
export function QuestLine() {
  const state = useQuestState();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<QuestCategory>("any");
  const buttonRef = useRef<HTMLButtonElement>(null);
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
      <QuestPanel open={open} onClose={() => setOpen(false)} state={state} category={category} onCategory={setCategory} returnTo={() => buttonRef.current} />
    </>
  );
}
