"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_QUEST_STATE } from "./store";
import { questStore } from "./singleton";
import type { QuestState } from "./types";

// The server and the first client render see an empty state, so hydration
// always matches; the stored progress arrives with the first store change.
const serverState = (): QuestState => EMPTY_QUEST_STATE;

export function useQuestState(): QuestState {
  return useSyncExternalStore(questStore.subscribe, questStore.getSnapshot, serverState);
}
