// The wave path's numbers, from the wave lab's preset "Aaron's pick 3, always
// on" at lab commit cba9355, and the sections pick (DRAW_SPEED is 2800, Aaron's
// ruling over the preset's 4000, and follows the 0.8s lag at about 2.5px of arc
// per page px). Change them here, never in a view.

export const HEAD_AT = 0.7; // where on the viewport the head line sits, 0 top to 1 bottom
export const TRAIN_PX = 1600; // the drawn train behind the head, px of arc
export const TRAIN_FADE = 0.3; // the train's tail fade, as a share of its length
export const DRAW_SPEED = 2800; // the head's speed cap, px of arc per second
export const DRAW_EASE_S = 0.25; // the speed eases in over this long
export const HEAD_SMOOTHING = 7; // the head closes this share of its gap per second
export const HEAD_REST_PX = 0.2; // within this of the target the head rests
export const GATE_S = 0.25; // the swell's gate relaxes over this long
export const HEAD_SWELL = { gain: 0.7, px: 140 } as const;

export const AMPLITUDE = 80;
export const PHONE_AMPLITUDE = 48;
export const PHONE_MAX_WIDTH = 600;
export const SPACING = 13;
export const MAX_THICK = 5;
export const SHAPE_GAIN = 0.26;
export const WAVELENGTH = 240;
export const SPECTRUM_PERIOD = 480;
export const SPECTRUM_BINS = 64;

export const ALPHAS = {
  light: { muted: 0.35, accent: 0.5 },
  dark: { muted: 0.28, accent: 0.5 },
} as const;

export const MUSIC = { share: 1, intensity: 1.2, rise: 0.05, fall: 0.11, attackS: 0.052, releaseS: 0.174 } as const;
export const SHIMMER = { rate: 0.8, depth: 0.22 } as const;
export const SOFT_FEATHER = 0.08;
export const BREATH = { rate: 0.9, depth: 0.35 } as const;
// The answer's ripple, matched to the footer period's (lib/footer/constants.ts egg block).
// amp: the crest's height in amplitudes (the resting shape is SHAPE_GAIN, 0.26).
// speed: px of arc per second. width: the crest's 1/e half width, px. decay: per
// second (the egg's 1.2). swell: extra dot weight at the crest. lifeS: the cap.
// Aaron retunes it here.
export const RIPPLE = { amp: 0.45, speed: 650, width: 70, decay: 1.2, swell: 0.4, lifeS: 3 } as const;

// The idle ripple: a gentle wave that travels along the line while no music
// shapes it (paused, declined, or the wave held after an answer), so the line
// is never dead flat. Freeze and reduced motion still it. amp: the crest's
// height in amplitudes (the resting shape is SHAPE_GAIN, 0.26); height: how far
// it lifts a column's magnitude; wavelength and speed: px, and px of arc per
// second, of its travel (slower than the answer's ripple, which runs at 650);
// envelope and envelopeSpeed: the long, slower swell that keeps it from reading
// as one even sine. Aaron retunes it here.
export const IDLE = { amp: 0.12, height: 0.09, wavelength: 330, speed: 52, envelope: 1100, envelopeSpeed: 24 } as const;

// One line, not two: the line follows the scroll only once the band's bottom
// edge is above this share of the viewport's height, and after an answer it
// waits for the same moment (lib/wavepath/hold). One fraction for every screen,
// read against the viewport, never a page offset.
export const RELEASE_LINE = 0.4;

// How far below the band's box the line's return keeps (px beyond the dots' own reach), so the path never crosses the band.
export const BAND_CLEAR_EXTRA = 14;
// The soft edge, px, over which the path's dots thin out above that clearance, so no dot of the path lands in the band.
export const BAND_KEEP_FADE = 56;

export const PLUCK = { radius: 49, strength: 0.3, recovery: 0.6, speed: 700, width: 70, wave: 60, max: 4 } as const;

export const TILE_PX = 768;
export const TILE_MARGIN_PX = 200;
export const SAMPLE_STEP = 4; // px of arc between spine samples

export const RUN_START = -24; // px past the left edge
export const RUN_SPACING = 120; // px between the run's points: dense, so the curve through them stays level
export const RUN_PAST = 100; // px the run carries on past the right edge before any turn, so a turn is never on screen
