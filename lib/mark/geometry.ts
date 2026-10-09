// The mark's geometry: the three paths of public/brand/as-mark-ink.svg, the
// only copy in code (AsMark renders these), plus the guides the cel strike
// draws around them, in the mark's own viewBox units.
export const VIEW_BOX = "2.49 6.34 243.32 243.32";
export const BOLT_D = "M90.29 83.58L162.35 23.12L134.45 92.18L196.11 105.28L131.2 229.2L160.4 129.67L78.69 112.3Z";
export const LEG_D = "M151.62 133.45L52.19 232.88L65.2 232.88L132.65 165.43L122.98 198.37L123.53 229.2Z";
export const BAR_D = "M102.4 189.17L135.27 189.17L132.57 198.37L93.2 198.37Z";

export type Point = readonly [number, number];

export const BOLT_PTS: readonly Point[] = [[90.29, 83.58], [162.35, 23.12], [134.45, 92.18], [196.11, 105.28], [131.2, 229.2], [160.4, 129.67], [78.69, 112.3]];
export const LEG_PTS: readonly Point[] = [[151.62, 133.45], [52.19, 232.88], [65.2, 232.88], [132.65, 165.43], [122.98, 198.37], [123.53, 229.2]];
export const BAR_PTS: readonly Point[] = [[102.4, 189.17], [135.27, 189.17], [132.57, 198.37], [93.2, 198.37]];

// The bolt lands on its own point; the A's left foot sits 3.7 units lower,
// the ground the shards and the pool travel along.
export const IMPACT: Point = [131.2, 229.2];
export const GROUND_Y = 232.88;

// The strike's spine: tip, left elbow, right elbow, point, all inside the ink.
export const BOLT_SPINE: readonly Point[] = [[160.4, 26.6], [94, 100], [176, 115.5], [132.4, 221.2]];

// The hold fill rises through the ink, which spans y 22 to 234.
export const FILL_TOP = 22;
export const FILL_BOTTOM = 234;

// The mark's rise clip for one hold sample: its top edge is the fill, the
// same value the cursor's ring paints, and its height what the discharge has
// not yet spent.
export function risePaint(fill: number, spent: number): { y: number; height: number } {
  const span = FILL_BOTTOM - FILL_TOP;
  return { y: FILL_BOTTOM - span * fill, height: Math.max(0, span * (fill - spent)) };
}
