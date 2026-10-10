import type { Page, Plan, Slide } from "./plan";

// The mask-in as a table: which parts start together, when each starts and when
// the last ends. Everything runs on a timer from the start (the landing after a
// flight, at once when nothing lands), on screen or not, so scrolling never
// waits (modal-gallery.md, "Masking in"). No DOM and no GSAP:
// components/card/useMaskIn turns the table into one timeline.

export interface MaskPart { id: string; lines?: number }
export type MaskStep = MaskPart[];
export interface MaskTiming { startMs: number; lengthMs: number; staggerMs: number; lineStaggerMs: number }
export interface MaskEntry { id: string; step: number; startMs: number; endMs: number; lineStartsMs: number[] }

export function maskTable(steps: readonly MaskStep[], t: MaskTiming): { entries: MaskEntry[]; endMs: number } {
  const entries: MaskEntry[] = [];
  steps.forEach((step, index) => {
    const startMs = t.startMs + index * t.staggerMs;
    for (const part of step) {
      const lines = Math.max(1, Math.floor(part.lines ?? 1));
      const lineStartsMs = Array.from({ length: lines }, (_, line) => startMs + line * t.lineStaggerMs);
      entries.push({ id: part.id, step: index, startMs, endMs: lineStartsMs[lines - 1] + t.lengthMs, lineStartsMs });
    }
  });
  return { entries, endMs: entries.reduce((latest, entry) => Math.max(latest, entry.endMs), t.startMs) };
}

// The ids the steps and the markup's data-mask attributes share.
export const partId = {
  title: "title",
  meta: "meta",
  mentors: "mentors",
  links: "links",
  pager: "pager",
  words: (unit: number) => `words-${unit}`,
  photo: (photo: number) => `photo-${photo}`,
  caption: (photo: number) => `caption-${photo}`,
  rotator: (photo: number) => `rotator-${photo}`,
} as const;

export interface StepOptions {
  flown?: number; // the photo a parked flown card covers: it never masks (its caption does)
  hasCaption: (photo: number) => boolean;
  hasLinks: boolean;
  trailing?: readonly string[]; // parts after the plan and before the links (the mentors)
  lines?: (id: string) => number;
}

const part = (id: string, o: StepOptions): MaskPart => ({ id, lines: o.lines?.(id) ?? 1 });

function photoParts(photo: number, o: StepOptions): MaskPart[] {
  const parts: MaskPart[] = photo === o.flown ? [] : [{ id: partId.photo(photo) }];
  if (o.hasCaption(photo)) parts.push(part(partId.caption(photo), o));
  return parts;
}

function slideParts(slide: Slide, o: StepOptions): MaskPart[] {
  const words = (unit: number) => part(partId.words(unit), o);
  return [...photoParts(slide.photo, o), ...slide.before.map(words), ...(slide.own === undefined ? [] : [words(slide.own)]), ...slide.after.map(words)];
}

const ends = (o: StepOptions): MaskStep[] => [...(o.trailing ?? []).map((id) => [part(id, o)]), ...(o.hasLinks ? [[part(partId.links, o)]] : [])];

// Desktop: the title, the meta line, the opening words one by one, each row's
// photo, caption and words together (a turning row adds its controls), the
// closing words, the trailing parts, the links.
export function planSteps(plan: Plan, o: StepOptions): MaskStep[] {
  const steps: MaskStep[] = [[part(partId.title, o)], [part(partId.meta, o)]];
  for (const unit of plan.intro) steps.push([part(partId.words(unit), o)]);
  for (const slide of plan.slides) steps.push([...slideParts(slide, o), ...(slide.photos.length > 1 ? [{ id: partId.rotator(slide.photo) }] : [])]);
  for (const unit of plan.closing) steps.push([part(partId.words(unit), o)]);
  return [...steps, ...ends(o)];
}

// Phone: the title, the meta line, the first page's photo and caption, its words
// (and the trailing parts and links when it is the last page), then the pager's
// controls. Later pages are off screen until turned to, long after the masks end.
export function pagerSteps(pages: readonly Page[], o: StepOptions): MaskStep[] {
  const steps: MaskStep[] = [[part(partId.title, o)], [part(partId.meta, o)]];
  const first = pages[0];
  if (first) {
    const photo = photoParts(first.photo, o);
    if (photo.length) steps.push(photo);
    const words = slideParts(first, o).slice(photo.length);
    if (first.links) words.push(...ends(o).flat());
    if (words.length) steps.push(words);
  }
  if (pages.length > 1) steps.push([{ id: partId.pager }]);
  return steps;
}
