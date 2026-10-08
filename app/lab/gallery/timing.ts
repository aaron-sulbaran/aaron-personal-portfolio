import type { Row } from "./rows";

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
  stageCaption: "stage-caption",
  block: (b: number) => `block-${b}`,
  photo: (p: number) => `photo-${p}`,
  caption: (p: number) => `caption-${p}`,
  links: "links",
};

export interface StepOptions {
  // The flown card is already in its slot when the masks start, so it never
  // masks: the logo slot for a logo card (no flownPhoto), else the photo
  // that is the card picture. Its caption still masks.
  flownPhoto?: number;
  hasCaption: (photo: number) => boolean;
  hasLinks: boolean;
  lines?: (id: string) => number;
}

const part = (id: string, o: StepOptions): MaskPart => ({ id, lines: o.lines?.(id) ?? 1 });

function photoParts(photo: number, o: StepOptions): MaskPart[] {
  const parts: MaskPart[] = photo === o.flownPhoto ? [] : [{ id: partId.photo(photo) }];
  if (o.hasCaption(photo)) parts.push(part(partId.caption(photo), o));
  return parts;
}

// Desktop: title, meta line, then each row with its photo and caption, then
// the links. A row with nothing left to mask adds no step.
export function desktopSteps(rows: readonly Row[], o: StepOptions): MaskStep[] {
  const steps: MaskStep[] = [[part(partId.title, o)], [part(partId.meta, o)]];
  const push = (step: MaskStep) => {
    if (step.length) steps.push(step);
  };
  for (const row of rows) {
    if (row.kind === "text") push([part(partId.block(row.block), o)]);
    else if (row.kind === "pair" || row.kind === "stack") push([...photoParts(row.photo, o), part(partId.block(row.block), o)]);
    else if (row.kind === "wide") push(photoParts(row.photo, o));
    else push(row.photos.flatMap((p) => photoParts(p, o)));
  }
  if (o.hasLinks) steps.push([part(partId.links, o)]);
  return steps;
}

// Phone: the stage and its caption with the title (the stage only when its
// first photo is not the flown card), then the meta line, then every block
// in order, then the links.
export function phoneSteps(blockCount: number, firstStagePhoto: number | undefined, o: StepOptions & { stageCaption: boolean }): MaskStep[] {
  const first: MaskStep = [];
  if (firstStagePhoto !== undefined && firstStagePhoto !== o.flownPhoto) first.push({ id: partId.stage });
  if (o.stageCaption) first.push({ id: partId.stageCaption });
  first.push(part(partId.title, o));
  const steps: MaskStep[] = [first, [part(partId.meta, o)]];
  for (let b = 0; b < blockCount; b++) steps.push([part(partId.block(b), o)]);
  if (o.hasLinks) steps.push([part(partId.links, o)]);
  return steps;
}
