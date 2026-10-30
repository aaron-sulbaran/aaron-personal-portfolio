import { siteContent, type CardKey } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { rowColumns, type Box, type ColumnSettings } from "./boxes";
import { BOXES, CARD_PHONE_GROUPING, GALLERY, PHONE_GROUPING } from "./constants";
import { jobsGallery } from "./jobs";
import { galleryPlan, namedPlan, type PhoneGrouping, type Plan } from "./plan";

// One card's modal as the gallery reads it: its photos (the card picture first
// on a photo card), the word units they sit beside, Aaron's plan, and the
// desktop panel's width; and the header's tile and meta line by layout.

// A demo video drawn in the place of a photo (components/card/CardVideo): the file, its poster and its own pixels.
export interface GalleryVideo { src: string; poster: string; width: number; height: number }
// A post embedded in the place of a photo (components/card/LinkedInEmbed): its own address and native size, and its accessible name.
export interface GalleryEmbed { src: string; width: number; height: number; title: string }
// tag: a job's name tag drawn in the place of a photo (components/card/JobTag), the index of its entry on the jobs timeline; its
// width and height are a nominal box (the tag grows with its tip).
export interface GalleryPhoto { src: string; width: number; height: number; alt: string; caption: string | null; captionShort: string | null; beside?: number; video?: GalleryVideo; tag?: number; embed?: GalleryEmbed }
export type WordUnit = { kind: "block"; index: number };
// boxes: each piece's own box where a card sets them (the jobs card's); the rest take the gallery's two boxes by orientation. grouping: the phone pager's.
export interface Gallery { key: CardKey; photos: readonly GalleryPhoto[]; lead: number | undefined; words: readonly WordUnit[]; plan: Plan; aspects: readonly number[]; panelWidth: number; slot: number; boxes?: readonly Box[]; grouping: PhoneGrouping }

// The photo cards the gallery lab never showed Aaron follow cards.md's pairings
// (ruled on the plan's review, 2026-10-10), bent so that no row is without words
// (the final pass); every other photo card keeps the lab's round six rule, as
// Aaron picked it.
const NAMED: ReadonlySet<CardKey> = new Set<CardKey>(["band", "travel"]);

// A card's demo video is media like its photos: it sits beside the paragraph it names and takes its turn on a
// side of the rows, in the photos' 4:3 frame (a 16:9 video is letterboxed inside it, components/card/CardVideo).
// Its src is the poster, so a group that ever held it would still draw an image.
const VIDEO_FRAME = { width: 4, height: 3 };

const cache = new Map<CardKey, Gallery>();

export function galleryOf(key: CardKey): Gallery {
  const hit = cache.get(key);
  if (hit) return hit;
  const { visual, modal } = siteContent.cards[key];
  const picture = visual.kind === "photo" ? visual.photo : null;
  const blocks = modal.blocks.map((_, index): WordUnit => ({ kind: "block", index }));
  const columnSettings: ColumnSettings = { boxes: BOXES, wideFrom: GALLERY.wideFrom, columnGap: GALLERY.columnGap, textWidth: GALLERY.textWidth, padding: GALLERY.panelPadding, border: GALLERY.panelBorder };
  const grouping = CARD_PHONE_GROUPING[key] ?? PHONE_GROUPING;
  if (key === "jobs") {
    const jobs = jobsGallery(columnSettings);
    const gallery: Gallery = { key, photos: jobs.photos, lead: undefined, words: blocks, plan: jobs.plan, aspects: jobs.photos.map((photo) => photo.width / photo.height), panelWidth: jobs.panel, slot: jobs.slot, boxes: jobs.boxes, grouping };
    cache.set(key, gallery);
    return gallery;
  }
  const photos: GalleryPhoto[] = [
    ...(picture ? [{ src: picture.src, width: picture.width, height: picture.height, alt: picture.alt, caption: modal.picture?.caption ?? null, captionShort: null }] : []),
    ...modal.photos.map((photo) => ({
      src: photo.src, width: photo.width, height: photo.height, alt: photo.alt, caption: photo.caption, captionShort: photo.captionShort ?? null,
      beside: photo.block,
    })),
    ...(modal.video
      ? [{ src: modal.video.poster, ...VIDEO_FRAME, alt: modal.video.label, caption: null, captionShort: null, beside: modal.video.beside, video: { src: modal.video.src, poster: modal.video.poster, width: modal.video.width, height: modal.video.height } }]
      : []),
  ];
  const lead = picture ? 0 : undefined;
  const plan = lead !== undefined && NAMED.has(key) ? namedPlan(blocks.length, photos, lead) : galleryPlan(blocks.length, photos, lead);
  const aspects = photos.map((photo) => photo.width / photo.height);
  const columns = rowColumns(aspects, columnSettings);
  const gallery: Gallery = { key, photos, lead, words: blocks, plan, aspects, panelWidth: columns.panel, slot: columns.slot, grouping };
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
