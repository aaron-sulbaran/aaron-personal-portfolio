import type { LabCard } from "./cards";
import { pagesOf, photoPlan, uniformBoxes, uniformColumns, type Page, type Plan } from "./plan";
import { interleave, readingOrder, type Row } from "./rows";
import type { Settings } from "./settings";
import { desktopSteps, pagerSteps, phoneSteps, planSteps, type MaskStep, type StepOptions } from "./timing";

// One card's layouts and mask steps under the settings: the interleaved rows
// of rounds one to three, the round four plan and its pager pages. The live
// run asks with the measured line counts; the copied values without.

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
  const plan = photoPlan(card.blocks.length, card.photos, card.flownPhoto);
  return { rows, order: readingOrder(rows), plan, pages: pagesOf(plan) };
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
