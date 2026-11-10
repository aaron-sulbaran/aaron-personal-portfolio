// The content model's shapes. Data lives in the sibling files and reaches
// components through siteContent in lib/content.ts, which re-exports these.

// A box inside the file at src, in that file's pixels. Export boxes on Aaron's
// originals stay in docs/content/photos.md.
export interface PhotoCrop { x: number; y: number; w: number; h: number }

// The inline register: what [words](def:key), (tip:key) and (pop:key) open.
// hint: the hover line on a definition, so the word says the click opens it. body is its paragraphs, each carrying the
// inline link markup (lib/content/links.ts), so a definition can hold a pop of its own.
export interface DefinitionEntry { title: string; body: readonly string[]; hint?: string }

export interface TipEntry {
  text: string;
  proposed?: true;
  // A clause that is true only while an adapted track is in the player.
  adaptedClause?: string;
  // A link inside the tip (https only, opens in a new tab); a linked tip's label takes the pointer.
  link?: { href: string; label: string };
}

// The point of a photo a crop keeps centred, as percentages of the file (CSS object-position): x 0 is its left edge, y 0 its top.
export interface PopFocus { x: number; y: number }

// One photo of a pop that cycles: the file, alt and caption of the pop that has it
// on its own, and where the frame's crop is centred.
export interface PopFrame {
  file: { src: string; width: number; height: number };
  alt: string;
  caption?: string;
  focus: PopFocus;
}

export interface PopEntry {
  // The exported file (scripts/export-photos.mjs); null only for a pop whose photo is not exported, or a pop that cycles (its photos are in cycle).
  file: { src: string; width: number; height: number } | null;
  alt: string;
  // Optional on purpose: a pop with no caption shows its photo alone, with no empty line or gap under it, and its alt still describes it.
  caption?: string;
  crop: PhotoCrop | null;
  // Opens in a new tab on click; hover and the first tap still show the pop.
  href?: string;
  // The words of the link inside a tap-pinned pop (touch only).
  hrefLabel?: string;
  // Where the photo's crop is centred when the pop's width is clamped to a small screen; the middle when absent.
  focus?: PopFocus;
  // A pop that shows several photos, one at a time, each with its own caption: they cycle in this order in one square frame,
  // and alt describes the set. Such a pop has no file or caption of its own.
  cycle?: readonly PopFrame[];
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
// (they stack under it). The jobs card's photos belong to a job instead of a paragraph (today 0, 1, 3, 3: the
// Aritzia poster, the Apple badge, the two MOD photos), and sit beside that job's name tag (lib/gallery/jobs).
// block indexes modal.blocks; timeline indexes cards.jobs.timeline (newest first); never both.
export type ModalPhoto = ModalPhotoBase & ({ block: number; timeline?: never } | { timeline: number; block?: never });
// opaque: the logo is its own ground (the IEEE square), drawn as the tile's face and never on a plate.
// ground: an opaque logo's edge colour, measured from the file; the card face is filled with it so the
// logo runs full bleed to the rim, with no frame of pane colour around it.
export interface LogoRef { src: string; srcDark: string | null; width: number; height: number; opaque?: true; ground?: string }

// What the Coil shows. A null ref is an asset not exported yet; every launch card has its asset.
export type CardVisual =
  // flipX mirrors left to right when drawn. The export bakes the manifest's mirrors in, so every launch card is false.
  | { kind: "photo"; flipX: boolean; photo: CardPicture | null }
  // subtitle: the line the min/Max slide-out animation reveals (the animation comes later).
  | { kind: "logo"; logo: LogoRef | null; tile: "plain" | "talos"; subtitle?: string }
  | { kind: "mark" }
  | { kind: "circles" };

export type CardModalKind = "logo" | "timeline" | "mentors" | "photo";

// External, opened in a new tab.
export interface CardLink { label: string; href: string }

// A demo video in a card's modal (components/card/CardVideo), media like a photo: it takes a row's
// side beside the paragraph it sits beside (beside indexes modal.blocks), in the photos' 4:3 frame,
// letterboxed (lib/gallery/card). src and poster are files in public; width and height are the
// video's pixels; label is its accessible name, in my words. caption: the line under it, as a photo's (absent for none).
// playOnce: a clip whose last frame differs from its first, so it must not loop: it plays itself once when the card is
// opened and holds on its last frame (components/card/CardVideo); absent, it is played on demand.
export interface CardVideoRef { src: string; poster: string; width: number; height: number; label: string; beside: number; caption?: string; playOnce?: boolean }

// A post in a card's modal, media like a photo: it takes a row's side beside the paragraph it sits beside (beside indexes
// modal.blocks), drawn as LinkedIn's own short embed (components/card/PostEmbed) with a link to the post under it. src is the
// embed's address in its collapsed form (?collapsed=1: the post's text stops at one line and "...more"); width is the frame's on a
// desktop row (a pair of photos is as wide); title is the frame's accessible name, in my words; href and cta are the link under the
// frame (a new tab): the post's own address and its words.
export interface CardEmbedRef { src: string; width: number; title: string; beside: number; href: string; cta: string }

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
  // Links that belong to one paragraph, drawn right under it (by its index in blocks) in every layout, in the card links' style; the
  // card's own links stay at its foot.
  paragraphLinks?: Readonly<Record<number, readonly CardLink[]>>;
  photos: readonly ModalPhoto[];
  blocks: readonly string[];
  // A standalone last line after the paragraphs: line, then control, a link-styled button that closes the card and plays the
  // logo's easter egg (components/card/CardEgg, lib/mark/summon). Drawn by the desktop rows and a phone card's words alone, so only
  // a card with no photos carries it (a phone's pager does not draw it).
  easterEgg?: { line: string; control: string };
  video?: CardVideoRef;
  embed?: CardEmbedRef;
  // The sentences a phone may leave out of a paragraph, by its index in blocks: verbatim, whole, in the order they go. A phone's pager
  // drops them one at a time, only on a page too short for the paragraph beside its photo (lib/gallery/paginate); the desktop and
  // every page with the room keep every word (Aaron allowed a little less text on mobile, 2026-10-30).
  phoneOmit?: Readonly<Record<number, readonly string[]>>;
}

