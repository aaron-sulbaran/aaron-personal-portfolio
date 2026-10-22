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

// The entrance's own timing, as fractions of its duration. Named so the deal's
// knobs (the `deal` block) start from these and nothing else.
const ENTRANCE = {
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
  // The deal (hero rework, slice 2): the stack starts this share of the way
  // from the helix's center to the cards section's top edge, on the center
  // line, so the cards arrive from where the deck went. 0 is the old stack at
  // the helix center; 1 puts the stack's center on the edge.
  startOffset: 1,
};

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
  },
  // Wheel capture, decided once per gesture (lib/coil/capture.ts): a gesture
  // starting with the pointer on a card (or in the seam between two), capture
  // armed by a real pointer move since the page last scrolled, and the hero
  // at least half in view is the coil's from its first event, with no hover
  // intent; release stays the helix silhouette. Aaron, 2026-09-29 (no intent,
  // no top-of-page rule), narrowed from the whole silhouette after his
  // hardware pass of 2026-10-05.
  capture: {
    gestureGapMs: 260, // wheel events closer than this are one gesture (the lab's value)
    heroVisibleMin: 0.5,
    nudgeAfterMs: 2600,
    // The seam margin, in card heights (times the pane's cardPx): off a card,
    // a point is in a seam when two pickable cards are this close. The widest
    // seam between two adjacent front cards at rest, as picking sees them
    // (flat cards, so a wedge), has both cards 0.1045 card heights from its
    // middle at any pane (geometry.test.ts derives it); this covers it with
    // 2px to spare down to a 1024 by 768 pane. 26.7px at 1485 by 927. A spin's
    // stretch opens seams past it; the continuation rule covers those.
    seamCards: 0.12,
    // A real pointer move this far from where the page last scrolled under a
    // still pointer arms capture again (trackpad jitter is 1 to 3px).
    rearmPx: 6,
  },
  // A book row hovered or focused holds the coil still on its card.
  rowHold: {
    resumeDelayMs: 400,
    resumeMs: 600, // ease-in of the idle weight after the delay
    minHeroVisible: 0.25, // below this the hero is out of sight: a row does nothing
  },

  // Stretch (O3): the turn gap times 1 + envelope.
  stretch: {
    amount: 0.6,
  },

  // Entrance, as fractions of its duration.
  entrance: ENTRANCE,

  // The deal (hero rework, slice 2; docs/superpowers/specs/2026-10-21-hero-rework-design.md):
  // the deck at the intro's foot, the name's settle and glow, the riffle, the
  // cards' flight into the Coil and the section opening around it. Every number
  // here is a lab knob's default (lib/home/dealKnobs.ts clamps them); the lab
  // panel, in dev only, overrides them at runtime. Aaron tunes them by hand.
  deal: {
    // Where the cards section's top edge sits in the viewport (as a share of
    // its height) when each step fires: the riffle once the section starts to
    // peek and the reader is scrolling down, the entrance once it is this far
    // up (and until its bottom edge leaves past `outAt`).
    trigger: { riffleAt: 1, enterAt: 0.65, outAt: 0.35, waitSceneMs: 4000 },
    // The deck: face-down cards fanned about their bottom center; the hover
    // opens the fan a little and lifts the top card.
    deck: { cards: 6, fanDeg: 5, openDeg: 1.8, liftPx: 5 },
    // The riffle: split into two halves, interleave back in a quick cascade,
    // square up. spreadShare: how far each half parts (of the deck's width).
    riffle: { on: true, ms: 800, spreadShare: 0.6, splitDeg: 9, hopPx: 8 },
    // The cards' flight: the entrance's own timing, tunable.
    entrance: {
      durationMs: ENTRANCE.durationMs,
      shutterStagger: ENTRANCE.shutterStagger,
      startOffset: ENTRANCE.startOffset,
    },
    // The section opening around the Coil: a circle anchored top center grows
    // from fromPx to reach (a share of the distance to the farthest corner)
    // over ms. fadeMs: the still path's crossfade.
    open: { reach: 1, ms: 1500, fromPx: 36, fadeMs: 600 },
    // The two columns arrive last: group labels, then titles.
    columns: { delayMs: 1150, staggerMs: 36, labelStaggerMs: 70, fadeMs: 520, riseY: 14 },
    // The glow behind the intro's heading: radii as shares of the heading's ink
    // width and height (never reaching the paragraph), the center's offset in
    // the same shares, the strength at the center, the fade-in, and where in
    // the hero field's frame (from its top) the glow samples.
    glow: { size: 1, offsetX: 0.06, offsetY: 0, strength: 0.9, fadeMs: 1000, depth: 1, rxOfText: 0.78, ryOfHeading: 1.15, fieldAt: 0.32 },
    // The name's settle: it starts this much larger (transform only, origin
    // top left; capped so it never overflows the viewport's width) and settles
    // to 1x once.
    settle: { startScale: 1.35, ms: 1100, delayMs: 120, marginPx: 8 },
  },

  // Unwind egg and hover-jump.
  unwind: {
    perCardMs: 580,
    staggerMs: 8,
  },
  hoverJumpMs: 700, // the row glide, site ease, no overshoot
  siteEase: [0.22, 1, 0.36, 1] as const,

  // Name behind the helix.
  nameInk: 0.12,
  // The "Hi, I'm" over "Aaron" lockup, drawn by the canvas and matched by the
  // loader's DOM lockup (lib/loader/lockup.ts), so one set of proportions
  // serves both. The name's advance spans this share of the pane's width;
  // the greeting's cap height is greetingCap of the name's, its lowest ink
  // greetingGap of its own cap height above the "A", its ink greetingShift of
  // the name's size right of the name's ink. pad (of the size) rims the mask;
  // inkGain is the composite's gain on the --name-ink token. stillInk is the
  // strong ink: the name the hero still bakes behind its cards (the scene's
  // composite in still mode, lib/coil/debugFlags.ts nameCompositeInk) and the
  // h1 lockup's while the still is loading or never decodes (the loader's
  // resting lockup eases to it when the still never decodes): the layer's
  // opacity, over the same gradient and greeting color.
  lockup: {
    widthWide: 0.7,
    widthNarrow: 0.9,
    greetingCap: 0.18,
    greetingGap: 0.45,
    greetingShift: 0.02,
    pad: 0.04,
    inkGain: 2.2,
    stillInk: 1,
  },

  // Header.
  markPx: 32,
  lightPanelDim: 0.3,

  // C3: the faces that are not photos (lib/coil/textures.ts, and the modal
  // header's DOM copy in components/card/CardFace.tsx), in fractions of the
  // card's width. Not tuned: Aaron looks at the fourteen first.
  face: {
    logoWidth: 0.4, // a mark's longer side
    wordmarkWidth: 0.64, // a wordmark across the card
    wordmarkFrom: 2, // width over height from which a logo is a wordmark
    plateInset: 0.07, // the light plate's margin around a logo in the dark theme
    markWidth: 0.36, // the AS mark on This site's card
    circles: { from: 0.16, to: 0.32, gap: 0.025, logo: 0.62 }, // the jobs card: diameters oldest to newest, the gap, a logo's share of its disc
  },

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
