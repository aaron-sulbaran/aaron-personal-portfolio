import { COIL } from "@/lib/coil/constants";
import { FOOTER } from "./constants";

// The hero's frame for the footer's field, pure: the hero fills the width and
// the viewport's height, so the field's aspect and scale are the hero's, and
// the word's middle (`wordMidY`, stage px from the top) sits at the frame's
// middle, where the hero's name sits. The letters see the field the name
// sees; the footer above them the hero's upper half (its burnt orange lobe at
// the top right). The poster stand-in is framed the same way.

export function heroFrame(stageW: number, stageH: number, viewportH: number, wordMidY = stageH) {
  const height = Math.max(1, viewportH);
  return {
    aspect: stageW / height,
    frameY: stageH / height,
    frameY0: 0.5 - (stageH - wordMidY) / height,
    narrow: stageW / height < COIL.narrow.aspectBelow,
  };
}

// The hero's lockup height (its name surface's target) for a pane `stageW`
// wide under a viewport `viewportH` tall, px.
export function lockupHeight(stageW: number, viewportH: number): number {
  const share = heroFrame(stageW, 1, viewportH).narrow ? FOOTER.heroLockup.narrow : FOOTER.heroLockup.wide;
  return Math.max(1, stageW * share);
}

export type Box = { x: number; y: number; w: number; h: number };

// Where the hero's poster (public/coil/field-*.avif, the live field's first
// frame) lands on a canvas `w` by `h`: covering the hero's frame (the
// canvas's width and the viewport's height `frameH`, at the canvas's scale),
// centered across, its middle on the word's middle (`midY`). It also covers
// the whole canvas: the box reaches at least as far above and below `midY`
// as the canvas's top and bottom do, so a short viewport never leaves a strip
// of the canvas bare.
export function posterBox(w: number, h: number, posterW: number, posterH: number, frameH: number, midY: number): Box {
  const scale = Math.max(
    w / Math.max(1, posterW),
    frameH / Math.max(1, posterH),
    (2 * Math.max(midY, h - midY)) / Math.max(1, posterH),
  );
  const dw = posterW * scale;
  const dh = posterH * scale;
  return { x: (w - dw) / 2, y: midY - dh / 2, w: dw, h: dh };
}

// The poster recolored to a depth: each channel moved from the paper by
// `intensity` (1 leaves the poster as drawn), RGBA bytes in place.
export function recolor(px: Uint8ClampedArray, paper: readonly [number, number, number], intensity: number) {
  if (intensity === 1) return;
  const p = paper.map((c) => c * 255);
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, p[c] + (px[i + c] - p[c]) * intensity));
  }
}
