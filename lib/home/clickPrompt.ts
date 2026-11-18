import { COIL } from "@/lib/coil/constants";
import { dealMs } from "@/lib/coil/dealSpeed";
import type { InputDriver } from "@/lib/coil/drivers";
import { tunedConstants } from "@/lib/coil/entrance";
import { siteContent } from "@/lib/content";
import { entranceTuningOf, type DealKnobs } from "@/lib/home/dealKnobs";

// The "click a card to open it" moment's pure rules: its plan in ms from the
// click, the line under the Work column, where the big line plays and how big,
// and one frame of its shrink. The DOM drivers read these; nothing here touches it.

const P = COIL.deal.prompt;

// The one moment, every time in ms from the click (the deal master's zero). The line fades in as the
// Coil lands and is read alone beside the lit Coil, with the page's title and lists still waiting; it
// shrinks into the resting line and hands over to it in place. The columns start half way through the
// shrink's travel: by then the line is mostly its resting size, so the title never fades in over a
// line bigger than itself (Aaron's recordings, 2026-11-18: lists that landed first were dimmed under
// the line and read before it).
export type PromptPlan = {
  startMs: number; // the Coil's landing: the line starts to fade in
  shownMs: number; // at full strength
  shrinkStartMs: number;
  shrinkEndMs: number; // the travel ends: the line is on its resting spot
  handoffStartMs: number; // the crossfade into the resting line, in place
  endMs: number;
  lockUntilMs: number; // the cutscene's lock holds the reader's scroll until then; its cap still wins
  columnsAtMs: number; // the page's title, labels and lists start
  titleRatio: number; // the start size in page titles
  dimStrength: number; // the dim, as a share of its token
};

export function promptPlan(knobs: DealKnobs): PromptPlan {
  const startMs = dealMs(tunedConstants(entranceTuningOf(knobs)));
  const shownMs = startMs + P.inMs;
  const shrinkStartMs = shownMs + knobs.promptAloneMs;
  const endMs = shrinkStartMs + knobs.promptShrinkMs;
  const shrinkEndMs = endMs - P.handoffMs;
  return {
    startMs,
    shownMs,
    shrinkStartMs,
    shrinkEndMs,
    handoffStartMs: shrinkEndMs,
    endMs,
    lockUntilMs: endMs,
    columnsAtMs: Math.round((shrinkStartMs + shrinkEndMs) / 2),
    titleRatio: knobs.promptTitleRatio,
    dimStrength: knobs.promptDimStrength,
  };
}

// The big line's wanted font size: that many page titles, never bigger than its share of the viewport
// (a hint never outshouts the page it sits on). With no page title to measure, the viewport's share.
export function promptStartPx(args: { vwPx: number; titlePx: number | null; titleRatio: number }): number {
  const { vwPx, titlePx, titleRatio } = args;
  if (titlePx === null || !(titlePx > 0)) return vwPx;
  return Math.min(vwPx, titleRatio * titlePx);
}

// One rule for who is shown the prompt, big and resting: no card opened in this
// tab and none opened on an earlier visit. The big moment and the resting line both ask it.
export function promptDue(args: { opened: number; openedBefore: boolean }): boolean {
  return args.opened === 0 && !args.openedBefore;
}

const CARD_KEYS: ReadonlySet<string> = new Set(siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => title.key))));

// How many of the cards' keys a seen set holds (other keys in the store do not count).
export function openedCardCount(seen: ReadonlySet<string>): number {
  let opened = 0;
  seen.forEach((key) => {
    if (CARD_KEYS.has(key)) opened += 1;
  });
  return opened;
}

export type ProgressLine = { kind: "prompt" | "count" | "none"; text: string };

export function progressLine(args: { opened: number; total: number; openedBefore: boolean; input: InputDriver }): ProgressLine {
  const { opened, total, openedBefore, input } = args;
  const count = siteContent.columns.progress(opened, total);
  if (opened > 0) return { kind: "count", text: count };
  if (promptDue({ opened, openedBefore })) return { kind: "prompt", text: siteContent.columns.prompt[input] };
  return { kind: "none", text: count };
}

export type Box = { left: number; top: number; width: number; height: number };

// The oval of light over the Coil: centred on the part of the stage on screen, its radii shares of that
// part (COIL.deal.prompt.lit), clear out to `clear` of the radius and fully dim at the radius. Null when
// the stage is off screen: nothing to light, so nothing to dim.
export type LitArea = { cx: number; cy: number; rx: number; ry: number; clear: number };

export function litArea(stage: Box, viewportHeight: number): LitArea | null {
  const top = Math.max(0, stage.top);
  const bottom = Math.min(viewportHeight, stage.top + stage.height);
  if (bottom <= top || stage.width <= 0) return null;
  return { cx: stage.left + stage.width / 2, cy: (top + bottom) / 2, rx: stage.width * P.lit.rx, ry: (bottom - top) * P.lit.ry, clear: P.lit.clear };
}

export type Edges = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };

const cornersOf = (box: Edges): Point[] => [
  { x: box.left, y: box.top },
  { x: box.right, y: box.top },
  { x: box.right, y: box.bottom },
  { x: box.left, y: box.bottom },
];

// Two convex shapes meet unless one of their edges' normals separates them (a shared edge is apart).
function convexMeet(a: readonly Point[], b: readonly Point[]): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const from = shape[i];
      const to = shape[(i + 1) % shape.length];
      const normal = { x: from.y - to.y, y: to.x - from.x };
      const along = (points: readonly Point[]) => points.map((point) => point.x * normal.x + point.y * normal.y);
      const [pa, pb] = [along(a), along(b)];
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

