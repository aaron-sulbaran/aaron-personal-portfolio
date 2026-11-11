import {
  arcDots,
  checkDots,
  dotsAlong,
  hexLattice,
  preparePath,
  questionDots,
  roundedRectDots,
  type Point,
} from "./dots";

// One fact's trip, drawn in bees (the second section of /hive-story, from
// direction B): a Discord message, its quote, the code check, the stronger
// check, the fact landing in the Hive with a thread back to its source, then a
// Drive doc that disagrees and a question. Every part carries the step (1 to 6)
// it appears at; the page shows them all at rest and plays them in order.

export const TRIP_BOX = { width: 360, height: 270 };
export const TRIP_STEPS = 6;

export type TripPart =
  | { at: number; kind: "dots"; points: Point[]; r: number; opacity?: number }
  | { at: number; kind: "rings"; points: Point[]; r: number }
  | { at: number; kind: "glow"; x: number; y: number; w: number; h: number }
  | { at: number; kind: "label"; x: number; y: number; text: "discord" | "drive" | "hive" | "question"; anchor: "start" | "middle"; size: number };

const row = (x0: number, x1: number, y: number) => dotsAlong(preparePath([{ x: x0, y }, { x: x1, y }]), 5);

function docOutline(x: number, y: number, w: number, h: number, fold: number): Point[] {
  const path = preparePath([
    { x, y }, { x: x + w - fold, y }, { x: x + w, y: y + fold }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y },
  ]);
  return [...dotsAlong(path, 6), ...dotsAlong(preparePath([{ x: x + w - fold, y }, { x: x + w - fold, y: y + fold }, { x: x + w, y: y + fold }]), 6)];
}

export const MESSAGE = { x: 16, y: 16, w: 170, h: 78 };
export const DOC = { x: 16, y: 156, w: 152, h: 96 };
export const COMB = { cx: 292, cy: 196, R: 52 };
export const MESSAGE_QUOTE = { x0: 52, x1: 122, y: 67 };
export const DOC_QUOTE = { x0: 40, x1: 104, y: 214 };
export const FACT_SLOT: Point = { x: 268, y: 196 };
export const QUESTION_AT: Point = { x: 206, y: 236 };

export const TRIP: TripPart[] = [
  // 1. Someone says it.
  { at: 1, kind: "dots", points: roundedRectDots(MESSAGE.x, MESSAGE.y, MESSAGE.w, MESSAGE.h, 12, 6), r: 1.3 },
  { at: 1, kind: "label", x: 28, y: 37, text: "discord", anchor: "start", size: 12 },
  { at: 1, kind: "dots", points: [...row(28, 168, 54), ...row(28, 48, 67), ...row(126, 150, 67), ...row(28, 110, 80)], r: 1.05, opacity: 0.55 },
  // 2. Its exact words.
  { at: 2, kind: "glow", x: MESSAGE_QUOTE.x0 - 5, y: MESSAGE_QUOTE.y - 6, w: MESSAGE_QUOTE.x1 - MESSAGE_QUOTE.x0 + 10, h: 12 },
  { at: 1, kind: "dots", points: row(MESSAGE_QUOTE.x0, MESSAGE_QUOTE.x1, MESSAGE_QUOTE.y), r: 1.5 },
  // 3. Code finds the quote. 4. A stronger model agrees.
  { at: 3, kind: "dots", points: checkDots(212, 46, 22), r: 1.9 },
  { at: 4, kind: "dots", points: [...arcDots(258, 50, 15, 0, Math.PI * 2, 6.3).slice(1), ...checkDots(258, 51, 14)], r: 1.6 },
  // 5. It lands in the Hive, with a thread back to where it was said.
  { at: 0, kind: "dots", points: hexLattice(COMB.cx, COMB.cy, COMB.R, 8.2).filter((p) => Math.hypot(p.x - FACT_SLOT.x, p.y - FACT_SLOT.y) > 6), r: 2.1, opacity: 0.85 },
  { at: 0, kind: "label", x: COMB.cx, y: COMB.cy - COMB.R - 10, text: "hive", anchor: "middle", size: 12 },
  { at: 5, kind: "dots", points: dotsAlong(preparePath([{ x: MESSAGE_QUOTE.x1 + 4, y: MESSAGE_QUOTE.y }, { x: 196, y: MESSAGE_QUOTE.y }, { x: 196, y: FACT_SLOT.y }, { x: FACT_SLOT.x - 8, y: FACT_SLOT.y }]), 6), r: 1.05, opacity: 0.6 },
  { at: 5, kind: "rings", points: [FACT_SLOT], r: 4.6 },
  // 6. A Drive doc says otherwise, and the Hive asks.
  { at: 6, kind: "dots", points: docOutline(DOC.x, DOC.y, DOC.w, DOC.h, 14), r: 1.3 },
  { at: 6, kind: "label", x: 28, y: 177, text: "drive", anchor: "start", size: 12 },
  { at: 6, kind: "dots", points: [...row(28, 150, 196), ...row(28, 34, 214), ...row(110, 148, 214), ...row(28, 120, 232)], r: 1.05, opacity: 0.55 },
  { at: 6, kind: "glow", x: DOC_QUOTE.x0 - 5, y: DOC_QUOTE.y - 6, w: DOC_QUOTE.x1 - DOC_QUOTE.x0 + 10, h: 12 },
  { at: 6, kind: "dots", points: row(DOC_QUOTE.x0, DOC_QUOTE.x1, DOC_QUOTE.y), r: 1.5 },
  { at: 6, kind: "dots", points: dotsAlong(preparePath([{ x: DOC.x + DOC.w + 4, y: 236 }, { x: QUESTION_AT.x - 14, y: 236 }]), 6), r: 1.05, opacity: 0.6 },
  { at: 6, kind: "dots", points: dotsAlong(preparePath([{ x: FACT_SLOT.x - 6, y: FACT_SLOT.y + 8 }, { x: QUESTION_AT.x + 12, y: QUESTION_AT.y - 14 }]), 6), r: 1.05, opacity: 0.6 },
  { at: 6, kind: "dots", points: questionDots(QUESTION_AT.x, QUESTION_AT.y - 4, 7, 4.6), r: 1.7 },
  { at: 6, kind: "label", x: QUESTION_AT.x, y: 264, text: "question", anchor: "middle", size: 10.5 },
];

// Where the two travelling bees go: the quote to its seat in the Hive (step 5),
// and the doc's quote to the question (step 6). The player animates along these.
export const TRIP_ROUTES: Record<5 | 6, readonly Point[]> = {
  5: [{ x: MESSAGE_QUOTE.x1, y: MESSAGE_QUOTE.y }, { x: 196, y: MESSAGE_QUOTE.y }, { x: 196, y: FACT_SLOT.y }, FACT_SLOT],
  6: [{ x: DOC_QUOTE.x1, y: DOC_QUOTE.y }, { x: DOC.x + DOC.w + 4, y: DOC_QUOTE.y }, { x: DOC.x + DOC.w + 4, y: 236 }, { x: QUESTION_AT.x - 10, y: 236 }],
};
