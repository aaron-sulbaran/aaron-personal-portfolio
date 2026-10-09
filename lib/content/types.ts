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
  // The exported file (scripts/export-photos.mjs); null only for a pop whose photo is not exported.
  file: { src: string; width: number; height: number } | null;
  alt: string;
  caption: string | null;
  crop: PhotoCrop | null;
  // Opens in a new tab on click; hover and the first tap still show the pop.
  href?: string;
  // The words of the link inside a tap-pinned pop (touch only).
  hrefLabel?: string;
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
// The Coil card's picture (3:4). The modal shows it first, as the flown card, with the caption in
// modal.picture.
export type CardPicture = PhotoRef;
// One of up to three photos after the card picture (four on the jobs card, whose picture is the
// circles); keeps its own shape.
interface ModalPhotoBase extends PhotoRef {
  caption: string;
  // The phone stage's caption, so one long caption does not set the stage's height for every
  // photo; desktop keeps caption (docs/content/cards.md, "Phone fit notes"). Today only Misuki's
  // Hiroshima photo has one: "The real Mazda 787B that won Le Mans in 1991, at the Mazda Museum in Hiroshima."
  captionShort?: string;
}
// What a photo sits beside is set per photo from docs/content/cards.md ("Which paragraph each
// photo sits beside"), never by position: photo i is not block i, and two photos may share a block
// (they stack under it). The jobs card's photos pair with timeline entries instead of paragraphs
// (today 1, 1, 3, 4: the two MOD photos, Apple, Aritzia), so its timeline needs room for a photo
// under an entry. block indexes modal.blocks; timeline indexes cards.jobs.timeline; never both.
export type ModalPhoto = ModalPhotoBase & ({ block: number; timeline?: never } | { timeline: number; block?: never });
export interface LogoRef { src: string; srcDark: string | null; width: number; height: number }

// What the Coil shows. A null ref is an asset not exported yet; every launch card has its asset.
export type CardVisual =
  // flipX mirrors left to right when drawn. The export bakes the manifest's mirrors in, so every launch card is false.
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
  // The card picture as the modal shows it, beside the title (its file is visual.photo); present
  // where Aaron captioned it (docs/content/cards.md, "Modal photo captions").
  picture?: { caption: string };
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

// The soundtrack (docs/content/music.md). An adapted track is credited as adapted, never as
// licensed for this site.
export type TrackLicenseKind = "cc-by-3.0" | "cc-by-4.0" | "licensed" | "adapted";

// Shown as a link, never played or embedded.
export interface InspiredBy { title: string; artist: string; href: string }

export interface SoundtrackTrack {
  title: string;
  // Whom the license says to credit: the original's author, never me for a track I only adapted.
  artist: string;
  src: string;
  // Author, title, collection, named funders, license, and "Compressed for web." for a re-encode.
  credit: string;
  licenseKind: TrackLicenseKind;
  licenseUrl: string | null;
  // Two sentences in Aaron's voice; null until he writes them.
  why: string | null;
  inspiredBy: InspiredBy | null;
  spotifyUrl: string | null;
  // A tile designed for the site; the music license never covers album art.
  cover: string | null;
}
