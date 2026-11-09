import { cardColumns } from "@/lib/content/columns";
import type { CardKey } from "@/lib/content/types";

// The order the card modal steps through (its side chevrons, the arrow keys, a
// swipe past a phone pager's last page): the cards in the order the page shows
// them, each once. Page 2 is its columns read in order, Work then Builds; the
// MVP is its tiles top to bottom, a card that has several tiles (the jobs,
// Capital One) at its first. Past either end the deck goes round while a card
// is still unseen, so a visitor who started in the middle reaches the ones
// before it; once every card has been seen, the ends stop (Aaron, 2026-11-09:
// the grayed chevron is the quiet sign that they have seen them all). Pure.

export type CardDeck = readonly CardKey[];
export type Step = -1 | 1;

export function deckOf(keys: Iterable<CardKey>): CardDeck {
  return Array.from(new Set(keys));
}

export const homeDeck: CardDeck = deckOf(cardColumns.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => title.key))));

// The card a step lands on: round past an end when `wrap`, else null there (and for a card the deck does not hold).
export function stepFrom(deck: CardDeck, key: CardKey, step: Step, wrap = false): CardKey | null {
  const at = deck.indexOf(key);
  if (at === -1) return null;
  const next = at + step;
  if (wrap && deck.length > 1) return deck[(next + deck.length) % deck.length];
  return deck[next] ?? null;
}

// The deck goes round while any card but the open one is unseen (the open one is being seen now).
export function goesRound(deck: CardDeck, open: CardKey, seen: ReadonlySet<string>): boolean {
  return deck.some((key) => key !== open && !seen.has(key));
}

// Where a card sits, counted from 1, for "3 of 14".
export function placeIn(deck: CardDeck, key: CardKey): number {
  return deck.indexOf(key) + 1;
}
