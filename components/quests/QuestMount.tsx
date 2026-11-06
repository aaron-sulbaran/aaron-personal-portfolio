"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { startRunClock } from "@/lib/quests/clock";
import { questStore } from "@/lib/quests";
import { connectQuestSources } from "@/lib/quests/sources";

// Starts the quest line's run clock and feeds it from the seen and visited
// stores. The private routes are not part of the public site, so nothing runs
// on them.
const PRIVATE_PREFIXES: readonly string[] = [];

export function QuestMount() {
  const pathname = usePathname();
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

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
