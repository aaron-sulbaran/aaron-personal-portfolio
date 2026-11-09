// The quest line's shared shapes. The store (lib/quests/store.ts) holds a
// QuestState; progress.ts turns it into a RunProgress per category; the footer
// button and the splits popup (components/quests/) only read RunProgress.

export type QuestGroup = "cards" | "pops" | "eggs" | "mvp";
export type QuestCategory = "any" | "full";

export interface QuestFinish {
  // Run clock at the moment the category completed, in ms of visible time.
  ms: number;
  // Local calendar date, YYYY-MM-DD.
  date: string;
}

export interface QuestState {
  // Quest id ("card:talos", "pop:family", "egg:logo", "mvp:quick") to the run
  // clock reading when it was found.
  found: Readonly<Record<string, number>>;
  // Visible time on the site so far, summed across visits, in ms.
  clockMs: number;
  finishes: Readonly<Partial<Record<QuestCategory, QuestFinish>>>;
}

export interface GroupProgress {
  group: QuestGroup;
  found: number;
  needed: number;
  total: number;
  left: number;
  done: boolean;
  // Run clock when the needed-th item of this group was found, or null.
  doneAtMs: number | null;
}

export interface RunProgress {
  category: QuestCategory;
  // Only the groups this category asks for (needed > 0), in QUEST_GROUPS order.
  groups: readonly GroupProgress[];
  complete: boolean;
  // Counted toward this category, capped per group at needed.
  foundTotal: number;
  neededTotal: number;
}

// How many of each group a category asks for (lib/quests/constants.ts QUEST_RULES).
export type QuestRules = Readonly<Record<QuestCategory, Readonly<Record<QuestGroup, number>>>>;
