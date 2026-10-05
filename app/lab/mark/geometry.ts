// The mark's geometry, read from components/menu/BrandMark.tsx and never
// redrawn. The three paths are copied verbatim; everything else here is a
// guide the animation masks follow (spines, the impact point, the ground),
// all in the mark's own viewBox units.

export const VIEW_BOX = "2.49 6.34 243.32 243.32";
export const VIEW_X = 2.49;
export const VIEW_Y = 6.34;
export const VIEW_SIZE = 243.32;

export const BOLT_D = "M90.29 83.58L162.35 23.12L134.45 92.18L196.11 105.28L131.2 229.2L160.4 129.67L78.69 112.3Z";
export const LEG_D = "M151.62 133.45L52.19 232.88L65.2 232.88L132.65 165.43L122.98 198.37L123.53 229.2Z";
export const BAR_D = "M102.4 189.17L135.27 189.17L132.57 198.37L93.2 198.37Z";

type Point = readonly [number, number];

// The bolt lands on its own point; the A's left foot sits 3.7 units lower,
// which is the ground the splash travels along.
export const IMPACT: Point = [131.2, 229.2];
export const GROUND_Y = 232.88;

// Where the impact and the ground fall inside the mark's square box, as
// fractions of its size, for DOM layers that line up with them.
export const IMPACT_X_FRACTION = (IMPACT[0] - VIEW_X) / VIEW_SIZE;
export const GROUND_FRACTION = (GROUND_Y - VIEW_Y) / VIEW_SIZE;

// The strike's spine: tip, the left elbow, the right elbow, the point. Every
// waypoint sits inside the bolt so the visible leader never leaves the ink.
const BOLT_SPINE: readonly Point[] = [
  [160.4, 26.6],
  [94, 100],
  [176, 115.5],
  [132.4, 221.2],
];

// The reveal spine runs a little past both ends, so a butt cap uncovers the
// tip and the point fully at 0 and 100 percent.
const BOLT_REVEAL: readonly Point[] = [
  [166.4, 18.9],
  [94, 100],
  [176, 115.5],
  [129.8, 234.6],
];

// The A grows out of the impact: up its right leg (the sliver beside the
// bolt's tail), over the apex, down the left leg to the foot.
const LEG_REVEAL: readonly Point[] = [
  [123.2, 236.5],
  [127.4, 199],
  [146.2, 141.4],
  [55.6, 236.4],
];

// The crossbar draws from the bolt's side toward the left leg.
const BAR_REVEAL: readonly Point[] = [
  [138.5, 193.77],
  [89.5, 193.77],
];

export const BOLT_REVEAL_WIDTH = 64;
export const LEG_REVEAL_WIDTH = 20;
export const BAR_REVEAL_WIDTH = 13;

// Radius from the impact that covers the whole A (the apex is 98 away).
export const A_WIPE_RADIUS = 108;
// The rising reveal's edge travels from below the feet to above the apex.
export const A_RISE_FROM = 237;
export const A_RISE_TO = 128;

function toPath(points: readonly Point[]) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

export const BOLT_SPINE_D = toPath(BOLT_SPINE);
export const BOLT_REVEAL_D = toPath(BOLT_REVEAL);
export const LEG_REVEAL_D = toPath(LEG_REVEAL);
export const BAR_REVEAL_D = toPath(BAR_REVEAL);

function segmentLengths(points: readonly Point[]) {
  return points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
}

// Where each elbow falls along the reveal, as a fraction of its length: the
// stepped strike pauses at exactly these points.
// The second stop holds 14 units short of the right elbow, so the paused
// frame shows a clean end on the band, not a stub of the lower wedge.
export const BOLT_ELBOWS: readonly number[] = (() => {
  const lengths = segmentLengths(BOLT_REVEAL);
  const total = lengths.reduce((a, b) => a + b, 0);
  return [lengths[0] / total, (lengths[0] + lengths[1] - 14) / total];
})();

// The dotted splash: dots thrown low along the ground that land on an even
// rhythm, like a short run of the soundtrack strip, then dissolve.
export type SplashDot = { side: 1 | -1; land: number; lift: number; r: number; delay: number };

export const SPLASH_DOTS: readonly SplashDot[] = [1, 2, 3, 4].flatMap((step) =>
  ([-1, 1] as const).map((side) => ({
    side,
    land: step * 15,
    lift: 5 + step * 3.2 + (side === 1 ? 1.2 : 0),
    r: 2.9 - step * 0.32,
    delay: (step - 1) * 0.035,
  })),
);
