import { COIL } from "@/lib/coil/constants";
import { dealMs } from "@/lib/coil/dealSpeed";
import type { InputDriver } from "@/lib/coil/drivers";
import { tunedConstants } from "@/lib/coil/entrance";
import { siteContent } from "@/lib/content";
import { entranceTuningOf, modeForVersion, PROMPT_MODES, PROMPT_TITLE_PLACES, startsOnLanding, PROMPT_VERSIONS, type DealKnobs, type PromptMode, type PromptTitlePlace, type PromptVersion } from "@/lib/home/dealKnobs";

// The "click a card to open it" moment's pure rules: its plan in ms from the
// click, the line under the Work column, where the big text starts, and one
// frame of its shrink. The DOM drivers read these; nothing here touches it.

const P = COIL.deal.prompt;

export type PromptOverride = { version?: PromptVersion; mode?: PromptMode; place?: PromptTitlePlace };

// ?coildebug=...,prompt=<version>,timing=<mode>,place=<G's place>: a value that is not one of
// the lab's choices is ignored.
export function promptOverride(search: string): PromptOverride {
  const tokens = (new URLSearchParams(search).get("coildebug") ?? "").split(",").map((token) => token.trim());
  const valueOf = (key: string) => tokens.find((token) => token.startsWith(`${key}=`))?.slice(key.length + 1);
  const version = PROMPT_VERSIONS.find((choice) => choice === valueOf("prompt"));
  const mode = PROMPT_MODES.find((choice) => choice === valueOf("timing"));
  const place = PROMPT_TITLE_PLACES.find((choice) => choice === valueOf("place"));
  return { ...(version && { version }), ...(mode && { mode }), ...(place && { place }) };
}

export type PromptPlan = {
  version: PromptVersion;
  mode: PromptMode;
  startMs: number;
  shownMs: number;
  shrinkStartMs: number;
  handoffStartMs: number;
  endMs: number; // all of the above in ms from the click (the master's zero)
  lockUntilMs: number | null; // Hold only: the shrink's end, ms from the click; the lock's cap still wins
  sizeVw: { desktop: number; phone: number };
  titleRatio: number | null; // E, F and G: the start size in page titles, capped at sizeVw; null for A to D
  dimStrength: number; // F and G: the dim's strength as a share of its token
  // When the shrink's travel ends, ms from the click. G lands first and hands off in place (its pill would
  // otherwise slide over the line as the line fades in); the rest still travel through the hand-off.
  shrinkEndMs: number;
  // G from 768 px wide: the top row on its plate ("row"), the top row as words only ("bare"), or where the
  // line rests in the Work column ("column", as a phone always plays it).
  titlePlace: PromptTitlePlace;
  // G in Hold: the page's title and columns wait for the line and come in half way through its shrink, ms
  // from the click, so a first visitor reads one instruction beside the lit Coil before the lists arrive
  // (Aaron's recordings, 2026-11-18: the lists landed bright 460 ms before the line, then were dimmed
  // under it). Half way, not at the shrink's start: by then the line is mostly its resting size, so the
  // title never fades in over a line bigger than itself. null: the deal's own time
  // (COIL.deal.columns.delayMs after the condense).
  columnsAtMs: number | null;
};

