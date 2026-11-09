import type { QuestGroup, QuestRules } from "./types";

// Every quest value lives here (copy lives in lib/content/quests.ts). The lab
// (app/lab/quests) tunes these by hand.

export const QUEST_GROUPS: readonly QuestGroup[] = ["cards", "pops", "eggs", "mvp"];

// How many of each group a category asks for. "full" asks for every one; a
// number above a group's total is clamped to it.
export const QUEST_RULES: QuestRules = {
  any: { cards: 5, pops: 3, eggs: 1, mvp: 0 },
  full: { cards: Infinity, pops: Infinity, eggs: Infinity, mvp: Infinity },
};

export const QUEST = {
  storageKey: "aaron-quests-v1",
  // The button shows its count once this many things are found (a low count reads as "barely started").
  countFrom: 3,
  // The run clock writes to storage at most this often, and always on hide.
  persistEveryMs: 5000,
  // The button's one pulse as it first comes into view.
  pulse: { delayMs: 250, durationMs: 1100, threshold: 0.6 },
} as const;
