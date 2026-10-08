// The content model's shapes. Data lives in the sibling files and reaches
// components through siteContent in lib/content.ts, which re-exports these.

// A box inside the file at src, in that file's pixels. Export boxes on Aaron's
// originals stay in docs/content/photos.md.
export interface PhotoCrop { x: number; y: number; w: number; h: number }

// The inline register: what [words](def:key), (tip:key) and (pop:key) open.
export interface DefinitionEntry { title: string; body: string }

export interface TipEntry {
  text: string;
  proposed?: true;
  // A clause that is true only while an adapted track is in the player.
  adaptedClause?: string;
}

export interface PopEntry {
  // The exported file; null until C4 lands it.
  file: { src: string; width: number; height: number } | null;
  alt: string;
  caption: string | null;
  crop: PhotoCrop | null;
  // Opens in a new tab on click; hover and the first tap still show the pop.
  href?: string;
}

export interface InlineRegister {
  def: Record<string, DefinitionEntry>;
  tip: Record<string, TipEntry>;
  pop: Record<string, PopEntry>;
}

// The fourteen launch cards (docs/content/cards.md, approved 2026-10-08).
export type CardKey =
  | "mentorship" | "min-max" | "band" | "talos" | "travel" | "capital-one" | "hackathons"
  | "anthropic" | "misuki" | "ieee" | "jobs" | "this-site" | "fsdatalink" | "building-in-public";

// The book's two columns.
export type CardGroup = "work" | "people";

// width and height are the file at src.
export interface ImageRef { src: string; width: number; height: number; alt: string }
export interface PhotoRef extends ImageRef { crop: PhotoCrop | null }
// The Coil card's picture (3:4). The modal shows it first, as the flown card.
export interface CardPicture extends PhotoRef { caption: string | null }
// One of up to three photos after the card picture; keeps its own shape.
interface ModalPhotoBase extends PhotoRef {
  caption: string;
  // The phone stage's caption, so one long caption does not set the stage's height for every
  // photo; desktop keeps caption (docs/content/cards.md, "Phone fit notes"). Today only Misuki's
  // Hiroshima photo has one: "The real Mazda 787B that won Le Mans in 1991, at the Mazda Museum in Hiroshima."
  captionShort?: string;
}
// What a photo sits beside is set per photo from docs/content/cards.md ("Which paragraph each
// photo sits beside"), never by position: photo i is not block i, two photos may share a block
// (they stack under it), and the jobs photo pairs with timeline entry 3 (Apple), not a paragraph.
// block indexes modal.blocks; timeline indexes cards.jobs.timeline.
export type ModalPhoto = ModalPhotoBase & ({ block: number } | { timeline: number });
export interface LogoRef { src: string; srcDark: string | null; width: number; height: number }

// What the Coil shows. A null ref is an asset C4 has not landed.
export type CardVisual =
  // flipX mirrors left to right when drawn. If C4 bakes the mirror into the export, it sets this false in the same commit.
  | { kind: "photo"; flipX: boolean; photo: CardPicture | null }
  // subtitle: the line the min/Max slide-out animation reveals (the animation comes later).
  | { kind: "logo"; logo: LogoRef | null; tile: "plain" | "anvil"; subtitle?: string }
  | { kind: "mark" }
  | { kind: "circles" };

export type CardModalKind = "logo" | "timeline" | "mentors" | "photo";

// External, opened in a new tab.
export interface CardLink { label: string; href: string }

// Blocks carry **bold**, *italic* and the inline link markup (lib/content/links.ts).
export interface CardModal {
  kind: CardModalKind;
  title: string;
  // A shorter meta beside the modal title, so it fits a phone; absent means the modal shows
  // book.meta (docs/content/cards.md, "Phone fit notes"). The book row keeps the full roles.
  meta?: string;
  links: readonly CardLink[];
  photos: readonly ModalPhoto[];
  blocks: readonly string[];
}

export interface CardContent {
  group: CardGroup;
  visual: CardVisual;
  book: { title: string; meta: string };
  modal: CardModal;
}

export interface Mentor { name: string; href: string }
export interface MentorsList { title: string; people: readonly Mentor[] }
export interface TimelineEntry { employer: string; role: string | null; when: string; logo: LogoRef | null; tip: string }

export type Cards = Record<Exclude<CardKey, "mentorship" | "jobs">, CardContent> & {
  mentorship: CardContent & { mentors: MentorsList };
  jobs: CardContent & { timeline: readonly TimelineEntry[] };
};