export function promptPlan(knobs: DealKnobs, override: PromptOverride = {}): PromptPlan {
  const version = override.version ?? knobs.promptVersion;
  const chosenMode = override.mode ?? knobs.promptMode;
  const mode = modeForVersion(version, chosenMode);
  const c = tunedConstants(entranceTuningOf(knobs));
  const anchor = mode === "early" ? knobs.condenseMs + knobs.pullStartMs : dealMs(c);
  const startKnob = { early: knobs.promptEarlyStartMs, hold: knobs.promptHoldStartMs, after: knobs.promptAfterStartMs }[mode];
  // D and F light a Coil that must already stand still: never before the landing.
  const startMs = Math.max(0, anchor + startKnob, startsOnLanding(version) ? dealMs(c) : 0);
  const shownMs = startMs + P.inMs;
  // Line first: G in Hold is read with the page still waiting, on its own shorter hold.
  const lineFirst = version === "title" && mode === "hold";
  const shrinkStartMs = shownMs + (lineFirst ? knobs.promptAloneMs : Math.max(knobs.promptHoldMs, P.minHoldMs));
  const endMs = shrinkStartMs + knobs.promptShrinkMs;
  // G lands before its hand-off (below); the rest travel through it.
  const shrinkEndMs = version === "title" ? endMs - P.handoffMs : endMs;
  return {
    version,
    mode,
    startMs,
    shownMs,
    shrinkStartMs,
    handoffStartMs: endMs - P.handoffMs,
    endMs,
    lockUntilMs: mode === "hold" ? endMs : null,
    sizeVw: { desktop: knobs.promptSizeVwDesktop, phone: knobs.promptSizeVwPhone },
    titleRatio: version === "quiet" || version === "lit" || version === "title" ? knobs.promptTitleRatio : null,
    dimStrength: knobs.promptDimStrength,
    shrinkEndMs,
    titlePlace: override.place ?? knobs.promptTitlePlace,
    columnsAtMs: lineFirst ? Math.round((shrinkStartMs + shrinkEndMs) / 2) : null,
  };
}

