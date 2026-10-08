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
