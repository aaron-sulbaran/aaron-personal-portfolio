import { FOOTER } from "./constants";
import { glyphPose, layoutWord, wordInk, type InkExtent } from "./face";

// The footer's geometry, pure: how big the word is for a footer's width, the
// band it sits in, where its baseline and top fall, each letter at rest and
// swelled, the field's mask and depths, and the rect the hero name's surface
// covers. Every length the stage lays out from comes from here, so no swell
// is ever cut by its own band, and the server reserves the same band height
// the client lays out (bandShare, in cqw).

export type Point = { readonly x: number; readonly y: number };

const restPose = () => glyphPose(FOOTER.face, FOOTER.swell.amount, 0);
const reachPose = () => glyphPose(FOOTER.face, FOOTER.swell.amount, 1);

// The word's width at rest per px of ascender height.
export function unitWidth(text: string): number {
  return layoutWord(text, 1, [restPose()], FOOTER.tracking, FOOTER.face.gap, false).width;
}

// The ascender height as a share of the footer's width: the asked height,
// held to fitShare of the width at rest so no swell pushes a letter off the
// edge. Aaron's 14.5vw would span 98 percent; this holds it to 92.
export function sizeShare(text: string): number {
  const unit = unitWidth(text);
  const asked = FOOTER.heightVw / 100;
  return unit > 0 ? Math.min(asked, FOOTER.fitShare / unit) : asked;
}

// The ink around the baseline at the swell's reach, in units: the face never
// draws under the baseline, so this is { top: 1, bottom: 0 }.
export function reachInk(text: string): InkExtent {
  return wordInk(text, reachPose());
}

// The word's band, px: the gap over the ink's top, the ink, and the bottom
// clearance under the baseline (Aaron's floor 0: the word rests whole just
// above the footer's bottom edge). The baseline never moves with the swell.
export function wordBand(size: number, ink: InkExtent) {
  const below = (ink.bottom + FOOTER.bottomClear) * size;
  const above = (FOOTER.gap + ink.top) * size;
  return { height: above + below, baselineFromBottom: below };
}

// The band's height as a share of the footer's width (1.4 of the size).
export function bandShare(text: string): number {
  return wordBand(sizeShare(text), reachInk(text)).height;
}

export type FooterGeometry = {
  readonly stageW: number;
  readonly stageH: number;
  readonly size: number; // the ascender height, px
  readonly bandTop: number; // px from the footer's top
  readonly baselineY: number;
  readonly wordTop: number; // the tallest swell's top
  readonly clipBottom: number; // the rise's clip: letters are cut below this
  readonly riseDistance: number; // px under its place the word starts its rise
};

export function footerGeometry(text: string, stageW: number, stageH: number, bandTop: number): FooterGeometry {
  const size = sizeShare(text) * stageW;
  const ink = reachInk(text);
  const band = wordBand(size, ink);
  const baselineY = bandTop + band.height - band.baselineFromBottom;
  return {
    stageW,
    stageH,
    size,
    bandTop,
    baselineY,
    wordTop: baselineY - ink.top * size,
    clipBottom: baselineY + (ink.bottom + FOOTER.rise.floor) * size,
    riseDistance: (ink.top + ink.bottom + FOOTER.rise.under) * size + FOOTER.rise.extraPx,
  };
}

// Each letter at rest, centered in the footer: where its ink starts, its
// center (stage px, y down) and half its width (its transform's pivot).
export type WordRest = { readonly xs: number[]; readonly centers: Point[]; readonly halfWidths: number[] };

export function wordRest(text: string, geo: FooterGeometry): WordRest {
  const row = layoutWord(text, geo.size, [restPose()], FOOTER.tracking, FOOTER.face.gap);
  const offset = (geo.stageW - row.width) / 2;
  return {
    xs: row.placements.map((p) => offset + p.inkX),
    centers: row.placements.map((p) => ({ x: offset + p.centerX, y: geo.baselineY - p.centerY })),
    halfWidths: row.placements.map((p) => p.width / 2),
  };
}

// Where each letter's ink starts when the letters swell by their shares (0
// to 1): a swelling letter pushes its neighbors and the word stays centered.
export function swelledXs(text: string, geo: FooterGeometry, swells: readonly number[]): number[] {
  const poses = swells.map((w) => glyphPose(FOOTER.face, FOOTER.swell.amount, w));
  const row = layoutWord(text, geo.size, poses, FOOTER.tracking, FOOTER.face.gap, false);
  const offset = (geo.stageW - row.width) / 2;
  return row.placements.map((p) => offset + p.inkX);
}

// How far a ripple from `landing` runs to the stage's far corner, in units.
export function rippleReach(geo: FooterGeometry, landing: Point): number {
  return Math.hypot(Math.max(landing.x, geo.stageW - landing.x), Math.max(landing.y, geo.stageH - landing.y)) / Math.max(1, geo.size);
}

// The field's alpha down the footer: it rises from paper over the top share,
// holds, and fades out over the last fade, ending at the word's top. On a
// short footer the rise and the fade meet at a point split in proportion to
// their lengths, so no stop ever sits out of order (CSS would snap that into
// a hard edge).
export function fieldStops(fadeInPx: number, fadePx: number, stop: number) {
  const rise = Math.max(0, fadeInPx);
  const fall = Math.max(0, fadePx);
  if (rise + fall <= stop) return { inEnd: rise, start: stop - fall };
  const meet = rise + fall > 0 ? (stop * rise) / (rise + fall) : 0;
  return { inEnd: meet, start: meet };
}

// The field's mask (an alpha gradient, not a color): the footer's share of
// the canvas over the rise, the hold and the fade, then the whole canvas
// from the word's top down, where only the letters' holes in the paper
// cover show it.
export function fieldMaskImage(geo: FooterGeometry, share: number): string {
  const stop = Math.max(0, geo.wordTop);
  const { inEnd, start } = fieldStops(FOOTER.field.fadeIn * geo.stageH, FOOTER.field.fade * geo.size, stop);
  const px = (v: number) => `${v.toFixed(2)}px`;
  const hold = `rgba(0, 0, 0, ${share.toFixed(4)})`;
  return `linear-gradient(to bottom, transparent 0px, ${hold} ${px(inEnd)}, ${hold} ${px(start)}, transparent ${px(stop)}, black ${px(stop)})`;
}

// The canvas's depth and the mask's share of it. The live field draws each
// depth where it belongs (behind the footer, and inside the letters), so it
// is shown whole. The poster draws one depth, the deeper (the letters'); the
// mask holds the footer's share of it, which over paper is the shallower
// field. The letters are the deeper depth, so nothing veils them.
export function fieldDepths(live: boolean) {
  const { behind, letters } = FOOTER.field;
  if (live) return { canvas: behind, backdropShare: 1 };
  const deepest = Math.max(behind, letters);
  return { canvas: deepest, backdropShare: deepest > 0 ? behind / deepest : 1 };
}

// The letters' band (where the field turns to the letters' depth) and the
// word's rect, padded, which the hero name's surface covers.
export function lettersRect(text: string, geo: FooterGeometry) {
  const wordW = unitWidth(text) * geo.size;
  const pad = FOOTER.field.surfacePad * geo.size;
  return {
    band: geo.wordTop - FOOTER.field.bandLeadPx,
    rect: { x: (geo.stageW - wordW) / 2 - pad, y: geo.wordTop - pad, w: wordW + 2 * pad, h: geo.baselineY - geo.wordTop + 2 * pad },
  };
}
