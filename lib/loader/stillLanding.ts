import { landing, type InkTarget, type Landing, type NameBox } from "./continuity";
import type { LockupMetrics } from "./lockup";

// The still path's landing (components/loader/runLoader.ts, dissolve): where
// the box's aspect differs from the still's cut, object-fit cover moves and
// scales the name the still bakes behind its cards, so the resting lockup
// lands on it first, with the continuity exit's landing (lib/loader/continuity.ts)
// over its time and ease, and only then does the still fade in under it. The
// resting lockup and the baked one are the same pose at two sizes
// (lib/loader/lockup.ts lockupPose), so one transform on the rest layer,
// about the name's ink box center, lands the name and carries the greeting
// onto the baked greeting with it.

// A landed name this close to the resting one (left, baseline, width) is no
// landing: the box shows the still at its cut's aspect.
export const STILL_LAND_SKIP_PX = 1;

type InkMetrics = Pick<LockupMetrics, "inkW" | "inkL" | "capR" | "base">;

// The resting name's ink box from its text box (line-height 1: its top is the
// baseline less the face's baseline offset, its left the ink's plus the bearing).
export function restNameBox(span: { left: number; top: number }, fontPx: number, m: InkMetrics): NameBox {
  const baseline = span.top + m.base * fontPx;
  const height = m.capR * fontPx;
  return { left: span.left - m.inkL * fontPx, top: baseline - height, width: m.inkW * fontPx, height, rotationDeg: 0 };
}

// The landing onto the baked name, or null when it would move nothing.
export function stillLanding(box: NameBox, target: InkTarget): Landing | null {
  const apart = Math.max(
    Math.abs(target.left - box.left),
    Math.abs(target.baseline - (box.top + box.height)),
    Math.abs(target.width - box.width),
  );
  return apart <= STILL_LAND_SKIP_PX ? null : landing(box, target);
}

// The transform's origin, the box's center, in the layer's own px.
export function landingOrigin(box: NameBox, layer: { left: number; top: number }) {
  return `${(box.left + box.width / 2 - layer.left).toFixed(2)}px ${(box.top + box.height / 2 - layer.top).toFixed(2)}px`;
}

export type StillMove = { land: Landing; origin: string };

// The rest layer's landing from the page as it is (viewport px), or null:
// no target (no still box showing), or nothing to move.
export function stillMove(layer: HTMLElement, name: HTMLElement, target: InkTarget | null, m: InkMetrics): StillMove | null {
  if (!target) return null;
  const box = restNameBox(name.getBoundingClientRect(), parseFloat(getComputedStyle(name).fontSize), m);
  const land = stillLanding(box, target);
  return land ? { land, origin: landingOrigin(box, layer.getBoundingClientRect()) } : null;
}
