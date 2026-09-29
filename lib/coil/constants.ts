// The Coil's tuned values: table 1.1 of docs/coil-build-scaffold.md (Aaron's
// hero lab 2 picks, 2026-09-29) as one typed, deeply frozen object. Builders
// never retune these by eye; a pick changes here and nowhere else.
//
// The `lab` block holds the lab source's internal constants that the ported
// algorithms need to reproduce the picked look (lens distance, envelope rates,
// the entrance washer pitch, the field drift). They are not picks; they are
// how the lab realized them.

type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  });
  return Object.freeze(value) as DeepReadonly<T>;
}

export type CaptureMode = "cards" | "silhouette";

const values = {
  // Geometry. Card height and gaps are in card units (height 1, width `aspect`).
  axisDeg: 33,
  cardsPerTurn: 8,
  turnGap: 1.5, // card heights between turns
  cardHeightFrac: 0.24, // of the viewport height
  neighborGap: 0.05, // card widths between neighbors on a turn
  curvature: 0.7, // 0 steps, 1 reads as tubes
  cardAspect: 0.75, // every card is 3:4 portrait
  strandFit: "repeat" as "repeat" | "exact", // repeats fill the pane (M slots over N cards)

  // Narrow composition (phones, tablet portrait): width / height below this.
  narrow: {
    aspectBelow: 0.8,
    axisFactor: 0.3, // the axis relaxes toward vertical
    maxCardsPerTurn: 6.2,
    // Repeats fill the pane, as on desktop (Aaron, PR 8): the strand reaches
    // both ends of a phone and tablet-portrait cards keep the table's height.
    // Twenty real cards would span a phone with fewer repeats on their own.
    strandFit: "repeat" as "repeat" | "exact",
    // The phone header: the mark and the Menu pill sit in the top 64px, and no
    // card may cross them (design review of lab 2, item 14).
    headerClearPx: 64,
    // The greeting and its control take one line under the header (a card
    // never passes behind them); the coil lives below this band.
    introBandPx: 40,
  },

  // Camera.
  camera: {
    fovDeg: 26,
    leanDeg: -12,
    bandLeanDeg: -22, // the closed band during the entrance
  },

  // Motion, in cards and seconds.
  idleCardsPerSecond: 0.09,
  spinCapCardsPerSecond: 12.5,
  wheel: {
    lambda: 11, // one exponential smoothing stage, 1/s (about 90ms)
    cardsPerPixel: 0.0045,
    pageScrollCardsPerPixel: 1 / 150, // page scroll turns the coil (on)
  },
  capture: {
    mode: "cards" as CaptureMode, // pointer over a card, not the whole silhouette
    hoverIntentMs: 400,
    nudgeAfterMs: 2600,
  },

  // Stretch (O3): the turn gap times 1 + envelope.
  stretch: {
    amount: 0.6,
  },

  // Entrance, as fractions of its duration.
  entrance: {
    durationMs: 1800,
    stackIn: 0.05,
    shutterStart: 0.06,
    shutterStagger: 0.011,
    fly: 0.22,
    pullStart: 0.58,
    // The winding waits for the seam to finish parting (the lab wound from 0.2,
    // where the ends of a 14-card band graze for a frame): a fraction of the pull.
    windStart: 0.38,
    pullCurve: [0.55, 0, 0.25, 1] as const,
  },

  // Unwind egg and hover-jump.
  unwind: {
    perCardMs: 580,
    staggerMs: 8,
  },
  hoverJumpMs: 600,
  siteEase: [0.22, 1, 0.36, 1] as const,

  // Name behind the helix.
  nameInk: 0.12,

  // Header.
  markPx: 32,
  lightPanelDim: 0.3,

  lab: {
    // Lens distance: a longer lens than lab 1 so near cards stop ballooning.
    // The visible half height at z = 0 is 10 * tan(17deg) world units.
    viewHalfHeight: 10 * Math.tan((17 * Math.PI) / 180),
    // Envelope (critically damped): rates in 1/s. Builds in about 1.2s,
    // relaxes in about 2s. vRef is the speed (cards/s) that reads as fast.
    envelopeRise: 2.6,
    envelopeRelax: 1.6,
    envelopeSpeedRef: 9,
    envelopeTargetMax: 1.4,
    // Entrance: the seam opens first, one split turn a card height apart.
    washerPitch: 1.3,
    // Strand ends fade over this many slots.
    endFadeSlots: 0.8,
    // Depth recede by theme (0 front, applied by depth).
    recedeLight: 0.3,
    recedeDark: 0.38,
    // Frame clamp so a stalled tab never jumps the conveyor.
    maxFrameSeconds: 0.1,
    dprCap: 1.75,
    textureSize: [384, 512] as const,
    // Coarse pointers (phones, tablets): the decision record's budget, 256 to
    // 384px textures and the device pixel ratio capped at 2.
    coarse: {
      dprCap: 2,
      textureSize: [288, 384] as const,
    },
  },
};

export const COIL = deepFreeze(values);
export type CoilConstants = typeof COIL;
