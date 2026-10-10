import { FOOTER } from "./constants";
import { maxHop, type EggPose } from "./egg";
import { glyphPose, glyphWidth } from "./face";

// A letter's SVG transform, pure: placed at x (its ink's left), y (its
// baseline), pressed about the baseline (scale y by the squash about pivotX,
// the letter's half width; the period's is its current half side). The period
// adds the egg: its lift, its turn about its own center, and its squash about
// its bottom. With no egg it is the
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

// The period's box at its current swell (a resting cursor swells it), and
// half its side, its pivot: so the egg turns and lifts the square it draws,
// and its shadow sits under that square's center. At swell 0 it is the rest
// box, so a period at rest is written as it always was.
export function periodFrame(swell: number, size: number, baselineY: number): { box: PeriodBox; half: number } {
  const half = (glyphWidth(".", glyphPose(FOOTER.face, FOOTER.swell.amount, swell, 1)) * size) / 2;
  return { box: periodBox(baselineY - half, baselineY, half), half };
}

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

// The period's shadow on the ground under it (x, its center): the lab's
// ellipse, shrinking as it rises and fading with the pose's shadow share.
export function shadowEllipse(box: PeriodBox, pose: EggPose, x: number, baselineY: number) {
  const s = FOOTER.eggShadow;
  return {
    cx: x,
    cy: baselineY + s.drop * box.side,
    rx: s.rx * box.side * pose.shadowScale,
    ry: Math.max(s.minRyPx, s.ry * box.side * pose.shadowScale),
    opacity: FOOTER.egg.shadow * pose.shadow,
  };
}
