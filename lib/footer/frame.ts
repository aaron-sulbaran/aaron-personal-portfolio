import { FOOTER } from "./constants";
import { maxHop, type EggPose } from "./egg";

// A letter's SVG transform, pure: placed at x (its ink's left), y (its
// baseline), pressed about the baseline (scale y by the squash about pivotX,
// the letter's half width). The period adds the egg: its lift, its turn about
// its own center, and its squash about its bottom. With no egg it is the
// string a letter at rest always has, so a period back at rest is exactly
// where it began.

export type EggTransform = { liftPx: number; angle: number; sx: number; sy: number; cy: number; bottomY: number };

export function letterTransform(x: number, y: number, pivotX: number, squash: number, egg?: EggTransform): string {
  const head = `translate(${(x + pivotX).toFixed(2)} ${(y - (egg ? egg.liftPx : 0)).toFixed(2)})`;
  const tail = `scale(1 ${squash.toFixed(4)}) translate(${(-pivotX).toFixed(2)} 0)`;
  if (!egg) return `${head} ${tail}`;
  const b = egg.bottomY.toFixed(2);
  const turn = `rotate(${egg.angle.toFixed(3)} 0 ${egg.cy.toFixed(2)})`;
  return `${head} translate(0 ${b}) scale(${egg.sx.toFixed(4)} ${egg.sy.toFixed(4)}) translate(0 ${(-egg.bottomY).toFixed(2)}) ${turn} ${tail}`;
}

// The egg's period in the letter's own space: its center (cy px under the
// baseline, negative above it), its bottom, and its side.
export function periodBox(centerY: number, baselineY: number, halfWidth: number) {
  const cy = centerY - baselineY;
  return { cy, bottomY: cy + halfWidth, side: 2 * halfWidth };
}

export type PeriodBox = ReturnType<typeof periodBox>;

// The pose as the period's transform: the lift held under the word's top
// (inkTop, units), and a turned square lifted so its lowest corner stays on
// the ground.
export function eggTransform(pose: EggPose, box: PeriodBox, size: number, inkTop: number): EggTransform {
  const hopCap = maxHop(inkTop, box.side / size + FOOTER.swell.amount);
  const lift = pose.lift * Math.min(1, hopCap / Math.max(1e-6, FOOTER.egg.hop)) * size;
  const a = (pose.angle * Math.PI) / 180;
  const corner = (box.side / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) - 1);
  return { liftPx: lift + corner, angle: pose.angle, sx: pose.sx, sy: pose.sy, cy: box.cy, bottomY: box.bottomY };
}