// The big text's starting font size: the plan's share of the viewport, or for E and F that many
// page titles when it is smaller (a hint never outshouts the page it sits on).
export function promptStartPx(args: { vwPx: number; titlePx: number | null; titleRatio: number | null }): number {
  const { vwPx, titlePx, titleRatio } = args;
  if (titleRatio === null || titlePx === null || !(titlePx > 0)) return vwPx;
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

// The big text's font size cut to fit `room` px wide. The plate reaches
// COIL.deal.prompt.plateOverhangEm past each side of the text, so for that
// version the plate (text plus both overhangs) is what must fit, not the text alone.
export function promptFitPx(args: { px: number; textWidth: number; room: number; version: PromptVersion }): number {
  const { px, textWidth, room, version } = args;
  const plateWidth = version === "plate" || version === "quiet" ? 2 * P.plateOverhangEm * px : 0;
  const width = textWidth + plateWidth;
  return width > room && textWidth > 0 ? px * (room / width) : px;
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

const clampTo = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function promptOrigin(
  version: PromptVersion,
  stage: Box,
  text: { width: number; height: number },
  phone: boolean,
  mode: PromptMode,
): { left: number; top: number } {
  const place = mode === "early" ? P.calm.early : P.calm.rest;
  // B and F start in the Coil's measured quiet place; F always plays at rest (Hold or After).
  const middleShare = version === "calm" || version === "lit" ? (phone ? place.phoneY : place.desktopY) : 0.5;
  const centerX = stage.left + stage.width / 2;
  const centerY = stage.top + stage.height * middleShare;
  // Held to the gutters; the gutter wins when the text is wider than the room.
  const maxLeft = stage.left + stage.width - P.gutterPx - text.width;
  const maxTop = stage.top + stage.height - P.gutterPx - text.height;
  return {
    left: Math.max(stage.left + P.gutterPx, Math.min(maxLeft, centerX - text.width / 2)),
    top: clampTo(centerY - text.height / 2, stage.top + P.clearTopPx, maxTop),
  };
}

// Version F's oval of light: centred on the part of the stage on screen, its radii shares of that part
// (COIL.deal.prompt.lit), clear out to `clear` of the radius and fully dim at the radius.
export type LitArea = { cx: number; cy: number; rx: number; ry: number; clear: number };

export function litArea(stage: Box, viewportHeight: number, phone: boolean): LitArea | null {
  const top = Math.max(0, stage.top);
  const bottom = Math.min(viewportHeight, stage.top + stage.height);
  if (bottom <= top || stage.width <= 0) return null;
  const shape = phone ? P.lit.phone : P.lit.desktop;
  const height = bottom - top;
  return { cx: stage.left + stage.width / 2, cy: (top + bottom) / 2, rx: stage.width * shape.rx, ry: height * shape.ry, clear: shape.clear };
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
const boxesMeet = (a: Edges, b: Edges) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Version G's pill for a font size and a centre: the text's box plus the plate's reach, hanging from the row's top.
export function titlePill(px: number, centerX: number, rowTop: number, perPx: { width: number; height: number }): Edges {
  const width = (perPx.width + 2 * P.title.plateXEm) * px;
  const height = (perPx.height + 2 * P.title.plateYEm) * px;
  return { left: centerX - width / 2, top: rowTop, right: centerX + width / 2, bottom: rowTop + height };
}

export type TitlePlace = {
  px: number; // the text's font size
  left: number;
  top: number; // the text box's corner in viewport px (the pill reaches the plate's overhang past it)
  clear: boolean; // false: nothing fit at the floor size, so the pill may touch a card's edge
};

// Where version G's title pill goes and how big: hanging from the top row (the Menu pill's top), centred on
// the screen when it fits there, else between the logo and the Menu pill, at the biggest size up to `wantPx`
// whose pill keeps COIL.deal.prompt.title's air from every rested card, the chrome and the screen's sides.
// Under `floorPx` it stops shrinking and takes the floor size, whatever is behind it.
export function titlePlace(args: {
  viewportWidth: number;
  rowTop: number;
  chrome: readonly Edges[]; // the logo and the Menu pill
  quads: readonly (readonly Point[])[]; // the rested cards, viewport px
  perPx: { width: number; height: number }; // the text's box per px of font size
  wantPx: number;
  floorPx: number;
}): TitlePlace {
  const { viewportWidth, rowTop, chrome, quads, perPx, wantPx } = args;
  const floorPx = Math.min(args.floorPx, wantPx);
  const T = P.title;
  const middle = viewportWidth / 2;
  // No cards to measure is not a clear screen: the scene is not ready, so no place can be vouched for.
  if (quads.length === 0) return { px: floorPx, left: middle - (perPx.width * floorPx) / 2, top: rowTop + T.plateYEm * floorPx, clear: false };
  const leftEdge = Math.max(0, ...chrome.filter((box) => (box.left + box.right) / 2 < middle).map((box) => box.right));
  const rightEdge = Math.min(viewportWidth, ...chrome.filter((box) => (box.left + box.right) / 2 >= middle).map((box) => box.left));
  const between = (leftEdge + rightEdge) / 2;
  const fitsChrome = (px: number, centerX: number) => {
    const pill = titlePill(px, centerX, rowTop, perPx);
    return pill.left >= T.gutterPx && pill.right <= viewportWidth - T.gutterPx && !chrome.some((box) => boxesMeet(grown(pill, T.chromeGapPx, 0), box));
  };
  const fits = (px: number, centerX: number) => {
    if (!fitsChrome(px, centerX)) return false;
    const aired = cornersOf(grown(titlePill(px, centerX, rowTop, perPx), T.cardGapPx, T.cardGapPx));
    return !quads.some((quad) => convexMeet(aired, quad));
  };
  // A smaller pill sits inside a bigger one (same row, same centre), so the fit is monotone: bisect it.
  const biggestAt = (centerX: number): number | null => {
    if (fits(wantPx, centerX)) return wantPx;
    if (!fits(floorPx, centerX)) return null;
    let [low, high] = [floorPx, wantPx];
    for (let step = 0; step < 12; step++) {
      const mid = (low + high) / 2;
      if (fits(mid, centerX)) low = mid;
      else high = mid;
    }
    return low;
  };
  const onScreen = biggestAt(middle);
  const inGap = between === middle ? onScreen : biggestAt(between);
  // The screen's centre wins unless the gap between the chrome holds a clearly bigger pill.
  const useGap = inGap !== null && (onScreen === null || inGap > onScreen + 1);
  const clear = onScreen !== null || inGap !== null;
  const px = (useGap ? inGap : onScreen) ?? floorPx;
  // With nothing clear, the floor size takes the screen's centre when the chrome leaves it room there.
  const centerX = clear ? (useGap ? between : middle) : fitsChrome(floorPx, middle) ? middle : between;
  return { px, left: centerX - (perPx.width * px) / 2, top: rowTop + T.plateYEm * px, clear };
}

// Version G where the line rests (a phone always; "In the column" from 768 px wide): the big moment plays
// on the line itself. The text keeps the line's left edge, sits on the line's middle when the band between
// what is above (the page title, or the Work list) and what is below has room, and is cut to fit that band,
// the screen and, given `quads`, to keep COIL.deal.prompt.title's air from every card. Never smaller than the line.
export function titleInPlace(args: {
  line: Edges;
  aboveBottom: number; // the bottom of what sits above the line
  belowTop: number; // where what sits below it begins
  rightEdge: number; // the furthest right the text may reach
  perPx: { width: number; height: number };
  wantPx: number;
  linePx: number;
  quads?: readonly (readonly Point[])[];
}): { px: number; left: number; top: number } {
  const { line, aboveBottom, belowTop, rightEdge, perPx, wantPx, linePx, quads = [] } = args;
  const air = P.title.textAirPx;
  const band = belowTop - aboveBottom - 2 * air;
  const placeAt = (px: number) => {
    const height = perPx.height * px;
    const middle = (line.top + line.bottom) / 2;
    const lowest = belowTop - air - height;
    return { px, left: line.left, top: Math.max(aboveBottom + air, Math.min(lowest, middle - height / 2)) };
  };
  const roomPx = Math.max(linePx, Math.min(wantPx, band / perPx.height, (rightEdge - line.left) / perPx.width));
  const clearAt = (px: number) => {
    const at = placeAt(px);
    const aired = cornersOf(grown({ left: at.left, top: at.top, right: at.left + perPx.width * px, bottom: at.top + perPx.height * px }, P.title.cardGapPx, P.title.cardGapPx));
    return !quads.some((quad) => convexMeet(aired, quad));
  };
  if (clearAt(roomPx) || !clearAt(linePx)) return placeAt(clearAt(roomPx) ? roomPx : linePx);
  // A smaller text sits inside a bigger one (same left edge, held in the same band), so the fit is monotone: bisect it.
  let [low, high] = [linePx, roomPx];
  for (let step = 0; step < 12; step++) {
    const mid = (low + high) / 2;
    if (clearAt(mid)) low = mid;
    else high = mid;
  }
  return placeAt(low);
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
    plateOpacity: Math.max(0, 1 - 2 * p.shrinkP),
    lineOpacity: p.handoffP,
    scrimOpacity: p.inP * (1 - p.shrinkP), // D's scrim, F's and G's dim
  };
}

// A fast-forward only ever speeds the run up: a stream of inputs must not re-slow it.
export function fasterScale(current: number, next: number): number {
  return Math.max(current, next);
}

// Where the run should be and how fast, once input lands the line early (versions D and F):
// the shrink and hand-off play in `fastMs`, never slower than planned. Times are ms from the click.
export function fastForward(plan: PromptPlan, nowMs: number, fastMs: number): { seekMs: number; timeScale: number } | null {
  if (nowMs >= plan.endMs) return null;
  if (nowMs < plan.shrinkStartMs) return { seekMs: plan.shrinkStartMs, timeScale: (plan.endMs - plan.shrinkStartMs) / fastMs };
  return { seekMs: nowMs, timeScale: Math.max(1, (plan.endMs - nowMs) / fastMs) };
}

const MODIFIER_KEYS: ReadonlySet<string> = new Set(["Shift", "Control", "Alt", "Meta"]);

// While D's scrim or F's dim is up any key lands the line, except a bare modifier (the start of a shortcut).
export function fastForwardsOnKey(key: string): boolean {
  return !MODIFIER_KEYS.has(key);
}
