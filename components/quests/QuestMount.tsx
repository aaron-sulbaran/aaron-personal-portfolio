"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { startRunClock } from "@/lib/quests/clock";
import { questStore } from "@/lib/quests";
import { connectQuestSources } from "@/lib/quests/sources";
import { isPrivatePath } from "@/lib/analytics";

// Starts the quest line's run clock and feeds it from the seen and visited
// stores. The private routes are not part of the public site, so nothing runs
// on them (the same list analytics leaves out).

export function QuestMount() {
  const pathname = usePathname();
  const isPrivate = isPrivatePath(pathname);

  useEffect(() => {
    if (isPrivate) return;
    const disconnect = connectQuestSources();
    const stopClock = startRunClock({ store: questStore });
    return () => {
      disconnect();
      stopClock();
    };
  }, [isPrivate]);

  return null;
}
