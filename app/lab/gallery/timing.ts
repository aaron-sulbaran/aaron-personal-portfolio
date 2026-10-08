import type { Row } from "./layout";

// The mask-in as a table: which parts start together, when each starts and
// when the last one is done. Everything runs on a timer from the landing, on
// screen or not, so scrolling never waits on anything (modal-gallery.md,
// "Masking in"). No DOM and no GSAP; useMaskIn turns the table into tweens.

export interface MaskPart {
  id: string;
  // A text part split by lines staggers them; one line (or a block mask) is 1.
  lines?: number;
}

export type MaskStep = MaskPart[];

export interface MaskTiming {
  startMs: number; // when the first mask starts: the flight's landing
  lengthMs: number; // one mask, start to finish
  staggerMs: number; // between one step's start and the next
  lineStaggerMs: number; // between lines inside one split part
}

export interface MaskEntry {
  id: string;
  step: number;
  startMs: number;
  endMs: number;
  lineStartsMs: number[];
}

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
  const endMs = entries.reduce((latest, entry) => Math.max(latest, entry.endMs), t.startMs);
  return { entries, endMs };
}

// Part ids, shared by the steps and the markup's data-mask attributes.
export const partId = {
  title: "title",
  meta: "meta",
  logo: "logo",
  stage: "stage",
  block: (b: number) => `block-${b}`,
  photo: (p: number) => `photo-${p}`,
  links: "links",
};

export interface StepOptions {
  // The flown card is already in its slot when the masks start, so it never
  // masks: the logo slot for a logo card, the first photo for a photo card.
  flown: "logo" | "first-photo";
  hasLinks: boolean;
  lines?: (id: string) => number;
}

const part = (id: string, o: StepOptions): MaskPart => ({ id, lines: o.lines?.(id) ?? 1 });

// Desktop: title, meta line, then each row with its photo, then the links.
export function desktopSteps(rows: readonly Row[], firstPhoto: number | undefined, o: StepOptions): MaskStep[] {
  const skip = (photo: number) => o.flown === "first-photo" && photo === firstPhoto;
  const steps: MaskStep[] = [[part(partId.title, o)], [part(partId.meta, o)]];
  for (const row of rows) {
    if (row.kind === "text") steps.push([part(partId.block(row.block), o)]);
    else if (row.kind === "pair") steps.push([part(partId.block(row.block), o), ...(skip(row.photo) ? [] : [{ id: partId.photo(row.photo) }])]);
    else {
      const photos = row.photos.filter((p) => !skip(p)).map((p) => ({ id: partId.photo(p) }));
      if (photos.length) steps.push(photos);
    }
  }
  if (o.hasLinks) steps.push([part(partId.links, o)]);
  return steps;
}

// Phone: the stage (unless it is the flown card) with the title, then the
// meta line, then every block in order, then the links.
export function phoneSteps(blockCount: number, o: StepOptions): MaskStep[] {
  const first: MaskStep = o.flown === "first-photo" ? [part(partId.title, o)] : [{ id: partId.stage }, part(partId.title, o)];
  const steps: MaskStep[] = [first, [part(partId.meta, o)]];
  for (let b = 0; b < blockCount; b++) steps.push([part(partId.block(b), o)]);
  if (o.hasLinks) steps.push([part(partId.links, o)]);
  return steps;
}
