import type { LabCard } from "./cards";
import { boxFor, groupFrame, pagesOf, photoPlan, rotatingPages, rotatingPlan, slideText, uniformBoxes, uniformColumns, type Page, type Plan } from "./plan";
import { interleave, readingOrder, type Row } from "./rows";
import type { Settings } from "./settings";
import { desktopSteps, pagerSteps, phoneSteps, planSteps, type MaskStep, type StepOptions } from "./timing";

// One card's layouts and mask steps under the settings: the interleaved rows
// of rounds one to three, the round four or five plan and its pager pages.
// The live run asks with the measured line counts; the copied values without.

export interface CardLayout {
  rows: Row[];
  order: number[];
  plan: Plan;
  pages: Page[];
}

export function cardLayout(card: LabCard, aspects: readonly number[], s: Settings): CardLayout {
  const rows = interleave(
    card.blocks.length,
    card.photos.map((p, i) => ({ block: p.block, aspect: aspects[i] })),
    { extrasPerRow: s.extrasPerRow, wideFrom: s.wideFrom, lead: card.flownPhoto, leadMode: s.leadMode },
  );
  const rotate = s.extras === "rotate";
  const plan = (rotate ? rotatingPlan : photoPlan)(card.blocks.length, card.photos, card.flownPhoto);
  return { rows, order: readingOrder(rows), plan, pages: rotate ? rotatingPages(plan) : pagesOf(plan) };
}

export function stepsOf(card: LabCard, layout: CardLayout, s: Settings, mode: "desktop" | "phone", lines?: (id: string) => number): MaskStep[] {
  const o: StepOptions = { flownPhoto: card.flownPhoto, hasCaption: (p) => !!card.photos[p].caption, hasLinks: card.links.length > 0, lines };
  if (mode === "desktop") return s.desktopLayout === "rows" ? planSteps(layout.plan, o) : desktopSteps(layout.rows, o);
  if (s.phoneLayout === "pager") return pagerSteps(layout.pages, o);
  return phoneSteps(card.blocks.length, layout.order[0], { ...o, stageCaption: card.photos.some((p) => p.caption) });
}

// Round four's desktop columns: the card's photo column and the panel it
// asks for (the modal caps it by the viewport), its 1px border included so
// the text column is exactly the setting.
export const DESKTOP_PAD = 40;
const PANEL_BORDER = 1;
export function desktopColumns(aspects: readonly number[], s: Settings) {
  const boxes = uniformBoxes(s.verticalWidth, s.horizontalWidth, s.horizontalShape);
  const { slot, panel } = uniformColumns(aspects, boxes, s.wideFrom, s.columnGap, s.textWidth, DESKTOP_PAD);
  return { slot, panel: panel + 2 * PANEL_BORDER };
}

// What the rule made of a card, for the panel: its rows on desktop, in
// Aaron's numbering (photos as the shape picker lists them, blocks as
// paragraphs from 1), and its pages on a phone.
export interface Grouping {
  summary: string;
  rows: string[];
}

const list = (xs: readonly number[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const paragraphs = (bs: readonly number[]) => `${bs.length === 1 ? "paragraph" : "paragraphs"} ${list(bs.map((b) => b + 1))}`;

export function groupingOf(card: LabCard, aspects: readonly number[], s: Settings): Grouping {
  const { plan, pages } = cardLayout(card, aspects, s);
  const boxes = uniformBoxes(s.verticalWidth, s.horizontalWidth, s.horizontalShape);
  const photoCount = card.photos.length;
  const blockCount = card.blocks.length;
  const turns = plan.slides.some((slide) => (slide.photos?.length ?? 1) > 1);
  const rows: string[] = [];
  if (plan.intro.length) rows.push(`Opens with ${paragraphs(plan.intro)}`);
  plan.slides.forEach((slide, i) => {
    const photos = slide.photos ?? [slide.photo];
    const { blocks, note } = slideText(slide);
    const frame = groupFrame(photos.map((p) => boxFor(aspects[p], boxes, s.wideFrom)));
    const who =
      photos.length > 1
        ? `photos ${list(photos.map((p) => p + 1))} take turns (${Math.round(frame.width)} by ${Math.round(frame.height)}px frame)`
        : `photo ${slide.photo + 1}${slide.photo === card.flownPhoto ? " (card picture)" : ""}${turns ? ", still" : ""}`;
    const words = blocks.length ? `beside ${paragraphs(blocks)}` : note ? "beside a placeholder" : "with no words";
    rows.push(`Row ${i + 1}: ${who}, ${words}`);
  });
  if (plan.closing.length) rows.push(`Closes with ${paragraphs(plan.closing)}`);
  const shape = photoCount > blockCount ? "more photos than words" : "words for every photo";
  return { summary: `${photoCount} photos, ${blockCount} paragraphs: ${shape}; ${pages.length} pages on a phone`, rows };
}
