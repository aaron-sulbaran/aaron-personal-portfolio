// The page the line is laid on, in layer px (origin: the band's document top; components/soundtrack/path/measure): its sections,
// their words, and everything the line keeps off. The route itself is lib/wavepath/serpentine. fixtures/pages.json is
// measureAnchors' output on the real page at 1440x900, 1024x768 and 390x844.
export const SECTION_KEYS = ["band", "cards", "numbers", "connect", "footer"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export interface Span {
  top: number;
  bottom: number;
}
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface Anchors {
  width: number;
  box: Record<SectionKey, Span>;
  words: Record<SectionKey, Span>;
  blocks: Rect[]; // the ink of every [data-wave-words] block, layer px
  // Every other line of text the reader sees that no block holds (a page's number and heading, the line under page 1's button),
  // one rect per text run; a sticky one's spans its track.
  headings: Rect[];
  links: Rect[]; // every link, button and focusable control the line must keep off, as much of it as shows, layer px
  hairlines: number[];
  line?: number; // the band's wave line, layer px
}
export type Side = "left" | "right";
