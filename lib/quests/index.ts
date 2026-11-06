import { questStore } from "./singleton";

export { questStore } from "./singleton";
export { useQuestState } from "./useQuestState";
export { ALL_QUEST_IDS, groupOf, isQuestId, questIds } from "./registry";
export { runProgress, totalFound, totalQuests } from "./progress";
export { formatRunTime, runTimeParts } from "./format";

export function markQuestFound(id: string): boolean {
  return questStore.markFound(id);
}
