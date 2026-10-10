import { siteContent, type CardKey } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { rowColumns, type Box } from "./boxes";
import { BOXES, GALLERY } from "./constants";
import { galleryPlan, groupedPlan, namedPlan, type Plan } from "./plan";

// One card's modal as the gallery reads it: its photos (the card picture first
// on a photo card), the word units they sit beside, Aaron's plan, and the
// desktop panel's width; and the header's tile and meta line by layout.

export interface GalleryPhoto { src: string; width: number; height: number; alt: string; caption: string | null; captionShort: string | null; beside?: number }
export type WordUnit = { kind: "block"; index: number } | { kind: "entry"; index: number };
export interface Gallery { key: CardKey; photos: readonly GalleryPhoto[]; lead: number | undefined; words: readonly WordUnit[]; plan: Plan; aspects: readonly number[]; panelWidth: number; slot: number }

// The photo cards the gallery lab never showed Aaron follow cards.md's pairings
// (ruled on the plan's review, 2026-10-10), bent so that no row is without words
// (the final pass); every other photo card keeps the lab's round six rule, as
// Aaron picked it.
const NAMED: ReadonlySet<CardKey> = new Set<CardKey>(["band", "travel"]);

const cache = new Map<CardKey, Gallery>();

export function galleryOf(key: CardKey): Gallery {
  const hit = cache.get(key);
  if (hit) return hit;
  const { visual, modal } = siteContent.cards[key];
  const picture = visual.kind === "photo" ? visual.photo : null;
  const blocks = modal.blocks.map((_, index): WordUnit => ({ kind: "block", index }));
  const entries = key === "jobs" ? siteContent.cards.jobs.timeline.map((_, index): WordUnit => ({ kind: "entry", index })) : [];
  const photos: GalleryPhoto[] = [
    ...(picture ? [{ src: picture.src, width: picture.width, height: picture.height, alt: picture.alt, caption: modal.picture?.caption ?? null, captionShort: null }] : []),
    ...modal.photos.map((photo) => ({
      src: photo.src, width: photo.width, height: photo.height, alt: photo.alt, caption: photo.caption, captionShort: photo.captionShort ?? null,
      beside: photo.block !== undefined ? photo.block : blocks.length + photo.timeline,
    })),
  ];
  const lead = picture ? 0 : undefined;
  const words = [...blocks, ...entries];
  const plan =
    key === "jobs" ? groupedPlan(words.length, photos) : lead !== undefined && NAMED.has(key) ? namedPlan(words.length, photos, lead) : galleryPlan(words.length, photos, lead);
  const aspects = photos.map((photo) => photo.width / photo.height);
  const columns = rowColumns(aspects, { boxes: BOXES, wideFrom: GALLERY.wideFrom, columnGap: GALLERY.columnGap, textWidth: GALLERY.textWidth, padding: GALLERY.panelPadding, border: GALLERY.panelBorder });
  const gallery: Gallery = { key, photos, lead, words, plan, aspects, panelWidth: columns.panel, slot: columns.slot };
  cache.set(key, gallery);
  return gallery;
}

// The header's 3:4 tile, where a flown card lands unless it lands on the card
// picture: 60 by 80 beside the rows, 42 by 56 on a phone, and Talos's 51 by 68
// there, so its mark (40 percent of the tile) is never under its kit's 20px.
export function headerTileOf(key: CardKey, compact: boolean): Box {
  if (!compact) return GALLERY.headerTile;
  return key === "talos" ? GALLERY.talosTileCompact : GALLERY.headerTileCompact;
}

// The header's meta line: modal.meta where cards.md gave a shorter one, else the
// book's. A book meta holding a tip the book row cannot show (IEEE's AO) shows
// whole beside the rows, so the tip lives in the modal (cards.md, IEEE); a phone
// keeps the shorter line cards.md made for it.
export function headerMeta(key: CardKey, compact: boolean): string {
  const { book, modal } = siteContent.cards[key];
  return !compact && visibleText(book.meta) !== book.meta ? book.meta : (modal.meta ?? book.meta);
}
