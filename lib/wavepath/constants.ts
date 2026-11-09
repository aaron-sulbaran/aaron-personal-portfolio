// The wave path's numbers, from the wave lab's preset "Aaron's pick 3, always
// on" at lab commit cba9355, and the sections pick. Change them here, never in
// a view.

export const HEAD_AT = 0.7; // where on the viewport the head line sits, 0 top to 1 bottom
export const TRAIN_FADE = 0.3; // the train's tail fade, as a share of its length
export const HEAD_REST_PX = 1; // within this of the target the head rests
export const GATE_S = 0.25; // the swell's gate relaxes over this long
export const HEAD_SWELL = { gain: 0.7, px: 140 } as const;

// THE WAVE'S PACE: Aaron tunes these by hand (lib/wavepath/pace, head). The head draws the line at a calm pace while any ink of
// its train is on the screen, and runs fast only while none is, to catch up unseen. Aaron, 2026-10-31: after the wave left the
// screen whole before it came back, a slow scroll drew it across the screen in under a second ("so fast"), and he wanted it "a
// bit less springy". Then, 2026-11-02, 2.1 s and 1.6 s felt "a bit slow now, almost a bit of an overcompensation": "the sweet spot is
// going to be in the middle at somewhere around 1.2-1.6 seconds probably or even slightly faster like 1.0-1.5". At a steady 300 px/s of scroll the calm pace draws the screen's width in CROSS_S seconds, whatever the scroll.
// Then A64: after a quick scroll to the bottom of a 390 by 844 phone the wave drew on for 12.8 s, and he chose a faster pace
// everywhere over a catch-up once the reader stops, knowing it brings back some of the surge above. So CROSS_S went from 1.4 and
// 1.2 to 0.6 and 0.5, and DRAW_SPEED from 2800 to 5600: the head runs at it only with no ink on screen, so the faster catch-up adds
// no surge a reader sees (the same scroll now draws on for 6.7 s on that phone, and 4.2 s at 1440 by 900, down from 6.6 s).
//   TRAIN_PX: the drawn train behind the head, px of arc. Every excursion off the screen is this long plus EXCURSION_MARGIN, so a
//     shorter train means less line to clear between two crossings (and the head catches up sooner).
//   CROSS_S: seconds the head takes to draw the screen's whole width while any of its train shows (a wide window, a phone).
//   DRAW_SPEED: the head's speed cap, px of arc per second, while none of its train is on the screen.
//   HEAD_SMOOTHING: the head closes this share of its gap to the target per second (lower: a longer, softer settle).
//   DRAW_EASE_S, DRAW_TURN_S: seconds the head's speed takes to ease in from rest, and to turn round when the reader scrolls back
//     (no spring, no surge).
export const TRAIN_PX = 1600;
export const CROSS_S = { wide: 0.6, phone: 0.5 } as const;
export const DRAW_SPEED = 5600;
export const HEAD_SMOOTHING = 4;
export const DRAW_EASE_S = 0.35;
export const DRAW_TURN_S = 0.2;

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

// The "Not now" swell: what the wave answers a Not now with, a gentler cousin of the ripple above, sent from the buttons at once (a
// yes's ripple waits for the band to scroll away; this one is for the band's own run, in view). One broad, low crest rolls out both
// ways across the wave in about a second and is gone, and the wave carries on with its idle motion. Same fields as RIPPLE; it must
// stay under it in height and weight, or the dots' room (lib/wavepath/fit) is too small for it. Aaron retunes it here.
export const SWELL = { amp: 0.3, speed: 850, width: 160, decay: 1.9, swell: 0.25, lifeS: 1.3 } as const;

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

// The line's route (lib/wavepath/serpentine), one shape per kind of window. A crossing keeps at least minRoom of the dots' reach
// (plus CLEAR_MARGIN) from any text or link, and is placed for the most room up to their whole reach, then for descent: each px
// it drops across the page is worth `descent` px of room, up to `drop` of the width. The next crossing starts at least `gap` px
// lower; `window` is how much lower than the first crossing that fits a better placed one may start. Tuned by eye on the real page.
export interface RouteShape { minRoom: number; gap: number; window: number; drop: number; descent: number }
export const ROUTE = {
  phone: { minRoom: 0.35, gap: 200, window: 120, drop: 0.5, descent: 0.3 },
  wide: { minRoom: 0.45, gap: 240, window: 160, drop: 0.22, descent: 0.3 },
  step: 4, // px between the heights the search tries
  turn: 70, // px past the edge a turn swings out, before the excursion carries on out to its length (EXCURSION_MARGIN)
  sample: 8, // px between the points the route is drawn through
} as const satisfies { phone: RouteShape; wide: RouteShape; step: number; turn: number; sample: number };

// The line leaves the screen before it comes back: every excursion past an edge (out of one stretch in view, round a turn, and into
// the next) is at least TRAIN_PX of arc plus this much, so the train's tail has left the screen by the time its head returns and the
// reader never sees the two legs of a turn at once. The margin is the arc of line between them with no wave on screen.
export const EXCURSION_MARGIN = 200;

// The path's dots keep this far from any text or link (px beyond a dot's own radius), however the page is laid out.
export const CLEAR_MARGIN = 4;
