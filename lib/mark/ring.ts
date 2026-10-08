import type { MarkHold } from "@/lib/cursor/hover";
import { RING } from "@/lib/mark/constants";

// The cursor ring's hold indicator, in the ring's 0 to 100 box: a wash rising
// through the interior in step with the mark, and an arc clockwise from 12
// o'clock to 75 degrees at full hold, no ease, closed to a full circle on
// the first frame of the discharge.
export type RingFrame = { washTop: number; washHeight: number; arcDegrees: number; arcVisible: boolean; dashArray: string; dashOffset: string };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function ringPaint(hold: MarkHold, arcWidth: number, arcRadius: number): RingFrame {
  const fill = clamp01(hold.fill);
  const washTop = 100 * (1 - fill);
  const washHeight = Math.max(0, 100 * (1 - clamp01(hold.spent)) - washTop);
  const arcDegrees = hold.closed ? 360 : RING.arcDegrees * fill;
  // Round caps overhang each end by half the stroke; pull the dash in by that
  // much (in the circle's 360 path units) so 12 o'clock is the true start.
  const cap = arcDegrees >= 360 ? 0 : (arcWidth / 2 / (2 * Math.PI * arcRadius)) * 360;
  const dash = Math.max(0.001, arcDegrees - 2 * cap);
  return { washTop, washHeight, arcDegrees, arcVisible: arcDegrees >= 0.5, dashArray: `${dash} ${360 - dash}`, dashOffset: String(-cap) };
}
