// Which way a reveal travels. Rounds one to five: bottom up (a photo's clip
// edge rises, a line rises into its clip). Round six (Aaron, 2026-10-09:
// "instead of having it go from bottom up, we go from left to right, just in
// a readable direction"): the clip edge travels from the left edge to the
// right, and a line stays where it is while its clip opens. Pure, so the
// tests read it; useMaskIn and the rotators turn it into tweens.

export type MaskDirection = "ltr" | "up";

const RADIUS = "round 12px";
const inset = (top: number, right: number, bottom: number, left: number) => `inset(${top}% ${right}% ${bottom}% ${left}% ${RADIUS})`;

// A photo's wipe in, hidden to whole: the clip's right edge moves from the
// left edge to the right, or its top edge rises from the foot.
export function photoWipeIn(direction: MaskDirection) {
  return direction === "ltr" ? { from: inset(0, 100, 0, 0), to: inset(0, 0, 0, 0) } : { from: inset(100, 0, 0, 0), to: inset(0, 0, 0, 0) };
}

// The photo leaving as the next wipes in: its trailing edge follows the
// incoming one's leading edge, so it clears to the right, or upward.
export function photoWipeOut(direction: MaskDirection) {
  return direction === "ltr" ? { from: inset(0, 0, 0, 0), to: inset(0, 0, 0, 100) } : { from: inset(0, 0, 0, 0), to: inset(0, 0, 100, 0) };
}

// A photo moved in rather than wiped ("rise"): up from under its clip, or in
// from the left; the one leaving goes up, or out to the right.
export function photoMoveIn(direction: MaskDirection) {
  return direction === "ltr" ? { from: { xPercent: -110 }, to: { xPercent: 0 } } : { from: { yPercent: 110 }, to: { yPercent: 0 } };
}
export function photoMoveOut(direction: MaskDirection) {
  return direction === "ltr" ? { from: { xPercent: 0 }, to: { xPercent: 110 } } : { from: { yPercent: 0 }, to: { yPercent: -110 } };
}

// Room above, below and beside a line's box, so Profa's ink and a caption's
// descenders are never cut while the clip opens; the line's own mask wrapper
// still clips the travel of the bottom-up reveal.
const INK = { block: 25, side: 2 };
const lineClip = (right: number, left: number) => `inset(-${INK.block}% ${right}% -${INK.block}% ${left}%)`;

// A line of text, a caption or a block: it rises into its clip (the sections
// grammar's MASKED), or stays put while its clip opens left to right.
export function textIn(direction: MaskDirection) {
  return direction === "ltr"
    ? { from: { clipPath: lineClip(100 + INK.side, -INK.side) }, to: { clipPath: lineClip(-INK.side, -INK.side) } }
    : { from: { yPercent: 110 }, to: { yPercent: 0 } };
}

// A caption leaving as the next one comes in (the rotators): it rises out,
// or its clip closes from the left, so the new words show left of the edge
// and the old right of it.
export function textOut(direction: MaskDirection) {
  return direction === "ltr"
    ? { from: { clipPath: lineClip(-INK.side, -INK.side) }, to: { clipPath: lineClip(-INK.side, 100 + INK.side) } }
    : { from: { yPercent: 0 }, to: { yPercent: -110 } };
}

// A rotator's left to right wipe in the frame's coordinates. A group's
// photos are drawn at their own boxes inside one frame, so a percent clip on
// each box would move two edges at two speeds when the boxes differ (a
// vertical photo handing over to a horizontal one). One edge crosses the
// frame instead: the incoming photo shows left of it, the outgoing right of
// it. Lengths are px from each box's own left edge.
export type Span = { left: number; width: number };

export function sweepInsets(progress: number, frameWidth: number, incoming: Span, outgoing: Span) {
  const edge = Math.min(1, Math.max(0, progress)) * frameWidth;
  const within = (span: Span) => Math.min(span.width, Math.max(0, edge - span.left));
  const px = (n: number) => `${Number(n.toFixed(2))}px`;
  return {
    incoming: `inset(0px ${px(incoming.width - within(incoming))} 0px 0px ${RADIUS})`,
    outgoing: `inset(0px 0px 0px ${px(within(outgoing))} ${RADIUS})`,
  };
}
