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

// The pull that opens the closed band into the rested coil (the deal's last
// act). Its window is in COIL.deal.timeline; these are the shape of it: the
// winding waits for the seam to finish parting (the lab wound from 0.2, where
// the ends of a 14-card band graze for a frame), as a fraction of the pull.
const ENTRANCE = {
  windStart: 0.38,
  pullCurve: [0.55, 0, 0.25, 1] as const,
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

  // The pull's shape (its window is deal.timeline).
  entrance: ENTRANCE,

  // The deal (hero rework; docs/superpowers/specs/2026-10-21-hero-rework-design.md):
  // the wheel in the teaser, its spin, flatten and lift into the Coil, and the
  // section opening around it. Every number here is a lab knob's default
  // (lib/home/dealKnobs.ts clamps them); the lab panel, in dev only, overrides
  // them at runtime. Aaron tunes them by hand.
  deal: {
    // When the deal starts by the reader's own scroll: once the reader is
    // enterAtProgress of the way through the sticky stage's range (the stage
    // sticks when page 1's foot reaches the top of the screen and lets go when
    // the cards section does), and until the section's bottom edge has left
    // past `outAt` of the viewport's height. waitSceneMs: how long the cards
    // wait for a scene still on its way.
    trigger: { enterAtProgress: 0.18, outAt: 0.35, waitSceneMs: 4000 },
    // The deal's one clock, in ms from the click (docs/superpowers/specs/2026-10-22-wheel-deal-motion.md
    // section 2). The wheel spins up (speed 0.5 to the peak, power2.out), the
    // page scrolls itself to the section, the wheel flattens into the band
    // (power2.inOut), the band slows to the idle pace (smoothstep), then lifts
    // into 3D and unfurls (the pull, on its cubic-bezier), while the field
    // opens (below) and the columns arrive last. The teaser's text leaves
    // first. Every number is a lab knob's default.
    timeline: {
      // Slice 4c: the deal begins with the ribbon's own act, the gaps between
      // the cards closing and the row gathering toward the middle (ease out),
      // and every other time below counts from the end of it: the spin-up, the
      // scroll, the flatten, the lift and the field's opening are as 4a
      // timed them, condenseMs later on the click's clock. The curl (the row
      // curling into the wheel) takes curlMs from the end of the condense, over
      // the spin-up's first moments.
      condenseMs: 600,
      curlMs: 520,
      // The name dissolves into the field (its letters give way) from
      // nameOutStartMs over nameOutMs, across the spin-up.
      nameOutStartMs: 0,
      nameOutMs: 700,
      // The pull's winding eases in over this long instead of starting at full
      // rate (0 is the old kick at windStart); a time on the pull's own scale.
      windRampMs: 0,
      peakCardsPerSecond: 12.5, // COIL.spinCapCardsPerSecond
      // A coarse pointer's top speed: a phone can drop to 30 Hz (Low Power
      // Mode), where 9 cards a second is 0.3 card a frame, the most the eye
      // reads as turning the right way (above it the wheel strobes backward).
      coarsePeakCardsPerSecond: 9,
      upMs: 700,
      textOutMs: 350,
      scrollStartMs: 250,
      scrollMs: 2000,
      flattenStartMs: 1100,
      flattenMs: 1200,
      slowStartMs: 1500,
      slowMs: 1400,
      pullStartMs: 2150,
      pullMs: 756, // the old entrance's pull: 0.42 of 1800
      openStartMs: 0,
    },
    // The ribbon (slice 4c, the home's first screen): the 14 cards in one flat
    // row, face up, drifting left at speedPxPerS (a card rate once the row's
    // pitch is known, so the same strand offset drives the ring, the band and
    // the helix with no step in speed), under the paragraphs, its edges fading
    // out over fadeWidthPx. The row sits at the slot ([data-coil-ribbon]) the
    // page leaves for it, nudged by offsetYPx; where the page has no slot it
    // sits at `anchorY` (a share of the canvas's height). The card's height
    // is a knob for a desktop and for a phone-wide canvas (below
    // phoneBelowPx), the gap between cards another.
    ribbon: {
      cardHeightPx: 150,
      cardHeightPhonePx: 120,
      phoneBelowPx: 640,
      gapPx: 24,
      speedPxPerS: 20,
      fadeWidthPx: 120,
      offsetYPx: 0,
      anchorY: 0.62,
    },
    // The wheel (the ribbon's end state, before the flatten): the 14-card band
    // ring seen from a little above, face up (the spec guessed a lean of about
    // 10 degrees; that reads as a thin band, 18 and a ring 1.3 times the
    // diameter below read as a wheel). It sits at `anchor` (shares of the
    // canvas) at diameterOfHeight of the canvas's height; scale and the offsets
    // (shares of the canvas) nudge it from there.
    wheel: {
      leanDeg: -18,
      scale: 1.3,
      offsetX: 0,
      offsetY: 0,
      anchor: [0.5, 0.5] as const,
      diameterOfHeight: 0.42,
    },
    // The field's opening (slice 4c: it lifts the faded patch behind the
    // paragraphs, as the name dissolves into it): a circle anchored on the
    // name that grows from fromPx to reach (a share of the distance to the
    // farthest corner) over ms. hushFeatherPx: how softly the faded patches' edges give way. Its edge is feathered
    // featherPx wide at first and featherShare of that distance wide once the
    // circle is open (a crisp rim on a big disc reads as a halo, so the edge
    // widens with it), and falls off on a smoother curve than smoothstep
    // (lib/coil/field.glsl.ts). topFadePx: the stage's top edge fades in over
    // this many px, so the open field meets page 1's foot with no line, in the
    // scene and in the posters. fadeMs: the still path's crossfade.
    open: { reach: 1, ms: 1500, fromPx: 36, featherPx: 28, featherShare: 0.3, topFadePx: 72, fadeMs: 600, hushFeatherPx: 96 },
    // The two columns arrive last: group labels, then titles; delayMs counts
    // from the end of the condense (the scene clock's zero).
    columns: { delayMs: 2750, staggerMs: 36, labelStaggerMs: 70, fadeMs: 520, riseY: 14 },
  },

  // Page 1, the first screen (hero rework, slices 3 and 4c;
  // docs/superpowers/specs/2026-10-21-hero-rework-design.md): the loader that
  // becomes the name, the name drawn by the scene with the field inside its
  // letters, blocks 1 and 2 of the story, the thin wave, the ribbon and the
  // button on one screen. Every number here is a lab knob's default
  // (lib/home/introKnobs.ts clamps them; /lab/hero, in dev only, overrides
  // them at runtime). Aaron tunes them by hand.
  intro: {
    // The loader: fillMs is the fill's shortest run (the real tally can only
    // slow it), holdMs the pause at full, numberAfterMs when the percent shows
    // for a load still running, giveUpMs the honest cap after which a stalled
    // asset counts as loaded. On a fast connection the page is done about
    // 140ms (the page's own script) past fillMs + holdMs + shrink.ms: 1.42 s.
    loader: { on: true, fillMs: 550, holdMs: 80, numberAfterMs: 600, giveUpMs: 4000 },
    // The name's shrink onto its place: duration, and the ease (the site's, or a GSAP one).
    shrink: { ms: 650, ease: "site" as "site" | "power2.inOut" | "power3.inOut" | "expo.inOut" },
    // The name's size, its font size as a share of the viewport's width on a
    // desktop and on a phone, held between minRem and maxRem: how the stack
    // is made to fit one screen.
    name: { vwDesktop: 10, vwPhone: 12, minRem: 3, maxRem: 12 },
    // A desktop's top of the screen: the name beside the blocks (left, with the
    // two blocks staggered on its right) or above them.
    topLayout: "beside" as "beside" | "above",
    // A phone's first screen holds block 1; block 2 is there too, or waits in the about section.
    phoneBlock2: "about" as "about" | "first",
    // The soundtrack band's height on the first screen (the wave and its quiet
    // line), on a desktop and on a phone.
    band: { desktopPx: 100, phonePx: 88 },
    // The field behind the paragraphs: faded away behind them (a shader field
    // never sits behind body text), or left full.
    fieldUnderText: "faded" as "faded" | "full",
    // The burnt orange lobe's strength as a share of the old one, in the
    // first screen's field and the cards section's (a little of it stays).
    orangeAmount: 0.4,
    // The paragraph blocks: a right block leans across this share of the free
    // width, and a desktop leaves gapRem between blocks.
    stagger: { offset: 0.85, gapRem: 2 },
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