const grown = (box: Edges, x: number, y: number): Edges => ({ left: box.left - x, top: box.top - y, right: box.right + x, bottom: box.bottom + y });

// The band the big line may use in the Work column: from the Work list's foot to the screen's foot, kept
// COIL.deal.prompt.chromeGapPx clear of the Music pill's row on the side of the line the row is on. Empty
// when the row is over the line itself (a short window), so nothing can be vouched for there.
export function columnBand(args: { line: Edges; aboveBottom: number; footTop: number; pill: Edges | null }): { aboveBottom: number; belowTop: number } {
  const { line, aboveBottom, footTop, pill } = args;
  if (!pill) return { aboveBottom, belowTop: footTop };
  if (pill.bottom <= line.top) return { aboveBottom: Math.max(aboveBottom, pill.bottom + P.chromeGapPx), belowTop: footTop };
  if (pill.top >= line.bottom) return { aboveBottom, belowTop: Math.min(footTop, pill.top - P.chromeGapPx) };
  return { aboveBottom, belowTop: aboveBottom };
}

// The big moment plays on the resting line itself. The text keeps the line's left edge, sits on the
// line's middle when the band between what is above (the page title on a phone, the Work list from
// 768 px wide) and what is below has room, and is cut to fit that band, the screen and, given `quads`,
// to keep COIL.deal.prompt.cardGapPx of air from every card. Never smaller than the line.
// clear: the place can be vouched for. False when the band or the screen has no room for even the
// line's own size, the line itself sits outside the band, or a card is in the way at that size: the
// big line then does not play.
export function titleInPlace(args: {
  line: Edges;
  aboveBottom: number; // the bottom of what sits above the line
  belowTop: number; // where what sits below it begins
  rightEdge: number; // the furthest right the text may reach
  perPx: { width: number; height: number };
  wantPx: number;
  linePx: number;
  quads?: readonly (readonly Point[])[];
}): { px: number; left: number; top: number; clear: boolean } {
  const { line, aboveBottom, belowTop, rightEdge, perPx, wantPx, linePx, quads = [] } = args;
  const air = P.textAirPx;
  const fitPx = Math.min((belowTop - aboveBottom - 2 * air) / perPx.height, (rightEdge - line.left) / perPx.width);
  const placeAt = (px: number) => {
    const height = perPx.height * px;
    const middle = (line.top + line.bottom) / 2;
    const lowest = belowTop - air - height;
    return { px, left: line.left, top: Math.max(aboveBottom + air, Math.min(lowest, middle - height / 2)) };
  };
  const roomPx = Math.max(linePx, Math.min(wantPx, fitPx));
  const clearAt = (px: number) => {
    const at = placeAt(px);
    const aired = cornersOf(grown({ left: at.left, top: at.top, right: at.left + perPx.width * px, bottom: at.top + perPx.height * px }, P.cardGapPx, P.cardGapPx));
    return !quads.some((quad) => convexMeet(aired, quad));
  };
  // Room for at least the line's own size, around the line itself.
  const fits = fitPx >= linePx && line.top >= aboveBottom && line.bottom <= belowTop;
  if (clearAt(roomPx)) return { ...placeAt(roomPx), clear: fits };
  if (!clearAt(linePx)) return { ...placeAt(linePx), clear: false };
  // A smaller text sits inside a bigger one (same left edge, held in the same band), so the fit is monotone: bisect it.
  let [low, high] = [linePx, roomPx];
  for (let step = 0; step < 12; step++) {
    const mid = (low + high) / 2;
    if (clearAt(mid)) low = mid;
    else high = mid;
  }
  return { ...placeAt(low), clear: fits };
}

export type PromptProgress = { inP: number; shrinkP: number; handoffP: number };

// The text's transform origin is its top left corner.
export function promptFrame(p: PromptProgress, from: Box, to: Box) {
  const scale = 1 + (to.width / from.width - 1) * p.shrinkP;
  const fromMiddle = from.top + from.height / 2;
  const toMiddle = to.top + to.height / 2;
  const middle = fromMiddle + (toMiddle - fromMiddle) * p.shrinkP;
  return {
    x: from.left + (to.left - from.left) * p.shrinkP,
    y: middle - (from.height * scale) / 2,
    scale,
    opacity: p.inP * (1 - p.handoffP),
    lineOpacity: p.handoffP,
    dimOpacity: p.inP * (1 - p.shrinkP),
  };
}

// A fast-forward only ever speeds the run up: a stream of inputs must not re-slow it.
export function fasterScale(current: number, next: number): number {
  return Math.max(current, next);
}

// Where the run should be and how fast, once input lands the line early:
// the shrink and hand-off play in `fastMs`, never slower than planned. Times are ms from the click.
export function fastForward(plan: PromptPlan, nowMs: number, fastMs: number): { seekMs: number; timeScale: number } | null {
  if (nowMs >= plan.endMs) return null;
  if (nowMs < plan.shrinkStartMs) return { seekMs: plan.shrinkStartMs, timeScale: (plan.endMs - plan.shrinkStartMs) / fastMs };
  return { seekMs: nowMs, timeScale: Math.max(1, (plan.endMs - nowMs) / fastMs) };
}

const MODIFIER_KEYS: ReadonlySet<string> = new Set(["Shift", "Control", "Alt", "Meta"]);

// While the line is read any key lands it, except a bare modifier (the start of a shortcut).
export function fastForwardsOnKey(key: string): boolean {
  return !MODIFIER_KEYS.has(key);
}