export interface CardContent {
  // One or two words: the card's title in the cards section's columns.
  short: string;
  // The card's title in its column where that differs from short (the jobs card's "Part-time jobs"): the same face,
  // weight and colour as every other title there. Only the columns read it; the ribbon, the list and the hints keep short.
  columnShort?: string;
  visual: CardVisual;
  book: { title: string; meta: string };
  modal: CardModal;
}

// line: one sentence on how they helped me, in my words; null until I write it, and nothing renders for it.
export interface Mentor { name: string; href: string; line: string | null }
export interface MentorsList { title: string; people: readonly Mentor[] }
// One job, newest first. role is null where quick.ts's jobs entries already say it (lib/content/jobTags.ts reads it from there).
export interface TimelineEntry { employer: string; role: string | null; when: string; logo: LogoRef | null; tip: string }
// The words on a name tag around a job's tip (components/card/JobTag): the small label over the tip on a desktop, the control that
// opens it on a phone (components/card/JobTagFold), and the tag's accessible name. The tag's big text is the job's role, not my name.
export interface JobTagCopy { tipLabel: string; more: string; label: (employer: string) => string }

// The Talos modal's extras (lib/content/talos.ts): the lockup the sting ends on, a
// screenshot of its Discord channel, and where it is headed. The specialists and the eight
// reactions are kept here with their assets, though the modal no longer draws them. Every
// src is a brand kit file under public/work/logos/talos.
// One picture in a light and a dark file, shown by theme: the lockup the sting ends on, and the Discord channel.
export interface TalosLockup { alt: string; light: string; dark: string; width: number; height: number }
export interface TalosSpecialist { name: string; job: string; src: string; alt: string }
export interface TalosState { name: string; meaning: string; src: string }
export interface TalosTeam {
  lockup: TalosLockup;
  discord: TalosLockup;
  next: string;
  specialistsLabel: string;
  specialists: readonly TalosSpecialist[];
  reactions: string;
  statesLabel: string;
  states: readonly TalosState[];
}

export type Cards = Record<Exclude<CardKey, "mentorship" | "jobs" | "talos">, CardContent> & {
  mentorship: CardContent & { mentors: MentorsList };
  talos: CardContent & { team: TalosTeam };
  jobs: CardContent & { timeline: readonly TimelineEntry[]; tag: JobTagCopy };
};

// The soundtrack (docs/content/music.md). An adapted track is credited as adapted, never as
// licensed for this site. "credited" is attribution only: the song is played as an instrumental,
// credited to its artist, and no license is claimed.
export type TrackLicenseKind = "cc-by-3.0" | "cc-by-4.0" | "licensed" | "adapted" | "credited";

// Shown as a link, never played or embedded.
export interface InspiredBy { title: string; artist: string; href: string }

export interface SoundtrackTrack {
  title: string;
  // The original's artist, never me.
  artist: string;
  src: string;
  // Title, artist, album and "Instrumental." for a credited track; a licensed track adds its license.
  credit: string;
  licenseKind: TrackLicenseKind;
  licenseUrl: string | null;
  // Two sentences in Aaron's voice; null until he writes them.
  why: string | null;
  inspiredBy: InspiredBy | null;
  spotifyUrl: string | null;
  // Album art shown in the player (public/audio/covers), credited to the artists and labels;
  // null falls back to the designed tile.
  cover: string | null;
}

// One labeled block in Who I am (docs/content/who-i-am.md). Bodies carry the inline link markup
// (lib/content/links.ts); sub is a nested block under the body, today only the hobbies.
export interface WhoIAmBlock { label: string; body: string; sub?: { label: string; body: string } }
