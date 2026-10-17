// Which way a reveal travels. Round six (Aaron, 2026-10-09: "we go from left to
// right, just in a readable direction"): a clip edge travels from the left edge
// to the right, and a line stays put while its clip opens. "up" is the earlier
// rounds' bottom-up reveal, kept for the constant's sake. Pure.

export type MaskDirection = "ltr" | "up";

const RADIUS = "round 12px";
const inset = (top: number, right: number, bottom: number, left: number) => `inset(${top}% ${right}% ${bottom}% ${left}% ${RADIUS})`;

export function photoWipeIn(direction: MaskDirection) {
  return direction === "ltr" ? { from: inset(0, 100, 0, 0), to: inset(0, 0, 0, 0) } : { from: inset(100, 0, 0, 0), to: inset(0, 0, 0, 0) };
}

export function photoWipeOut(direction: MaskDirection) {
  return direction === "ltr" ? { from: inset(0, 0, 0, 0), to: inset(0, 0, 0, 100) } : { from: inset(0, 0, 0, 0), to: inset(0, 0, 100, 0) };
}

// Room above, below and beside a line's box, so Profa's ink and a caption's
// descenders are never cut while the clip opens.
const INK = { block: 25, side: 2 };
const lineClip = (right: number, left: number) => `inset(-${INK.block}% ${right}% -${INK.block}% ${left}%)`;

export function textIn(direction: MaskDirection) {
  return direction === "ltr"
    ? { from: { clipPath: lineClip(100 + INK.side, -INK.side) }, to: { clipPath: lineClip(-INK.side, -INK.side) } }
    : { from: { yPercent: 110 }, to: { yPercent: 0 } };
}

export function textOut(direction: MaskDirection) {
  return direction === "ltr"
    ? { from: { clipPath: lineClip(-INK.side, -INK.side) }, to: { clipPath: lineClip(-INK.side, 100 + INK.side) } }
    : { from: { yPercent: 0 }, to: { yPercent: -110 } };
}

// The same masks in either direction, as plain clip-path strings, for a block
// that reveals and hides sideways (the metrics strip's wave, lib/metrics/wave.ts).
// ltr is textIn and textOut as they are: a clip's edge crosses the block left
// to right. rtl is their exact mirror: it opens from the right edge leftwards
// and closes toward the left. The same INK allowance, so ink is never cut.
export type SweepDirection = "ltr" | "rtl";

export function clipIn(direction: SweepDirection) {
  return direction === "ltr"
    ? { from: lineClip(100 + INK.side, -INK.side), to: lineClip(-INK.side, -INK.side) }
    : { from: lineClip(-INK.side, 100 + INK.side), to: lineClip(-INK.side, -INK.side) };
}

export function clipOut(direction: SweepDirection) {
  return direction === "ltr"
    ? { from: lineClip(-INK.side, -INK.side), to: lineClip(-INK.side, 100 + INK.side) }
    : { from: lineClip(-INK.side, -INK.side), to: lineClip(100 + INK.side, -INK.side) };
}

// A turning frame's left to right change in the frame's own coordinates: one
// edge crosses the frame, the incoming photo left of it and the outgoing right
// of it, so photos of two shapes hand over on one line. Lengths are px from each
// box's own left edge; no rounding, or the two clips would notch where they meet.
export type Span = { left: number; width: number };

export function sweepInsets(progress: number, frameWidth: number, incoming: Span, outgoing: Span) {
  const edge = Math.min(1, Math.max(0, progress)) * frameWidth;
  const within = (span: Span) => Math.min(span.width, Math.max(0, edge - span.left));
  const px = (n: number) => `${Number(n.toFixed(2))}px`;
  return { incoming: `inset(0px ${px(incoming.width - within(incoming))} 0px 0px)`, outgoing: `inset(0px 0px 0px ${px(within(outgoing))})` };
}
