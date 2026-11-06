// Every quest id, by group. Cards come from the Coil's order (the keys the seen
// store receives when a card modal closes), page-1 words are scanned out of the
// intro copy so editing a pop there changes the quest with it, and the eggs
// and the MVP are fixed. Ids match the visited store's format for words.
import { strandOrder } from "@/lib/content/cards";
import { intro } from "@/lib/content/intro";
import type { QuestGroup } from "./types";

const WORD_TOKEN = /\]\((def|tip|pop):([A-Za-z0-9_-]+)\)/g;

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
}

function pageOneWords(): string[] {
  const strings: string[] = [];
  collectStrings(intro, strings);
  const ids = new Set<string>();
  for (const text of strings) for (const match of text.matchAll(WORD_TOKEN)) ids.add(`${match[1]}:${match[2]}`);
  return Array.from(ids).sort();
}

const IDS: Readonly<Record<QuestGroup, readonly string[]>> = {
  cards: strandOrder.map((key) => `card:${key}`),
  pops: pageOneWords(),
  eggs: ["egg:logo", "egg:period"],
  mvp: ["mvp:quick"],
};

const GROUP_BY_ID = new Map<string, QuestGroup>();
for (const group of Object.keys(IDS) as QuestGroup[]) for (const id of IDS[group]) GROUP_BY_ID.set(id, group);

export const ALL_QUEST_IDS: readonly string[] = Array.from(GROUP_BY_ID.keys());

export function questIds(group: QuestGroup): readonly string[] {
  return IDS[group];
}

export function isQuestId(id: string): boolean {
  return GROUP_BY_ID.has(id);
}

export function groupOf(id: string): QuestGroup | null {
  return GROUP_BY_ID.get(id) ?? null;
}
