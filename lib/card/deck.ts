import { cardColumns } from "@/lib/content/columns";
import type { CardKey } from "@/lib/content/types";

// The order the card modal steps through (its side chevrons, the arrow keys, a
// swipe past a phone pager's last page): the cards in the order the page shows
// them, each once. Page 2 is its columns read in order, Work then Builds; the
// MVP is its tiles top to bottom, a card that has several tiles (the jobs,
// Capital One) at its first. The ends never wrap. Pure.

export type CardDeck = readonly CardKey[];
export type Step = -1 | 1;

export function deckOf(keys: Iterable<CardKey>): CardDeck {
  return Array.from(new Set(keys));
}

export const homeDeck: CardDeck = deckOf(cardColumns.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => title.key))));

// The card a step lands on, or null past either end (or for a card the deck does not hold).
export function stepFrom(deck: CardDeck, key: CardKey, step: Step): CardKey | null {
  const at = deck.indexOf(key);
  if (at === -1) return null;
  return deck[at + step] ?? null;
}

// Where a card sits, counted from 1, for "3 of 14".
export function placeIn(deck: CardDeck, key: CardKey): number {
  return deck.indexOf(key) + 1;
}
