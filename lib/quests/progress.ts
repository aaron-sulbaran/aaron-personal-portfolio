// Turns a QuestState into the numbers the button and the splits read. Pure.
import { QUEST_GROUPS, QUEST_RULES } from "./constants";
import { ALL_QUEST_IDS, questIds } from "./registry";
import type { GroupProgress, QuestCategory, QuestRules, QuestState, RunProgress } from "./types";

export function runProgress(state: QuestState, category: QuestCategory, rules: QuestRules = QUEST_RULES): RunProgress {
  const groups: GroupProgress[] = [];
  for (const group of QUEST_GROUPS) {
    const ids = questIds(group);
    const total = ids.length;
    const needed = Math.min(rules[category][group], total);
    if (needed <= 0) continue;
    const times = ids.filter((id) => id in state.found).map((id) => state.found[id]).sort((a, b) => a - b);
    const found = Math.min(times.length, needed);
    const done = times.length >= needed;
    groups.push({ group, found, needed, total, left: needed - found, done, doneAtMs: done ? times[needed - 1] : null });
  }
  return {
    category,
    groups,
    complete: groups.every((entry) => entry.done),
    foundTotal: groups.reduce((sum, entry) => sum + entry.found, 0),
    neededTotal: groups.reduce((sum, entry) => sum + entry.needed, 0),
  };
}

export function totalFound(state: QuestState): number {
  return ALL_QUEST_IDS.filter((id) => id in state.found).length;
}

export function totalQuests(): number {
  return ALL_QUEST_IDS.length;
}
