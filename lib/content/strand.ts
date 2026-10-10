import { cards, strandOrder } from "./cards";
import { visibleText } from "./links";
import type { CardKey, LogoRef } from "./types";

// The fourteen cards as the Coil, the unwound list and the book use them,
// derived from cards.ts, so no surface reads the legacy shapes.

export type StrandFace =
  | { kind: "photo"; src: string }
  | { kind: "logo"; logo: LogoRef; tile: "plain" | "anvil" }
  | { kind: "mark" }
  | { kind: "circles"; logos: readonly LogoRef[] };

// kind is the flight's: beside the rows (1024px and up) a photo card lands in the
// gallery's card picture and every other card in the modal header's tile; below
// 1024px every card lands on the phone header's tile.
export interface StrandCard { key: CardKey; kind: "photo" | "work"; face: StrandFace }

// Null when the card's asset is missing (none at launch; cards.test.ts holds it).
export function strandCardOf(key: CardKey): StrandCard | null {
  const visual = cards[key].visual;
  switch (visual.kind) {
    case "photo":
      return visual.photo ? { key, kind: "photo", face: { kind: "photo", src: visual.photo.src } } : null;
    case "logo":
      return visual.logo ? { key, kind: "work", face: { kind: "logo", logo: visual.logo, tile: visual.tile } } : null;
    case "mark":
      return { key, kind: "work", face: { kind: "mark" } };
    case "circles": {
      const logos = cards.jobs.timeline.map((entry) => entry.logo);
      return logos.every((logo): logo is LogoRef => logo !== null) ? { key, kind: "work", face: { kind: "circles", logos } } : null;
    }
  }
}

export const strandCards: readonly StrandCard[] = strandOrder.flatMap((key) => {
  const card = strandCardOf(key);
  return card ? [card] : [];
});

export const strandCardByKey: ReadonlyMap<string, StrandCard> = new Map(strandCards.map((card) => [card.key, card]));

export interface BookRowEntry { key: CardKey; title: string; meta: string }
export interface BookColumn { heading: string; rows: readonly BookRowEntry[] }

// A row is a button, so no link may sit inside it (C2): the row shows the
// visible words, and the IEEE row's AO tip stays in the register.
export function bookRow(key: CardKey): BookRowEntry {
  const { title, meta } = cards[key].book;
  return { key, title: visibleText(title), meta: visibleText(meta) };
}
