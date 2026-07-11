"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Easing, type MotionValue } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { siteContent, type HomeTile as HomeTileEntry, type Photo, type WorkItem } from "@/lib/content";
import { useBodyScrollLock } from "@/lib/modal";
import { readScrollY, saveScrollY } from "@/lib/scroll";
import { EASE } from "@/lib/motion";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import {
  CAROUSEL,
  cardSpan,
  cardState,
  clamp01,
  collapseTransform,
  easeInOutCubic,
  toCollapse,
  wrap,
  type SeatPx,
  type Viewport,
} from "@/lib/carouselGeometry";
import { ArcIndex } from "./ArcIndex";
import { GlassTile, type TileActivatePayload } from "./GlassTile";
import { FlyingTile, type FlightPhase, type FlightSource, type FlightTarget } from "./FlyingTile";
import { PhotoModal } from "./PhotoModal";
import { WorkModal } from "./WorkModal";
import { MobileHome, type CarouselOpenPayload } from "./MobileHome";
import { Portal } from "./Portal";

// Layout effect on the client, no-op on the server. The refresh scroll recovery
// determination must run before paint (so a deep reload never flashes the
// entrance/freeze before jumping to "ready"), but a bare useLayoutEffect warns
// during SSR. This alias keeps the pre-paint timing without the warning.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Reload threshold: a restored scroll position past half a viewport (clearly out
// of the hero) takes the fast path and skips the entrance + freeze. Below it we
// treat the reload as a top arrival and play the full intro.
const FAST_START_THRESHOLD_FRAC = 0.5;

// Explored-tile persistence (ring-arc redesign, plan §3). Per-visit, not
// per-device: sessionStorage, not localStorage.
const EXPLORED_STORAGE_KEY = "aaron-explored-tiles";

// Context so the center content (HomeHero) can react to the ring's state.
// Keeps state ownership in TileRing and avoids prop-drilling through children.
// Default is "pre" so SSR + pre-hydration renders treat HomeHero as hidden;
// once the provider mounts, real state flows in. modalOpen reflects the
// photo/work modals TileRing owns, so HomeHero can recede the hero when one
// opens (the deferred background blur leaves the hero exposed otherwise).
type RingState = { phase: "pre" | "entering" | "ready"; modalOpen: boolean };
const RingStateContext = createContext<RingState>({ phase: "pre", modalOpen: false });
export const useRingState = () => useContext(RingStateContext);

// Per-card collapse offset, the bridge that keeps the click -> flip -> modal
// flight correct once the scroll layer rearranges the ring into a deck or
// carousel. The scroll layer (GSAP) writes both the DOM transform on a card's
// outer wrapper and this matching value; the flight geometry reads it. An
// identity offset means "ring/hero state", where the flight math is byte-for-
// byte what it was before this layer existed. dx/dy are viewport px, scale is
// a multiplier, rotZ/rotX/rotY are degrees, applied in the ring plane.
type CardCollapse = {
  dx: number;
  dy: number;
  scale: number;
  rotZ: number;
  rotX: number;
  rotY: number;
  tz: number;
};

const IDENTITY_COLLAPSE: CardCollapse = { dx: 0, dy: 0, scale: 1, rotZ: 0, rotX: 0, rotY: 0, tz: 0 };

type Props = {
  children: React.ReactNode; // HomeHero sits at the ring's center
};

// Live per-tile transform captured at activation time so the flight clone
// can spawn exactly where the tile is on screen, plus the trigger button
// for focus restoration when the modal closes.
type TileCapture = {
  leanX: number;
  leanY: number;
  leanRot: number;
  leanScale: number;
  rotX: number;
  rotY: number;
  button: HTMLButtonElement | null;
  // True only when the tile was activated from a keyboard-focused button. The
  // modal restores focus on close only then, so a tap never leaves a focus ring.
  wasKeyboard: boolean;
};

// Ring geometry (desktop). 20 tiles around a 41vmin ring give ~13vmin of arc
// per tile; a 9vmin tile leaves a ~4vmin gap between each, the airy
// breathing the Inkwell reference has. Mobile keeps all 20 with slightly
// smaller tiles and radius so the ring still reads as a ring on narrow
// screens.
const RING_RADIUS_VMIN = 41;
const RING_RADIUS_VMIN_MOBILE = 42;
const TILE_WIDTH_VMIN = 9;
const TILE_WIDTH_VMIN_MOBILE = 9; // matches desktop arc fill (~70%) so mobile tiles do not overlap

// Native-large layout (photo crispness). 3D-transformed layers are texture-
// mapped at their LAYOUT size, so a card laid out at the 9vmin display size
// blurs when the settled arc scales it up ~3.1x. The desktop tile is laid out
// at 10/3 the display size (30vmin x 40vmin); native and display are both
// vmin, so the ratio is resize-stable.
//
// WHERE the 1/3.33 down-scale lives is a hard rendering constraint (WS-H).
// Chromium picks a layer's raster scale from the accumulated FLAT 2D scales
// in its ancestor chain; a 3D-rotated ancestor's scale component is dropped
// from that computation. The carousel's collapse wrapper carries rotateX, so
// if the down-scale sat on a flat layer BELOW it (the Framer seat layer, as
// WS-G originally had it), every tilted or rotating card rasterized at 0.3x
// and was GPU-magnified ~3x: the mid-rotation dither Aaron flagged. So the
// down-scale must ride ON the 3D wrapper itself, where it is dropped together
// with the rest of the wrapper's scale and the raster falls back to the
// native layout size (>= on-screen size at every arc position):
//   - Framer's seat/entrance layer runs in NATIVE units (positions x 10/3,
//     design scales with no REST_SCALE factor).
//   - The GSAP wrapper rests at a static scale(REST_SCALE) (flat 2D at the
//     hero, so hero raster stays 1:1 with the 9vmin display card) and the
//     driver writes wrapper scale = collapse.scale * REST_SCALE, always in
//     [0.3, ~0.93], so a stale or dropped raster only ever DOWN-scales.
// All collapse and flight math stays in 9vmin display units: collapseRef
// keeps display semantics, only the DOM transform string is native-frame.
const TILE_NATIVE_SCALE = 10 / 3;
const REST_SCALE = 1 / TILE_NATIVE_SCALE;
// Resting wrapper transform (identity collapse rendered in the native frame).
// The wrapper is a 0x0 div at the stage center, so a bare scale composes the
// same down-scale about the viewport center for every card.
const REST_WRAPPER_TRANSFORM = `scale(${REST_SCALE})`;

// Entrance timing, in milliseconds.
const FIRST_TILE_HOLD_MS = 260;   // one tile visible alone before the stack flashes in
const STACK_FLASH_MS = 160;       // rest of the tiles pile on top of the first
const SHUFFLE_TICK_MS = 150;      // how fast the top card cycles during shuffle; slowed so each top card lifts, settles, and hands off cleanly
const SHUFFLE_DURATION_MS = 470;  // riffle anticipation before the fan; ~3 distinct cards preview at the 150ms tick (deck is 20, so no repeats under 2.4s)
const TILE_FAN_DURATION_MS = 780; // per-tile travel time to its ring seat (design.md: 780)
const TILE_FAN_STAGGER_MS = 17;   // staggered unfurl: tiles bloom in ring order so the fan sweeps around the circle in proportion to the shuffle build-up

// Curved fan-out (revolve). The fanning path is not a straight chord to the
// seat; each tile blooms from the collapsed deck along a gently bowed arc while
// rotating up to its tangent seat, so the ring "unfurls" from the deck. See
// docs/design.md "Home-ring entrance choreography". The path is sampled at
// FAN_SAMPLES points with the decelerate baked into the sample spacing (so a
// single linear tween reads as one continuous ease-out, no mid-arc stall).
const FAN_SWEEP_DEG = 36;      // gentle clockwise swing of the travel arc
const FAN_ARC_LIFT_VMIN = 6;   // how far the travel path bows past the straight chord
const FAN_SAMPLES = 7;         // arc sample count (smooth bow, still compositor-cheap)

// Cursor parallax: 3D tilt on the ring container. The ring rotates on X/Y
// axes in response to cursor position; it reads as "looking down into a
// crystal ball that leans with your gaze," not "the page is sliding."
// Window/page frame stays still; only the ring plane is tilting in space.
const PARALLAX_MAX_TILT_DEG = 14;   // max X/Y rotation in degrees
const PARALLAX_MAX_ZROT_DEG = 3;    // small Z roll for additional depth
const RING_PERSPECTIVE_PX = 1400;   // perspective distance on the ring stage

// Ring-arc scroll driver plumbing (desktop-only; mobile lives entirely in
// MobileHome). The locked design values (spread, radius, tilt, timings) live
// in CAROUSEL in lib/carouselGeometry; these are the driver's own wiring
// numbers. Free-scroll scrub model (design redirect, 2026-07-02): scroll is
// never blocked or driven; the pin's native progress is the transition's
// input and the ticker chases it with smoothing, so the only "delay" is the
// animation itself, played faster under a faster scroll.
// Runway lengths (Aaron-retuned 2026-07-03 round 2): pacing comes from scroll
// DISTANCE, never from input capture. The dwell snap PARKS NEAR THE PIN EXIT,
// not mid-dwell: the runway BEFORE the snap point absorbs inbound momentum,
// while the exit toll (snap point to pin end, ~300px) stays a couple of wheel
// notches. The first cut parked mid-dwell, which made leaving the carousel
// cost 1-2 seconds of dead scrolling toward the page below.
const PIN_SPACER_PERCENT = 140;      // pin spacer height (% of viewport). The transition
                                     // completes inside it; the rest is settled dwell runway.
const ARRIVE_PORTION = 0.62;         // pin progress where the transition target reaches 1;
                                     // beyond it the carousel dwells while scroll keeps moving
const SCRUB_TAU = 0.18;              // seconds. clock.p chases the scroll target with
                                     // 1 - exp(-dt/tau) smoothing: a fast flick plays a FAST
                                     // but complete spin-and-slide instead of teleporting.
const SNAP_HERO_MAX_PROGRESS = 0.25; // a stopped scroll below this settles back on the hero
const SNAP_FREE_MIN_PROGRESS = 0.95; // ...past this it is free into Work (snap leaves it alone)
const DWELL_SNAP_PROGRESS = 0.8;     // ...between: parked here, near the exit
const SNAP_SCROLL_SECONDS = 0.35;    // snap tween duration; light and user-interruptible
const SNAP_SCROLL_DELAY_S = 0.06;    // idle beat before the snap engages
const ROT_BLEND_START_P = 0.5;       // rotation normalization: fully at the ring home
                                     // (identity, every card at its own seat) at p <= this
const ROT_BLEND_END_P = 0.98;        // ...and fully the browsed rotation at p >= this
const WHEEL_LINE_DELTA_PX = 16;      // WheelEvent deltaMode LINE -> px
const SETTLED_MIN_P = 0.999;         // p above this counts as the settled carousel
const CLICK_GATE_LOW_P = 0.05;       // cards are clickable only at the hero (p < low)
const CLICK_GATE_HIGH_P = 0.95;      // ...or the settled carousel (p > high), never mid-flight
// Rotation model (2026-07-03). Two input classes, one rendered rotation.
// Frame-by-frame analysis of the QA recordings plus live instrumentation
// proved the visible "snap" was single-frame displacement discontinuities
// at the rest/motion boundaries (a wheel notch teleporting rotation in the
// input path; the Euler-integrated velocity-impulse spring igniting at max
// acceleration under a long frame, measured live at 24-26px in one frame),
// never an easing artifact. Both mechanisms below bound the displacement
// any frame bordering stillness can carry.
//
// WHEEL is a real-time scrub: wheel travel moves a continuous position
// target 1:1 (px / CAROUSEL.WHEEL_PX_PER_CARD), and the rendered rotation
// chases it through a CLOSED-FORM critically damped spring. Scroll
// distance, not scroll speed, decides where the carousel goes, so a fast
// flick travels exactly as far as the fingers did and can never skip
// cards. The second-order chase starts every response at zero velocity
// (a discrete mouse notch cannot teleport the arc the way the prototype's
// direct `rotation += step` did), the closed-form update is exact for any
// frame duration (immune to the long-frame Euler overshoot), and once the
// wheel goes idle the target rounds to the nearest card and the same chase
// eases the residual home; nothing ignites, kills, or hands off.
//
// KEYBOARD and AUTO-ADVANCE are discrete single-card steps: one
// power2.inOut tween (zero velocity at BOTH ends) per card, queued when
// key input outruns the active step, so arrows always traverse every
// intermediate card. A wheel event mid-tween kills the tween and seeds the
// chase with the measured rotation velocity, so the hand always wins with
// a continuous handoff.
const CHASE_OMEGA = 12;              // rad/s, critical damping; scrub lag ~2/omega s
const CHASE_REST_EPS_CARDS = 0.0005; // close enough to pin the exact integer...
const CHASE_REST_EPS_V = 0.004;      // ...once velocity is also negligible
const WHEEL_SETTLE_IDLE_MS = 320;    // wheel-quiet time before the target rounds to a card
const STEP_QUEUE_MAX = 2;            // pending keyboard steps beyond the active tween
const STEP_CATCHUP_S = 0.32;         // queued follow-up steps (responsive catch-up)
const STEP_KEY_S = 0.6;              // arrow-key step
const STEP_AUTO_S = 0.85;            // auto-advance step (deliberate, cinematic)
// Wrappers go visibility:hidden below this opacity. Matches CAROUSEL.HIT_
// OPACITY_MIN (the click gate) rather than a separate near-zero threshold:
// cards between the two would otherwise stay in the DOM (not visibility:
// hidden, so still Tab-focusable) while the click gate refuses to activate
// them, a silent dead end for keyboard users who tab onto a card and press
// Enter. Tying both to the same constant keeps "focusable" and "clickable"
// in lockstep.
const CARD_HIDE_OPACITY = CAROUSEL.HIT_OPACITY_MIN;
const HERO_FADE_RATE = 2.8;          // hero copy fades as 1 - p * rate (gone early in the spin)
const PANEL_FADE_START_P = 0.6;      // caption/left-panel fade window over the slide beat
const PANEL_FADE_SPAN_P = 0.35;
const PANEL_SLIDE_PX = 20;           // left text panel's entrance slide distance (translateX)
const ENGAGE_MIN_P = 0.004;          // p above this parks parallax/proximity (collapseEngaged)

// Per-tile cursor proximity. Tiles within PROXIMITY_RADIUS_PX of the cursor
// get pulled slightly toward it, scaled up, and rotated to lean toward the
// cursor. Influence falls off quadratically so the closest tile reacts
// strongest and neighbors react less; tiles beyond the radius are at rest.
const PROXIMITY_RADIUS_PX = 220;
const PROXIMITY_PULL_PX = 8;      // max translation toward cursor
const PROXIMITY_LIFT_PX = 6;      // max lift (negative Y) for closest tile
const PROXIMITY_TILT_DEG = 10;    // max rotation toward cursor
const PROXIMITY_SCALE_BOOST = 0.08; // +8% at zero distance

// Proximity-driven 3D flip. INVERTED curve: the hovered tile (cursor on
// it) stays close to its baseline; the NEIGHBORS are the ones that tilt
// in 3D as the cursor passes near. A bell-shaped strength function peaks
// at mid-distance and drops to 0 both at the tile center and at the
// radius edge, producing the "cards parting around the cursor" motion.
// Tiles also carry a small per-tile baseline rotation so none of them is
// ever perfectly flat; always reads as a 3D glass card catching light.
const NEIGHBOR_FLIP_MAX_DEG = 26;      // max tilt on X/Y for mid-distance tiles
const TILE_BASELINE_DEG = 6;           // per-tile deterministic resting tilt

// Deterministic per-tile resting tilt. Shared between TileSlot (live
// transforms) and TileRing's flight logic (closing-land state).
function tileBaselineRotX(tileIndex: number) {
  return Math.sin(tileIndex * 1.3 + 0.7) * TILE_BASELINE_DEG;
}
function tileBaselineRotY(tileIndex: number) {
  return Math.cos(tileIndex * 1.7 + 0.2) * TILE_BASELINE_DEG;
}

// Internal phase machine. Exposed externally as "pre" | "entering" | "ready"
// via context; the finer phases are an implementation detail of the
// entrance sequence.
type Phase = "hidden" | "firstTile" | "stacking" | "shuffling" | "fanning" | "ready";

export function TileRing({ children }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Reduced-motion users skip straight to the final state. Start from
  // "hidden" so the first client frame matches SSR (no tiles visible); the
  // effect below advances us through the sequence.
  const [phase, setPhase] = useState<Phase>(
    prefersReducedMotion ? "ready" : "hidden",
  );

  // Refresh scroll recovery: true when this load is a reload/deep-link that
  // lands past the hero, so we skip the entrance + freeze and keep the restored
  // position. Determined before paint in the layout effect below (it can't be a
  // useState initializer: reading scroll/hash is client-only and would mismatch
  // SSR, which renders the "hidden" start state). `fastStart` folds it together
  // with reduced motion, which already takes this same skip-the-intro path.
  const [skipEntrance, setSkipEntrance] = useState(false);
  const fastStart = !!prefersReducedMotion || skipEntrance;

  // Set once, before paint, on a fast start: the scroll position (px) or section
  // element to land on after the pin spacer exists. Consumed inside the
  // scroll-collapse useGSAP so the restore maps to the right content.
  const restoreTargetRef = useRef<{ y: number | null; selector: string | null } | null>(null);

  // Which tile is currently "on top of the stack" during the shuffle phase.
  // Cycles rapidly (SHUFFLE_TICK_MS) through 0..total-1 to produce the
  // card-dealer riffle effect.
  const [shuffleTopIndex, setShuffleTopIndex] = useState(0);

  const publicState: "pre" | "entering" | "ready" =
    phase === "ready" ? "ready" : phase === "hidden" ? "pre" : "entering";

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null);

  // Mobile coverflow taps open a modal with no flight tile landing in the slot,
  // so modalFromCarousel tells the modals to render their own image. MobileHome
  // owns all mobile scroll/swipe state internally; TileRing only needs this flag.
  const [modalFromCarousel, setModalFromCarousel] = useState(false);

  // Shared-element flight: a tile clone that animates from its ring seat
  // into the modal's image slot (and back on close). The modal mounts
  // mid-flight, so the crossfade between the flown tile and the modal's own
  // image is brief enough to read as a single continuous motion.
  const [flight, setFlight] = useState<{
    tile: HomeTileEntry;
    tileIndex: number;      // index into `seats` for re-measuring home on resize
    homeRect: FlightTarget; // intrinsic rect centered on the tile's seat
    homeTangentDeg: number; // ring tile's tangent Z rotation
    homeRestRotX: number;   // tile's baseline X tilt at rest
    homeRestRotY: number;   // tile's baseline Y tilt at rest
    source: FlightSource;   // live transform captured at click time
    target: FlightTarget;   // initial slot guess (home rect); FlyingTile tracks the live slot itself
    phase: FlightPhase;
    reveal: boolean;        // photo cleared its frost to true color in the modal
  } | null>(null);

  // Explored tiles (opened at least once), keyed by tile.key. Starts empty so
  // SSR and the first client paint match; hydrated from sessionStorage in the
  // mount effect below. Marked at MODAL CLOSE, not open (plan §3: the user
  // watches the card they just left frost over in GlassTile's `frosted` veil).
  const [explored, setExplored] = useState<Set<string>>(() => new Set());
  // Imperative mirror of `explored`, kept in sync by the effect below. The
  // left text panel (a separate workstream) reads this ref inside its
  // imperative per-frame write path without forcing a re-render of all 20
  // tiles; this workstream only wires the ref, it builds no panel UI.
  const exploredRef = useRef<Set<string>>(explored);
  // Guards the very first write-back pass (see below) so a hydration read
  // in flight is never clobbered by the pre-hydration empty state.
  const exploredWriteArmedRef = useRef(false);

  // Hydrate from sessionStorage once, after mount (client-only; keeps SSR and
  // the first paint at an empty set).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EXPLORED_STORAGE_KEY);
      if (!raw) return;
      const keys: unknown = JSON.parse(raw);
      if (Array.isArray(keys)) setExplored(new Set(keys.filter((k): k is string => typeof k === "string")));
    } catch {
      // Private mode / disabled storage: degrade to no persistence.
    }
  }, []);

  // Mirror into the ref and persist on every change. The mount-time hydration
  // effect above and this effect both run on the same first commit, in
  // declaration order; if this ran unconditionally it would write today's
  // still-empty `explored` to storage BEFORE the hydration effect's
  // setExplored (an async update) lands, clobbering whatever was persisted
  // from a prior visit. Skipping the very first pass avoids that: hydration's
  // setExplored (if any) triggers a second commit, and this effect writes the
  // real value from there on, including every later explored-at-close change.
  useEffect(() => {
    exploredRef.current = explored;
    if (!exploredWriteArmedRef.current) {
      exploredWriteArmedRef.current = true;
      return;
    }
    try {
      sessionStorage.setItem(EXPLORED_STORAGE_KEY, JSON.stringify(Array.from(explored)));
    } catch {
      // Private mode / disabled storage: degrade to no persistence.
    }
  }, [explored]);

  // Gate the scroll-collapse setup until just after the hero has faded in.
  // Creating the ScrollTrigger pin reflows the hero subtree, which would snap
  // the hero's opacity transition mid-fade (it would pop instead of fade).
  const [scrollReady, setScrollReady] = useState(false);

  // Hold scroll through the WHOLE entrance (shuffle, fan-out, hero settle) so a
  // fast flick can't blow past the intro and the ring-to-deck collapse before
  // they ever play. The lock releases once the collapse pin is armed
  // (scrollReady), so the user lands at the top with the animation ready to
  // scrub. Fast-start loads (reduced motion, or a reload that lands deep in the
  // document) start at "ready" and are never locked: freezing scroll on a deep
  // reload is exactly the broken-feeling stuck window this recovery removes.
  const entranceLocked = !fastStart && !scrollReady;
  useBodyScrollLock(entranceLocked);

  // Belt-and-suspenders for the entrance freeze: the body overflow lock removes
  // the scrollbar, but block wheel and touch outright too so a hard flick can't
  // sneak any scroll through before the intro and the collapse have played.
  useEffect(() => {
    if (!entranceLocked) return;
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
    };
  }, [entranceLocked]);

  // Parallax motion values, spring-smoothed. pX/pY are normalized cursor
  // position in [-1..1] (0 = viewport center). Feed through springs so the
  // ring lags the cursor slightly for a "weighted" feel.
  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);
  const smoothX = useSpring(parallaxX, { stiffness: 60, damping: 20, mass: 0.9 });
  const smoothY = useSpring(parallaxY, { stiffness: 60, damping: 20, mass: 0.9 });

  // Raw cursor pixel position (viewport-relative) for per-tile proximity,
  // shared through a plain ref plus a tick MotionValue bumped exactly once
  // per coalesced pointer frame. Tiles subscribe to the tick, a counter that
  // never equality-short-circuits (pure horizontal or pure vertical movement
  // still fires), and read coordinates from the ref; one compute per tile
  // per frame instead of two. Initial position is off-screen so tiles rest
  // on mount.
  const cursorRef = useRef({ x: -9999, y: -9999 });
  const proximityTick = useMotionValue(0);

  // Cached viewport dimensions, refreshed only on mount + resize. The per-tile
  // proximity math used to call window.innerWidth/innerHeight on every tile on
  // every pointer move (14 reads/move); now each tile reads this ref instead.
  const viewportRef = useRef({ vw: 0, vh: 0, vmin: 0 });

  // 3D tilt: cursor X rotates the ring around the Y axis (yaw); moving the
  // cursor right swings the right edge of the ring AWAY from the viewer.
  // Cursor Y rotates around the X axis (pitch); moving the cursor up tips
  // the top of the ring TOWARD the viewer. Small Z roll layered on for
  // extra depth feel.
  const rotateY = useTransform(smoothX, (v) => `${v * PARALLAX_MAX_TILT_DEG}deg`);
  const rotateX = useTransform(smoothY, (v) => `${-v * PARALLAX_MAX_TILT_DEG}deg`);
  const rotateZ = useTransform(smoothX, (v) => `${v * PARALLAX_MAX_ZROT_DEG}deg`);

  // Scroll collapse plumbing. `collapseEngaged` flips true the moment the
  // scrub leaves the hero so parallax and proximity stand down (the deck is
  // flat). sectionRef scopes the useGSAP context; heroContentRef is the hero
  // copy faded out as the ring gathers into the deck.
  const [collapseEngaged, setCollapseEngaged] = useState(false);
  const engagedRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const heroContentRef = useRef<HTMLDivElement | null>(null);
  // Left text panel (ArcIndex) container; fades + slides in over the
  // transition's slide beat, written imperatively every frame (see the
  // renderFrame panel block below).
  const deckHintRef = useRef<HTMLDivElement | null>(null);
  // ArcIndex content. Written imperatively via writeActiveCard so rotation/
  // auto-advance never re-renders the 20 tiles. lastFocusRef tracks the most
  // recently written focus index (-1 = nothing focused) so the explored-
  // status refresh effect below knows whether/what to re-write.
  const arcIndexNumRef = useRef<HTMLSpanElement | null>(null);
  const arcIndexKindRef = useRef<HTMLSpanElement | null>(null);
  const arcIndexStatusRef = useRef<HTMLSpanElement | null>(null);
  const arcIndexTitleRef = useRef<HTMLHeadingElement | null>(null);
  const arcIndexBlurbRef = useRef<HTMLParagraphElement | null>(null);
  // The panel's live-region wrapper, opacity-dipped on focus change so the
  // text swap reads soft instead of hard (Aaron feedback, 2026-07-03).
  const arcIndexSwapRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<number>(-1);
  // True while a tile is mid-flight (out OR closing). The carousel driver
  // freezes wheel rotation and auto-advance while this is set so the flown
  // card's home slot holds still behind the modal.
  const flightActiveRef = useRef(false);
  // Mirror of modalOpen for the driver's ticker/wheel paths (no re-subscribe).
  const modalOpenRef = useRef(false);
  // Reduced-motion seam (plan §3 / WS-D): set inside the reduced-motion
  // matchMedia branch below to a closure that steps the static arc's
  // rotation +-1 card instantly, the same step the arrow-key handler in that
  // branch calls. The visible prev/next buttons rendered near the JSX bottom
  // call through this ref instead of duplicating rotation/render logic, and
  // it is nulled on that branch's cleanup so a stray click after a motion-
  // preference flip is a no-op rather than a stale closure.
  const staticStepRef = useRef<((dir: 1 | -1) => void) | null>(null);
  // Live transition progress p (0 hero, 1 settled carousel), written by the
  // driver every frame. handleTileClick reads it to refuse activations while
  // the forced transition is in flight, and per-card opacity gates faded cards
  // (the wrapper cannot block clicks itself: the inner tile layer re-enables
  // pointer events to punch through the stage's pointer-events-none).
  const carouselPRef = useRef(0);
  const cardOpacityRef = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Keep the cached viewport dims fresh. Read on mount and on resize only;
  // never in the hot per-move proximity path.
  useEffect(() => {
    const read = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      viewportRef.current = { vw, vh, vmin: Math.min(vw, vh) };
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Parallax listener: only active on fine-pointer devices, once the
  // entrance has completed, and only when NO flight is in progress. During
  // a flight we also reset parallax/proximity to 0 (below) so the ring
  // goes flat while the modal is up. That way when the flight returns, the
  // ring is at its pure seat position with zero tilt/lean, matching the
  // flying tile's final rest state pixel-perfectly.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase !== "ready") return;
    if (flight) return;
    if (collapseEngaged) return;
    const fine = window.matchMedia("(pointer: fine)");
    if (!fine.matches) return;

    // Coalesce pointer moves to one write per animation frame. High-Hz mice
    // and event coalescing can fire pointermove several times per frame; each
    // write re-targets ~90 springs across the ring, so collapsing the burst
    // into a single rAF flush cuts redundant per-frame work substantially.
    let pendingX = 0;
    let pendingY = 0;
    let hasPending = false;
    let raf = 0;

    const flush = () => {
      raf = 0;
      if (!hasPending) return;
      hasPending = false;
      const { vw, vh } = viewportRef.current;
      const w = vw || window.innerWidth;
      const h = vh || window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      // Ring moves AWAY from cursor: negate.
      parallaxX.set(-((pendingX - cx) / cx));
      parallaxY.set(-((pendingY - cy) / cy));
      // Raw pixel position for per-tile proximity: one tick per frame.
      cursorRef.current.x = pendingX;
      cursorRef.current.y = pendingY;
      proximityTick.set(proximityTick.get() + 1);
    };

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      hasPending = true;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onLeave = () => {
      hasPending = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      parallaxX.set(0);
      parallaxY.set(0);
      cursorRef.current.x = -9999;
      cursorRef.current.y = -9999;
      proximityTick.set(proximityTick.get() + 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [parallaxX, parallaxY, proximityTick, phase, prefersReducedMotion, flight, collapseEngaged]);

  // While the scroll collapse is engaged, park parallax flat (springs ease to
  // 0) so the deck reads flat and the flight projection stays identity. The
  // listener above is already disabled; this only zeroes the resting target.
  useEffect(() => {
    if (!collapseEngaged) return;
    parallaxX.set(0);
    parallaxY.set(0);
    cursorRef.current.x = -9999;
    cursorRef.current.y = -9999;
    proximityTick.set(proximityTick.get() + 1);
  }, [collapseEngaged, parallaxX, parallaxY, proximityTick]);

  // When a flight starts, kick parallax back to 0 (and park the shared
  // cursor off-screen, bumping the tick so all per-tile lean/flip springs
  // relax to rest). Spring-smoothed so the ring eases to flat over ~400ms
  // rather than snapping; the flight clone captured the live transform at
  // click time, so the relaxation happens invisibly behind the modal. By
  // the time the user closes the modal, the flying tile's closing animation
  // lands at a position that exactly matches where the ring tile will sit
  // when flight clears, with no snap.
  useEffect(() => {
    if (!flight) return;
    parallaxX.set(0);
    parallaxY.set(0);
    cursorRef.current.x = -9999;
    cursorRef.current.y = -9999;
    proximityTick.set(proximityTick.get() + 1);
  }, [flight, parallaxX, parallaxY, proximityTick]);

  // Mirror flight presence into a ref the carousel driver can read without
  // re-subscribing. While a tile flies (out or closing), wheel rotation and
  // auto-advance stay frozen so the card's home slot holds still.
  // Layout effect, not passive: the ring driver (wheel + auto-advance) reads
  // this ref to freeze the card's home slot during a flight. A passive effect
  // flushes after paint, leaving a window where a ticker tick or wheel event
  // moves the slot AFTER FLIP geometry was captured. Syncing before paint closes
  // it.
  useIsoLayoutEffect(() => {
    flightActiveRef.current = flight !== null;
  }, [flight]);

  // Arm the scroll collapse a beat after the entrance completes so the hero
  // fade (420ms) finishes before the pin's reflow lands. Fast-start loads have
  // no entrance fade to protect (the determination effect already armed
  // scrollReady before paint), so this is a no-op for them; it stays here to
  // arm reduced motion that loaded at the top.
  useEffect(() => {
    if (phase !== "ready") return;
    if (fastStart) {
      setScrollReady(true);
      return;
    }
    const t = window.setTimeout(() => setScrollReady(true), 520);
    return () => window.clearTimeout(t);
  }, [phase, fastStart]);

  // Refresh scroll recovery determination. Runs once, before paint, so a deep
  // reload never flashes the entrance or the freeze before settling. Takes
  // manual control of scroll restoration (we restore the position ourselves
  // once the pin spacer exists, in the scroll-collapse useGSAP) and decides
  // whether this load lands past the hero. When it does, it jumps the entrance
  // straight to its settled end-state and arms the collapse immediately, all
  // within this synchronous pre-paint pass.
  useIsoLayoutEffect(() => {
    let prevRestoration: History["scrollRestoration"] | null = null;
    if ("scrollRestoration" in history) {
      prevRestoration = history.scrollRestoration;
      history.scrollRestoration = "manual";
    }

    // GSAP's ScrollTrigger.refresh() forces history.scrollRestoration back to
    // "auto" every time it runs (on load, resize, and font-ready). That quietly
    // defeats our manual control: with "auto" live at unload, the browser
    // auto-restores on the next reload, which is the top-to-target flash we are
    // removing. Re-assert manual after every refresh so it is always manual at
    // unload time, regardless of how many times GSAP refreshes.
    const keepManual = () => {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    };
    ScrollTrigger.addEventListener("refresh", keepManual);

    const hash = window.location.hash;
    const hasSectionHash = hash.length > 1 && hash !== "#main";
    // Prefer our own persisted position; fall back to whatever the browser
    // already auto-restored (the very first reload, before our manual setting
    // takes effect on later loads). Either is a valid "where they were".
    const savedY = readScrollY();
    const targetY = savedY != null ? savedY : window.scrollY;
    const deep =
      hasSectionHash || targetY > window.innerHeight * FAST_START_THRESHOLD_FRAC;

    if (deep) {
      restoreTargetRef.current = { y: targetY, selector: hasSectionHash ? hash : null };
      setSkipEntrance(true);
      setPhase("ready");
      setScrollReady(true);
    }

    return () => {
      ScrollTrigger.removeEventListener("refresh", keepManual);
      if (prevRestoration) history.scrollRestoration = prevRestoration;
    };
    // Mount-only: the restore target and start-state are decided once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the scroll position so the next load can restore it and base the
  // fast-start decision on it. rAF-coalesced to one write per frame; also
  // written on pagehide to capture the final resting position before a reload.
  useEffect(() => {
    let raf = 0;
    const write = () => {
      raf = 0;
      saveScrollY(window.scrollY);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onPageHide = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      saveScrollY(window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Drive the entrance sequence on mount. Each timer advances one phase.
  // Skipped entirely on a fast start (reduced motion or deep reload): the
  // determination effect jumps phase straight to "ready".
  useEffect(() => {
    if (fastStart) return;
    if (phase !== "hidden") return;

    // Kick off the sequence on the next frame so SSR/CSR render matches
    // before Framer takes over.
    const kickoff = requestAnimationFrame(() => setPhase("firstTile"));
    return () => cancelAnimationFrame(kickoff);
  }, [phase, fastStart]);

  useEffect(() => {
    if (fastStart) return;
    if (phase !== "firstTile") return;
    const t = window.setTimeout(() => setPhase("stacking"), FIRST_TILE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, fastStart]);

  useEffect(() => {
    if (fastStart) return;
    if (phase !== "stacking") return;
    const t = window.setTimeout(() => setPhase("shuffling"), STACK_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [phase, fastStart]);

  // Shuffle: cycle which tile is on top. Every SHUFFLE_TICK_MS a different
  // tile rises to the front of the stack with a tiny pop. After
  // SHUFFLE_DURATION_MS, hand off to fanning.
  useEffect(() => {
    if (fastStart) return;
    if (phase !== "shuffling") return;
    const total = siteContent.homeTiles.length;
    const tick = window.setInterval(() => {
      setShuffleTopIndex((i) => (i + 1) % total);
    }, SHUFFLE_TICK_MS);
    const done = window.setTimeout(() => {
      setPhase("fanning");
    }, SHUFFLE_DURATION_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [phase, fastStart]);

  // Fanning → ready: triggered when the last tile's fan animation completes
  // (see onAnimationComplete on that tile). As a safety net, also flip to
  // ready after the theoretical total fanning duration in case the
  // onAnimationComplete doesn't fire (e.g., tab backgrounded, motion paused).
  useEffect(() => {
    if (fastStart) return;
    if (phase !== "fanning") return;
    const total = siteContent.homeTiles.length;
    const totalFanMs = TILE_FAN_DURATION_MS + TILE_FAN_STAGGER_MS * (total - 1);
    const t = window.setTimeout(() => setPhase("ready"), totalFanMs + 80);
    return () => window.clearTimeout(t);
  }, [phase, fastStart]);

  const tiles = siteContent.homeTiles;
  const total = tiles.length;

  // Write the focused card into the ArcIndex DOM (no React state, so the 20
  // tiles never re-render on rotation/auto-advance). `i` is the card index,
  // or null to clear (reset/reverse-to-hero). lastFocusRef tracks the last
  // index written so the explored-status refresh effect can re-stamp the
  // status label without recomputing everything when the explored set
  // changes out from under an already-focused card (a modal close).
  const writeActiveCard = useCallback(
    (i: number | null) => {
      const num = arcIndexNumRef.current;
      const title = arcIndexTitleRef.current;
      if (!num || !title) return;
      const kind = arcIndexKindRef.current;
      const status = arcIndexStatusRef.current;
      const blurb = arcIndexBlurbRef.current;
      const tiles = siteContent.homeTiles;
      if (i == null || i < 0) {
        num.textContent = "";
        title.textContent = "";
        if (kind) kind.textContent = "";
        if (status) status.textContent = "";
        if (blurb) blurb.textContent = "";
        lastFocusRef.current = -1;
        return;
      }
      const tile = tiles[i];
      const focusChanged = lastFocusRef.current !== i && lastFocusRef.current >= 0;
      lastFocusRef.current = i;
      // Soften the swap: the text updates immediately (the live region must
      // announce the new card) but the block dips and eases back to full,
      // so the panel reads as gliding to the next card, not flickering.
      // Reduced motion skips the dip (globals also collapse transitions).
      if (focusChanged && !prefersReducedMotion) {
        for (const el of [arcIndexSwapRef.current, arcIndexBlurbRef.current]) {
          if (!el) continue;
          el.style.transition = "none";
          el.style.opacity = "0.35";
          requestAnimationFrame(() => {
            el.style.transition = "opacity 240ms ease";
            el.style.opacity = "1";
          });
        }
      }
      num.textContent = String(i + 1).padStart(2, "0");
      title.textContent = tile?.title ?? "";
      if (blurb) blurb.textContent = tile?.blurb ?? "";
      if (kind) {
        kind.textContent =
          tile?.kind === "work"
            ? siteContent.home.panelKindCaseStudy
            : siteContent.home.panelKindPhoto;
      }
      if (status) {
        const isExplored = !!tile && exploredRef.current.has(tile.key);
        status.textContent = isExplored
          ? siteContent.home.panelExplored
          : siteContent.home.panelUnexplored;
      }
    },
    [prefersReducedMotion],
  );

  // Keep the panel's explored/unexplored label live: if the explored set
  // changes while the panel is showing a focused card (the user just closed
  // a modal on that same card), re-stamp the status without waiting for the
  // next rotation snap. lastFocusRef.current is -1 when nothing is focused
  // (hero state or reset), so this is a no-op then.
  useEffect(() => {
    if (lastFocusRef.current >= 0) writeActiveCard(lastFocusRef.current);
  }, [explored, writeActiveCard]);

  const radius = isMobile ? RING_RADIUS_VMIN_MOBILE : RING_RADIUS_VMIN;
  const tileWidth = isMobile ? TILE_WIDTH_VMIN_MOBILE : TILE_WIDTH_VMIN;
  const tileHeight = tileWidth * (4 / 3); // 3:4 aspect

  // Seat = final position on the ring. Full tangent rotation: each tile's
  // local up-vector aligns with the radial vector from the center. Upside-
  // down tiles at the bottom are deliberate; see docs/design.md
  // "Home-ring tile orientation (tangent-aligned, deliberately)".
  const seats = useMemo(() => {
    return tiles.map((_, i) => {
      const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
      const tangentDeg = (angle * 180) / Math.PI + 90;
      return {
        xVmin: Math.cos(angle) * radius,
        yVmin: Math.sin(angle) * radius,
        rotate: tangentDeg,
      };
    });
  }, [tiles, total, radius]);

  // Live per-card collapse offsets, one per tile, identity until the scroll
  // layer drives them. Kept in a ref (not state) so the scroll layer can write
  // it every frame without re-rendering; the flight geometry reads it on click.
  const collapseRef = useRef<CardCollapse[]>([]);
  if (collapseRef.current.length !== total) {
    collapseRef.current = Array.from({ length: total }, () => ({ ...IDENTITY_COLLAPSE }));
  }

  // Outer wrapper element per tile (the seat-centering div), owned by the
  // scroll layer for the collapse transform. Collected here so GSAP can target
  // them; Framer keeps the inner seat/lean/flip layers untouched.
  const collapseElsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Move DOM focus onto a card's button after an arrow-key carousel step, so
  // Enter/Space open the card the carousel visually focuses. preventScroll:
  // the pin owns the scroll position and a focus scroll would fight it.
  const focusCardButton = useCallback((i: number) => {
    const button = collapseElsRef.current[i]?.querySelector("button");
    button?.focus({ preventScroll: true });
  }, []);

  // Originating tile button for the open modal; focused again when the
  // modal fully closes so keyboard users do not lose their place.
  const sourceButtonRef = useRef<HTMLButtonElement | null>(null);
  // Restore focus on modal close only when the tile was opened via keyboard.
  // For pointer/touch taps we skip it, which is what prevents the focus ring
  // (and, before, the back-face flip) from appearing on a tapped card.
  const restoreFocusOnCloseRef = useRef(false);

  const restoreSourceFocus = () => {
    const button = sourceButtonRef.current;
    const shouldRestore = restoreFocusOnCloseRef.current;
    sourceButtonRef.current = null;
    restoreFocusOnCloseRef.current = false;
    if (!button || !shouldRestore) return;
    // Next frame: the ring tile stays visibility:hidden until the
    // flight-clear render paints, and a hidden button refuses focus.
    requestAnimationFrame(() => {
      if (button.isConnected) button.focus({ preventScroll: true });
    });
  };

  // Click on a ring tile: capture its intrinsic rect (from seat geometry,
  // NOT getBoundingClientRect which returns the axis-aligned bbox of the
  // rotated tile and would distort the flown shape), its tangent Z rotation,
  // and the live transform the user is actually seeing. Start the modal
  // mount and the flight on the same frame. Activation (pointer and
  // keyboard both land here) is gated on the entrance being complete;
  // mid-entrance clicks would spawn the clone at an empty seat.
  const handleTileClick = (
    payload: TileActivatePayload,
    tileIndex: number,
    capture: TileCapture,
    homeTile: HomeTileEntry,
  ) => {
    if (phase !== "ready") return;
    if (flight) return; // already flying
    // Mid-transition and faded arc cards are not activation targets. This is
    // the effective pointer gate: wrapper-level pointer-events cannot block
    // the inner tile layer (its pointer-events-auto punches back through).
    const p = carouselPRef.current;
    if (p > CLICK_GATE_LOW_P && p < CLICK_GATE_HIGH_P) return;
    if ((cardOpacityRef.current[tileIndex] ?? 1) < CAROUSEL.HIT_OPACITY_MIN) return;

    sourceButtonRef.current = capture.button;
    restoreFocusOnCloseRef.current = capture.wasKeyboard;

    const c = collapseRef.current[tileIndex] ?? IDENTITY_COLLAPSE;
    const home = computeHomeRect(tileIndex);
    // Collapse rotations join the seat tangent and resting tilt so the flight's
    // start frame and its closing target both sit at the card's collapsed
    // orientation. Identity offsets leave these at the original ring values.
    const homeTangentDeg = seats[tileIndex].rotate + c.rotZ;

    setFlight({
      tile: homeTile,
      tileIndex,
      homeRect: home,
      homeTangentDeg,
      homeRestRotX: tileBaselineRotX(tileIndex) + c.rotX,
      homeRestRotY: tileBaselineRotY(tileIndex) + c.rotY,
      source: computeFlightSource(tileIndex, home, capture),
      // Initial target is the home rect itself; FlyingTile's own slot-
      // tracking effect reads the real modal slot rect once mounted and
      // animates toward it, so the flight has a real destination.
      target: home,
      phase: "out",
      // Starts frosted (matches the deck tile it left); a photo reveals to true
      // color once it lands in the slot (handleFlyOutComplete).
      reveal: false,
    });

    if (payload.kind === "photo") setSelectedPhoto(payload.photo);
    else setSelectedWork(payload.workItem);
  };

  // Computes the intrinsic (unrotated) rect of a ring tile at its seat
  // position in viewport pixels. Used for both the flight's initial state
  // and its closing target so the flown tile aligns exactly with the ring
  // tile; no geometry mismatch when the DOM handoff happens.
  const computeHomeRect = (tileIndex: number): FlightTarget => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const vmin = Math.min(vw, vh);
    // Collapse offset composes on the seat: the outer wrapper is translated by
    // (dx, dy), scaled, and rotated about the viewport center. Identity leaves
    // the rect exactly at the ring seat. Parallax is parked while collapsed, so
    // this flat composition matches the on-screen card.
    const c = collapseRef.current[tileIndex] ?? IDENTITY_COLLAPSE;
    const seatX = (seats[tileIndex].xVmin / 100) * vmin;
    const seatY = (seats[tileIndex].yVmin / 100) * vmin;
    const rz = (c.rotZ * Math.PI) / 180;
    const rotatedX = Math.cos(rz) * seatX - Math.sin(rz) * seatY;
    const rotatedY = Math.sin(rz) * seatX + Math.cos(rz) * seatY;
    // The card center sits at depth c.tz; the stage perspective foreshortens
    // its on-screen offset and size. kTz is 1 when tz is 0 (the ring state).
    const kTz = RING_PERSPECTIVE_PX / (RING_PERSPECTIVE_PX - c.tz);
    const planeX = c.dx + c.scale * rotatedX;
    const planeY = c.dy + c.scale * rotatedY;
    const widthPx = (tileWidth / 100) * vmin * c.scale * kTz;
    const heightPx = (tileHeight / 100) * vmin * c.scale * kTz;
    // Once the pin releases and the section scrolls toward Work, the seat
    // frame rides up with it; the section's live top re-anchors the projection
    // so post-release clicks still land. 0 while pinned or at the hero.
    const offY = sectionRef.current?.getBoundingClientRect().top ?? 0;
    const cx = vw / 2 + planeX * kTz;
    const cy = vh / 2 + planeY * kTz + offY;
    return {
      left: cx - widthPx / 2,
      top: cy - heightPx / 2,
      width: widthPx,
      height: heightPx,
    };
  };

  // Latest computeHomeRect, re-captured every render so the modal-open
  // resize handler (whose effect deliberately depends only on modalOpen)
  // never calls a closure holding stale seat geometry after the viewport
  // crosses the mobile breakpoint.
  const computeHomeRectRef = useRef(computeHomeRect);
  useEffect(() => {
    computeHomeRectRef.current = computeHomeRect;
  });

  // Projects the clicked tile's live transform stack (proximity lean and
  // flip springs, ring parallax with stage perspective) into the flat fixed
  // coordinate space FlyingTile animates in, so the clone's first frame
  // matches the tile the user sees instead of the untilted seat.
  const computeFlightSource = (
    tileIndex: number,
    home: FlightTarget,
    capture: TileCapture,
  ): FlightSource => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const vmin = Math.min(vw, vh);
    const seat = seats[tileIndex];
    const c = collapseRef.current[tileIndex] ?? IDENTITY_COLLAPSE;

    // The lean translation is applied inside the seat-rotated frame; rotate
    // it back into ring-plane coordinates before projecting.
    const theta = (seat.rotate * Math.PI) / 180;
    const planeX0 =
      (seat.xVmin / 100) * vmin +
      capture.leanX * Math.cos(theta) -
      capture.leanY * Math.sin(theta);
    const planeY0 =
      (seat.yVmin / 100) * vmin +
      capture.leanX * Math.sin(theta) +
      capture.leanY * Math.cos(theta);

    // Compose the collapse offset (translate, scale, rotate) in the ring plane,
    // matching the outer wrapper's DOM transform. Identity leaves planeX0/Y0
    // untouched, so the ring-state flight is byte-for-byte the original.
    const cz = (c.rotZ * Math.PI) / 180;
    const planeX = c.dx + c.scale * (Math.cos(cz) * planeX0 - Math.sin(cz) * planeY0);
    const planeY = c.dy + c.scale * (Math.sin(cz) * planeX0 + Math.cos(cz) * planeY0);

    const rotXDeg = -smoothY.get() * PARALLAX_MAX_TILT_DEG;
    const rotYDeg = smoothX.get() * PARALLAX_MAX_TILT_DEG;
    const rotZDeg = smoothX.get() * PARALLAX_MAX_ZROT_DEG;
    const alpha = (rotXDeg * Math.PI) / 180;
    const beta = (rotYDeg * Math.PI) / 180;
    const gamma = (rotZDeg * Math.PI) / 180;

    // CSS applies rotateX(a) rotateY(b) rotateZ(c) to a point as Rx*Ry*Rz*p;
    // the stage perspective then projects it from the viewport center.
    const x1 = planeX * Math.cos(gamma) - planeY * Math.sin(gamma);
    const y1 = planeX * Math.sin(gamma) + planeY * Math.cos(gamma);
    const x2 = x1 * Math.cos(beta);
    const z2 = -x1 * Math.sin(beta);
    const y2 = y1 * Math.cos(alpha) - z2 * Math.sin(alpha);
    const z3 = y1 * Math.sin(alpha) + z2 * Math.cos(alpha);
    const k = RING_PERSPECTIVE_PX / (RING_PERSPECTIVE_PX - z3);
    // Additional foreshortening from the card's own collapse depth (c.tz). It
    // is 1 in the ring state (tz 0); home.width already carries it for size, so
    // it only scales the on-screen offset here.
    const kTz = RING_PERSPECTIVE_PX / (RING_PERSPECTIVE_PX - c.tz);

    const width = home.width * capture.leanScale * k;
    const height = home.height * capture.leanScale * k;
    // Same post-release re-anchor as computeHomeRect: the section's live top
    // shifts the projection once the pin has released and scrolled.
    const offY = sectionRef.current?.getBoundingClientRect().top ?? 0;
    return {
      rect: {
        left: vw / 2 + x2 * k * kTz - width / 2,
        top: vh / 2 + y2 * k * kTz + offY - height / 2,
        width,
        height,
      },
      rotX: rotXDeg + capture.rotX + c.rotX,
      rotY: rotYDeg + capture.rotY + c.rotY,
      // c.rotZ is folded into homeTangentDeg (the flight's rotation base), not
      // here, so the closing target and the source share one rotation origin.
      rotZDelta: rotZDeg + capture.leanRot,
    };
  };

  // Fly-out animation completed with the tile sitting in the modal's slot. A
  // photo now clears its frost to true color (work stays tinted glass). The ring
  // stays live and static behind the translucent modal the whole time.
  const handleFlyOutComplete = () => {
    setFlight((prev) =>
      prev && prev.tile.kind === "photo" ? { ...prev, reveal: true } : prev,
    );
  };

  // Start the closing flight back to the carousel/ring. One unconditional
  // path: recompute the home slot from the LIVE collapseRef (rotation is
  // frozen while the modal is open, but a mid-modal resize moves the slot),
  // so the closing tile lands exactly where the ring tile reappears. In the
  // hero state the collapse is identity and this matches the values captured
  // at click time byte for byte.
  const beginClosing = (tileIndex: number) => {
    const c = collapseRef.current[tileIndex] ?? IDENTITY_COLLAPSE;
    const homeRect = computeHomeRect(tileIndex);
    setFlight((prev) =>
      prev
        ? {
            ...prev,
            homeRect,
            homeTangentDeg: seats[tileIndex].rotate + c.rotZ,
            homeRestRotX: tileBaselineRotX(tileIndex) + c.rotX,
            homeRestRotY: tileBaselineRotY(tileIndex) + c.rotY,
            phase: "closing",
          }
        : prev,
    );
  };

  // Modal close: exit the modal (its own exit variant runs) and DISSOLVE the
  // flown card in place rather than flying it back across the deck (that clipped
  // through the translucent cards). beginClosing resolves where the deck tile
  // should rest from the live cursor and reveals it at its slot; the flown clone
  // then fades + eases a touch toward that slot and is gone.
  const handleModalClose = () => {
    setSelectedPhoto(null);
    setSelectedWork(null);
    setModalFromCarousel(false);
    if (!flight) {
      // Mobile carousel path (or any no-flight open): nothing flew, so just
      // restore focus. The carousel overlay, if it was the opener, is still
      // mounted underneath and takes over again.
      restoreSourceFocus();
      return;
    }
    // Mark the ring tile explored now, at close, not at open: the ring tile is
    // already visible underneath the flying clone during "closing" (it is
    // only hidden during the "out" phase), so this frosts it in over ~700ms
    // starting the instant the modal dismisses, right as the user watches it.
    const closedTile = flight.tile;
    setExplored((prev) => {
      if (prev.has(closedTile.key)) return prev;
      const next = new Set(prev);
      next.add(closedTile.key);
      return next;
    });
    // The parallax springs have been targeting 0 since the flight started;
    // jump clears any sub-pixel residue so the revealed deck tile sits flat.
    parallaxX.jump(0);
    parallaxY.jump(0);
    beginClosing(flight.tileIndex);
  };

  // Dissolve finished: the flown clone has faded out and the deck tile is
  // already showing in its slot. Clear the flight state (unmounts the clone) and
  // hand focus back to the originating tile button.
  const handleClosingComplete = () => {
    setFlight(null);
    restoreSourceFocus();
  };

  // ---- Mobile coverflow callback --------------------------------------------
  // Tap a card: open its modal. No flight on mobile, so the modal renders its
  // own image (modalFromCarousel). MobileHome stays mounted underneath and
  // resumes its layout when the modal closes.
  const handleCarouselOpen = useCallback((payload: CarouselOpenPayload) => {
    setModalFromCarousel(true);
    if (payload.kind === "photo") setSelectedPhoto(payload.photo);
    else setSelectedWork(payload.workItem);
  }, []);

  // The modal's [data-tile-slot] rect is tracked inside FlyingTile itself
  // (its slot-tracking effect), so the per-frame rect updates during the
  // modal's entrance tween re-render only the clone, never this component's
  // 20-tile ring. TileRing keeps only the resize concern: a mid-modal resize
  // moves the ring seat, so re-compute the home rect so closing still lands
  // correctly. Read computeHomeRect through the ref: this effect only depends
  // on modalOpen, so a direct call would freeze the seat geometry captured at
  // open time.
  const modalOpen = selectedPhoto !== null || selectedWork !== null;
  // Layout effect, not passive: same freeze-before-paint reasoning as
  // flightActiveRef above, so a tick between the state commit and the effect
  // cannot shift the ring after the modal's FLIP geometry is captured.
  useIsoLayoutEffect(() => {
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);
  useEffect(() => {
    if (!modalOpen) return;
    if (!flight || flight.phase !== "out") return;
    const onResize = () => {
      setFlight((prev) =>
        prev ? { ...prev, homeRect: computeHomeRectRef.current(prev.tileIndex) } : prev,
      );
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
    // Intentionally don't depend on `flight` so we don't re-arm on every flight
    // state update; only on modal open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // Desktop ring-arc carousel driver, free-scroll scrub model. The hero pin's
  // native scroll progress is the transition's input: a gsap.ticker loop
  // eases the rendered clock toward the scroll-derived target (SCRUB_TAU), so
  // the spin-and-slide always plays completely, just faster under a faster
  // scroll. Scroll is never blocked or driven; a light interruptible
  // ScrollTrigger snap settles a stopped scroll onto the hero or the carousel
  // dwell. The ONLY wheel interception is infinite rotation over the cards
  // while settled at the dwell. GSAP owns each tile's outer-wrapper transform
  // and the matching collapseRef value every frame; Framer keeps the inner
  // seat/lean/flip layers. Gated on the entrance being ready so it never
  // races the fan-out. Geometry: lib/carouselGeometry (validated in
  // docs/plans/ring-arc-geometry-note.md).
  useGSAP(
    () => {
      if (!scrollReady) return;
      const heroPin = document.getElementById("hero-pin");
      if (!heroPin) return;

      const readViewport = (): Viewport => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return { vw, vh, vmin: Math.min(vw, vh) };
      };

      // True once any non-hero frame has written wrapper styles, so the hero
      // frame that follows clears them exactly once and then leaves Framer
      // alone (parallax/proximity own the pure ring again).
      let collapseActive = false;

      // Visible-card vertical extent in stage coordinates, cached by
      // renderFrame for the reach gates (docs/carousel-visible-engagement-
      // spec.md). Stage coordinates equal viewport coordinates while
      // pinned; sectionOffY() re-anchors them once the pin releases.
      let spanCache: { top: number; bottom: number } | null = null;

      // Render every card, the hero copy fade, and the caption fade for a
      // transition progress p (0 hero, 1 settled arc) and carousel rotation
      // (float, card units). Writes the wrapper transform, the matching
      // collapseRef entry, opacity, and visibility per card; opacity/z-order
      // are not part of CardCollapse (depth order comes from tz under the
      // stage's preserve-3d, the deck-era precedent, so no z-index writes).
      // rasterHold multiplies ONLY the written wrapper scale (never
      // collapseRef, which stays canonical for the flight math); the settled
      // idle loop drives it a hair off 1 every frame so the GPU compositor
      // never classifies the parked carousel as animation-idle. Chromium
      // stretches a slightly stale raster while a layer's scale is being
      // driven and runs ONE exact-scale re-raster when it stops; that
      // settle re-raster is the "card pops a couple px into its real size"
      // artifact on GPU/DPR-2 hardware (invisible in software rendering,
      // continuous in the transform matrices, unaffected by will-change).
      const renderFrame = (p: number, rotation: number, rasterHold = 1) => {
        carouselPRef.current = p;
        if (p <= 0) {
          if (collapseActive) {
            collapseActive = false;
            resetCollapse();
          }
          setEngaged(false);
          return;
        }
        if (!collapseActive) {
          // will-change while the carousel is engaged (cleared by
          // resetCollapse at the hero): keeps each wrapper's GPU raster
          // policy stable across the moving-to-resting transition. Without
          // it, the compositor re-rasters and re-snaps antialiasing the
          // frame a card's transform stops animating, which reads as the
          // arriving card visibly "clicking" into a different display state
          // on DPR 2 hardware (invisible in software rendering and in the
          // transform matrices, which are continuous). Scoped here, not
          // permanent, honoring the old perf rule against always-on
          // will-change across the hero ring. (Extending the pin to the
          // inner seat/lean/button layers was tried 2026-07-03 and verified
          // applied live, but did not change the arrival pop; reverted.)
          for (let i = 0; i < total; i++) {
            const el = collapseElsRef.current[i];
            if (el) el.style.willChange = "transform";
          }
        }
        collapseActive = true;
        setEngaged(p > ENGAGE_MIN_P);
        const vp = readViewport();
        let spanTop = Infinity;
        let spanBottom = -Infinity;
        for (let i = 0; i < total; i++) {
          const seat: SeatPx = {
            seatX: (seats[i].xVmin / 100) * vp.vmin,
            seatY: (seats[i].yVmin / 100) * vp.vmin,
            rotateDeg: seats[i].rotate,
          };
          const state = cardState(wrap(i, rotation), p, vp);
          const { c, cxCard, cyCard } = toCollapse(state, seat, vp);
          const live = collapseRef.current[i];
          if (live) {
            live.dx = c.dx;
            live.dy = c.dy;
            live.scale = c.scale;
            live.rotZ = c.rotZ;
            live.rotX = c.rotX;
            live.rotY = 0;
            live.tz = c.tz;
          }
          const opacity = clamp01(state.opacity);
          cardOpacityRef.current[i] = opacity;
          if (opacity >= CARD_HIDE_OPACITY) {
            const sp = cardSpan(state, vp);
            if (sp.top < spanTop) spanTop = sp.top;
            if (sp.bottom > spanBottom) spanBottom = sp.bottom;
          }
          const el = collapseElsRef.current[i];
          if (el) {
            // DOM transform in the NATIVE frame: the wrapper carries the whole
            // down-scale (scale * REST_SCALE, always <= ~0.93) so its raster
            // never magnifies, and the trailing seat translate matches the
            // Framer layer's native-unit seat. Net screen geometry is byte-
            // identical to the display-frame composition (REST_SCALE and
            // TILE_NATIVE_SCALE cancel), so collapseRef stays display-space.
            el.style.transform = collapseTransform(
              cxCard,
              cyCard,
              { ...c, scale: c.scale * REST_SCALE * rasterHold },
              {
                seatX: seat.seatX * TILE_NATIVE_SCALE,
                seatY: seat.seatY * TILE_NATIVE_SCALE,
                rotateDeg: seat.rotateDeg,
              },
            );
            el.style.opacity = String(opacity);
            // Fully faded cards go visibility:hidden so they can neither paint
            // nor catch pointer events (they sit far off-viewport regardless).
            el.style.visibility = opacity < CARD_HIDE_OPACITY ? "hidden" : "";
          }
        }
        spanCache =
          spanTop === Infinity ? null : { top: spanTop, bottom: spanBottom };
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = String(clamp01(1 - p * HERO_FADE_RATE));
          heroContentRef.current.style.pointerEvents = p > ENGAGE_MIN_P ? "none" : "";
        }
        if (deckHintRef.current) {
          // Plan §3 / prototype layout(): panelT = clamp01((p - 0.6) / 0.35),
          // opacity follows it directly and the panel slides in from
          // translateX(-20px) at panelT=0 to translateX(0) at panelT=1. No
          // extra ease here: the clock feeding p is already eased upstream.
          const panelT = clamp01((p - PANEL_FADE_START_P) / PANEL_FADE_SPAN_P);
          deckHintRef.current.style.opacity = String(panelT);
          deckHintRef.current.style.transform = `translateY(-50%) translateX(${(1 - panelT) * -PANEL_SLIDE_PX}px)`;
        }
      };

      const resetCollapse = () => {
        for (let i = 0; i < total; i++) {
          const c = collapseRef.current[i];
          if (c) {
            c.dx = 0;
            c.dy = 0;
            c.scale = 1;
            c.rotZ = 0;
            c.rotX = 0;
            c.rotY = 0;
            c.tz = 0;
          }
          const el = collapseElsRef.current[i];
          if (el) {
            el.style.willChange = "";
            // Rest is the static native-frame down-scale, not a cleared
            // transform: the Framer layer runs in native units at all times.
            el.style.transform = REST_WRAPPER_TRANSFORM;
            el.style.transition = "";
            el.style.zIndex = "";
            el.style.opacity = "";
            el.style.visibility = "";
          }
          cardOpacityRef.current[i] = 1;
        }
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = "";
          heroContentRef.current.style.pointerEvents = "";
          heroContentRef.current.style.transition = "";
        }
        if (deckHintRef.current) {
          deckHintRef.current.style.opacity = "";
          deckHintRef.current.style.transform = "";
        }
        // Clear the panel so nothing stale survives a reform/refresh.
        writeActiveCard(null);
        spanCache = null;
      };

      const setEngaged = (v: boolean) => {
        if (engagedRef.current === v) return;
        engagedRef.current = v;
        setCollapseEngaged(v);
      };

      const mm = gsap.matchMedia();

      // Desktop: free-scroll scrub. The pin's progress maps to the transition
      // target (p_target = progress / ARRIVE_PORTION, clamped); the ticker
      // eases the rendered clock.p toward it. Wheel over the cards rotates the
      // infinite carousel ONLY while settled at the dwell; every other input
      // is plain native scrolling.
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        // clock.p is the RENDERED transition progress (0 hero, 1 settled arc),
        // chasing the scroll-derived target; clock.rotation is the carousel
        // rotation in card units (mutated only while settled).
        const clock = { p: 0, rotation: 0 };
        let inited = false;
        // Rotation state (see the constant block for the evidence trail).
        // Wheel: scrubTarget is the continuous position target the chase
        // spring pulls rotation toward; null means the scrub is at rest.
        // Keyboard/auto-advance: one power2.inOut tween at a time moves
        // rotation integer-to-integer, with a bounded queue. gsap.ticker
        // updates tweens before our update listener runs each tick, so every
        // tween frame renders in the same tick it was computed.
        let rotTween: gsap.core.Tween | null = null;
        let tweenTarget: number | null = null; // integer the active step lands on
        let pendingSteps = 0;                  // queued steps beyond the active tween
        let stepDir: 1 | -1 = 1;               // direction of the active/queued steps
        let scrubTarget: number | null = null; // continuous wheel position target
        let chaseV = 0;                        // chase spring velocity, cards/s
        let renderedV = 0;                     // measured rotation velocity (tween handoff seed)
        let prevRenderedRot: number | null = null;
        let lastWheelMs = 0;
        let tweenPausedForModal = false;
        let lastInteract = performance.now();
        let dirty = true;
        let lastFocus = -1;
        let lastAttr = "";
        // Rotation normalization (hard invariant: at p = 0 every card is at
        // its OWN seat, rotation congruent to 0 mod total, or parallax,
        // proximity, and the entrance break). A scrubbed reverse can stop
        // anywhere, so a tween is not reliable; instead the render blends the
        // browsed rotation toward the nearest ring home as a pure function of
        // p (rotBlend below), captured once when the scrub leaves the dwell
        // and committed back to the clock when it re-settles.
        let rotBlendActive = false;
        let browsedRotation = 0;
        let ringHome = 0;
        let wasAtDwell = false;
        let st: ScrollTrigger | null = null;

        const markDirty = () => {
          dirty = true;
        };
        const isSettled = () => clock.p > SETTLED_MIN_P;
        const focusedIndex = () => ((Math.round(clock.rotation) % total) + total) % total;
        // True when the scroll-derived target has fully arrived (the settled
        // dwell); wheel rotation, arrow steps, and auto-advance gate on it so
        // none of them fire while the user is scrubbing the transition.
        const atDwell = () => !!st && st.progress >= ARRIVE_PORTION;

        // Reach model (docs/carousel-visible-engagement-spec.md): the
        // carousel is interactive while ANY card is on screen, not while
        // the pin is engaged. sectionOffY is the section's post-release
        // upward travel (0 while pinned), the same re-anchor
        // computeHomeRect makes with getBoundingClientRect, derived here
        // from ScrollTrigger's own measurements so the ticker never forces
        // layout. Replaces st.isActive at the wheel handler, the wheel
        // chase, auto-advance, and the rasterHold park; NOT at onKey
        // (arrows stay pin-gated so they scroll the page naturally once
        // the section is leaving).
        const sectionOffY = () => (st ? Math.min(0, st.end - window.scrollY) : 0);
        const carouselReach = () =>
          isSettled() &&
          atDwell() &&
          spanCache !== null &&
          spanCache.bottom + sectionOffY() > 0;

        // Blend weight for the rotation normalization: 0 at p <= ROT_BLEND_
        // START_P (identity ring), 1 at p >= ROT_BLEND_END_P (the browsed
        // rotation). Deterministic in p, so stopping and reversing anywhere
        // mid-scrub replays it exactly.
        const rotBlend = (p: number) =>
          easeInOutCubic(
            clamp01((p - ROT_BLEND_START_P) / (ROT_BLEND_END_P - ROT_BLEND_START_P)),
          );

        // One card step: tween clock.rotation to the adjacent integer with
        // zero velocity at both ends. Chained steps (a drained queue) run at
        // the faster catch-up duration so rapid input feels responsive while
        // every intermediate card is still visibly traversed.
        const beginStep = (duration: number) => {
          // Next integer in the travel direction; correct from an exact
          // integer (rest, chained steps) AND from a fractional rotation
          // (a keyboard takeover mid-scrub).
          const from = clock.rotation;
          const to =
            stepDir > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
          tweenTarget = to;
          rotTween = gsap.to(clock, {
            rotation: to,
            duration,
            ease: "power2.inOut",
            onUpdate: markDirty,
            onComplete: () => {
              rotTween = null;
              tweenTarget = null;
              clock.rotation = to;
              markDirty();
              if (pendingSteps > 0) {
                pendingSteps--;
                beginStep(STEP_CATCHUP_S);
              }
            },
          });
        };

        // Discrete inputs (arrow key, auto-advance) funnel through here and
        // become exactly one queued card step.
        const requestStep = (dir: 1 | -1, duration: number) => {
          lastInteract = performance.now();
          // A discrete step claims the rotation from an active wheel scrub;
          // the tween starts from the current fractional rotation, so the
          // takeover is positionally continuous.
          if (scrubTarget !== null) {
            scrubTarget = null;
            chaseV = 0;
          }
          if (rotTween) {
            if (dir === stepDir) {
              pendingSteps = Math.min(STEP_QUEUE_MAX, pendingSteps + 1);
            } else {
              // Direction reversal mid-step: drop the queue, let the active
              // step land on its integer, then play one step back. Rotation
              // itself never reverses mid-flight, so motion stays continuous.
              pendingSteps = 1;
              stepDir = dir;
            }
            return;
          }
          stepDir = dir;
          beginStep(duration);
        };

        st = ScrollTrigger.create({
          trigger: heroPin,
          start: "top top",
          end: `+=${PIN_SPACER_PERCENT}%`,
          pin: heroPin,
          pinType: "fixed",
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: markDirty,
          // Light, interruptible settle for a stopped scroll: back onto the
          // hero, onto the carousel dwell, or (past SNAP_FREE_MIN_PROGRESS)
          // nowhere, free into Work. This is the ONLY scroll driving left.
          snap: {
            snapTo: (v) =>
              v < SNAP_HERO_MAX_PROGRESS
                ? 0
                : v < SNAP_FREE_MIN_PROGRESS
                  ? DWELL_SNAP_PROGRESS
                  : v,
            duration: SNAP_SCROLL_SECONDS,
            ease: "power2.inOut",
            delay: SNAP_SCROLL_DELAY_S,
          },
        });

        // The only input interception in the model: wheel over the cards
        // rotates the settled carousel wherever its cards are still on
        // screen, including past the pin release. Every other condition
        // returns WITHOUT preventDefault so native scroll flows (scrubbing
        // the transition or moving the page).
        const onWheel = (e: WheelEvent) => {
          if (modalOpenRef.current || flightActiveRef.current) return;
          if (!carouselReach()) return;
          if (e.clientX <= window.innerWidth * CAROUSEL.WHEEL_ZONE_X_FRAC) return;
          const span = spanCache;
          const offY = sectionOffY();
          if (!span || e.clientY < span.top + offY || e.clientY > span.bottom + offY)
            return;
          e.preventDefault();
          let dy = e.deltaY;
          if (e.deltaMode === 1) dy *= WHEEL_LINE_DELTA_PX;
          const nowMs = performance.now();
          lastInteract = nowMs;
          lastWheelMs = nowMs;
          // Real-time scrub: wheel travel moves the position target 1:1 and
          // the closed-form chase in the update loop carries rotation there.
          // Wheel deltas NEVER touch rotation or velocity directly (the
          // prototype-era `rotation += step` teleported the arc a third of a
          // card per mouse notch in one frame, and the velocity-impulse
          // rework let a fast flick sail past the intended card). The hand
          // always wins: a wheel event kills an active keyboard/auto step
          // and seeds the chase with the measured rotation velocity so the
          // takeover is velocity-continuous.
          if (rotTween) {
            rotTween.kill();
            rotTween = null;
            tweenTarget = null;
            tweenPausedForModal = false;
            pendingSteps = 0;
            scrubTarget = clock.rotation;
            chaseV = renderedV;
          }
          if (scrubTarget === null) {
            scrubTarget = clock.rotation;
            chaseV = renderedV;
          }
          scrubTarget += dy / CAROUSEL.WHEEL_PX_PER_CARD;
          markDirty();
        };
        window.addEventListener("wheel", onWheel, { passive: false });

        // Arrow keys step the settled carousel one card; Esc stays with the
        // modals' own handlers. Outside the settled dwell the keys are left
        // alone, so they scroll natively, which scrubs with visible feedback.
        // DOM focus follows the step so Enter/Space activate the card the
        // carousel visually focuses.
        const onKey = (e: KeyboardEvent) => {
          if (modalOpenRef.current || flightActiveRef.current) return;
          if (!st || !st.isActive || !isSettled() || !atDwell()) return;
          let dir: 1 | -1;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            dir = 1;
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            dir = -1;
          } else {
            return;
          }
          e.preventDefault();
          requestStep(dir, STEP_KEY_S);
          // Focus the card the queued input will finally land on, so
          // Enter/Space always activate what the carousel visually settles
          // onto even when steps are still draining.
          const landing =
            (tweenTarget ?? Math.round(clock.rotation)) + pendingSteps * stepDir;
          focusCardButton(((landing % total) + total) % total);
        };
        window.addEventListener("keydown", onKey);

        // One loop owns the scrub chase, rotation normalization, the modal
        // step freeze, auto-advance, rendering, the focus seam
        // (writeActiveCard), and the section-7 waveform contract
        // (rAF-throttled by construction: the ticker runs once per frame).
        // deltaMs comes from gsap.ticker. Rotation itself is moved by the
        // step tweens (beginStep), never inside this loop.
        const update = (_time: number, deltaMs: number) => {
          const now = performance.now();
          // A modal/flight freezes the idle clock so auto-advance never fires
          // the instant a modal closes; the visitor gets the full idle window.
          if (modalOpenRef.current || flightActiveRef.current) lastInteract = now;
          if (!st) return;
          // Floor sub-pixel progress residue to a hard 0: ScrollTrigger can
          // report a ~1e-6 progress at the parked scroll top, and the chase
          // converges ON the target, so without this p never reaches exactly
          // 0 and the p = 0 frame (resetCollapse, the identity-ring handoff
          // to Framer) never runs.
          const rawTarget = clamp01(st.progress / ARRIVE_PORTION);
          const target = rawTarget < 1e-4 ? 0 : rawTarget;
          if (!inited) {
            // First frame renders AT the target: a deep reload lands past the
            // pin already settled, with no eased catch-up flash. Eases from
            // here on.
            inited = true;
            clock.p = target;
            wasAtDwell = target >= 1;
            dirty = true;
          } else if (clock.p !== target) {
            // Frame-rate-independent chase (dt capped so a backgrounded tab
            // resuming does not integrate one giant step badly).
            const dt = Math.min(deltaMs / 1000, 0.1);
            const next = clock.p + (target - clock.p) * (1 - Math.exp(-dt / SCRUB_TAU));
            clock.p = Math.abs(target - next) < 1e-3 ? target : next;
            dirty = true;
          }

          // Rotation normalization bookkeeping. Leaving the dwell downward
          // captures the browsed rotation and its nearest ring home (multiple
          // of total); any in-flight rotation tween is killed so the blend
          // inputs hold still for the whole scrub.
          const dwellNow = target >= 1;
          if (wasAtDwell !== dwellNow) {
            // Crossing the dwell boundary in either direction restarts the
            // idle window, so auto-advance never fires the instant the user
            // scrubs back onto the settled carousel.
            lastInteract = now;
          }
          if (wasAtDwell && !dwellNow) {
            rotTween?.kill();
            rotTween = null;
            tweenTarget = null;
            tweenPausedForModal = false;
            pendingSteps = 0;
            scrubTarget = null;
            chaseV = 0;
            browsedRotation = Math.round(clock.rotation);
            ringHome = Math.round(browsedRotation / total) * total;
            clock.rotation = browsedRotation;
            rotBlendActive = browsedRotation !== ringHome;
            lastFocus = -1;
            dirty = true;
          }
          wasAtDwell = dwellNow;
          // Re-settled: commit the browsed rotation back to the clock. The
          // blend is already 1 at p >= ROT_BLEND_END_P, so this is seamless.
          if (rotBlendActive && dwellNow && clock.p >= ROT_BLEND_END_P) {
            clock.rotation = browsedRotation;
            rotBlendActive = false;
            dirty = true;
          }

          // Modal/flight freeze: pause an in-flight step so the flown card's
          // home slot holds still behind the modal, and resume it on close.
          // The queue is left intact; lastInteract is already pinned above
          // while a modal is open, so auto-advance stays quiet after close.
          if (modalOpenRef.current || flightActiveRef.current) {
            if (rotTween && !tweenPausedForModal) {
              tweenPausedForModal = true;
              rotTween.pause();
            }
          } else if (tweenPausedForModal) {
            tweenPausedForModal = false;
            rotTween?.resume();
          }
          // Wheel scrub chase: a closed-form critically damped spring pulls
          // rotation toward scrubTarget, exact for any frame duration (no
          // Euler overshoot under long frames) and always accelerating from
          // its CURRENT velocity (never injected). Once the wheel is quiet
          // the target rounds to the nearest card and the same spring eases
          // the residual home; at rest it pins the exact integer once (a
          // sub-pixel correction, proven imperceptible in the session logs)
          // and goes idle.
          if (
            scrubTarget !== null &&
            carouselReach() &&
            !rotBlendActive &&
            !modalOpenRef.current &&
            !flightActiveRef.current
          ) {
            if (
              now - lastWheelMs > WHEEL_SETTLE_IDLE_MS &&
              scrubTarget !== Math.round(scrubTarget)
            ) {
              scrubTarget = Math.round(scrubTarget);
            }
            const dt = Math.min(0.1, deltaMs / 1000);
            const A = clock.rotation - scrubTarget;
            const B = chaseV + CHASE_OMEGA * A;
            const decay = Math.exp(-CHASE_OMEGA * dt);
            const nextRot = scrubTarget + (A + B * dt) * decay;
            const nextV = (B - CHASE_OMEGA * (A + B * dt)) * decay;
            if (
              scrubTarget === Math.round(scrubTarget) &&
              Math.abs(nextRot - scrubTarget) < CHASE_REST_EPS_CARDS &&
              Math.abs(nextV) < CHASE_REST_EPS_V
            ) {
              clock.rotation = scrubTarget;
              scrubTarget = null;
              chaseV = 0;
            } else {
              clock.rotation = nextRot;
              chaseV = nextV;
            }
            markDirty();
          }
          // Auto-advance: only from full rest (no scrub, no active step,
          // empty queue) after the idle window. One single-step request.
          if (
            carouselReach() &&
            !rotBlendActive &&
            !modalOpenRef.current &&
            !flightActiveRef.current &&
            scrubTarget === null &&
            !rotTween &&
            pendingSteps === 0 &&
            now - lastInteract > CAROUSEL.AUTO_ADVANCE_MS
          ) {
            requestStep(1, STEP_AUTO_S);
          }
          // Raster hold: while parked at the settled dwell with nothing
          // moving, keep rendering every frame with a breathing scale
          // (0.04% max, ~0.18px on the focused card, ~2s period,
          // imperceptible) so the compositor keeps treating the card layers
          // as scale-animating and never runs the stop-of-motion exact-scale
          // re-raster (the residual arrival pop; see renderFrame's
          // rasterHold note). Gated off under modals/flight, where the
          // frozen frame must hold perfectly still for the flight bridge.
          let rasterHold = 1;
          const parkedAtRest =
            carouselReach() &&
            !rotBlendActive &&
            scrubTarget === null &&
            !rotTween &&
            !modalOpenRef.current &&
            !flightActiveRef.current;
          if (parkedAtRest) {
            rasterHold = 1 + 0.0004 * Math.sin(now / 318);
            dirty = true;
          }
          if (dirty) {
            dirty = false;
            const renderRotation = rotBlendActive
              ? ringHome + (browsedRotation - ringHome) * rotBlend(clock.p)
              : clock.rotation;
            renderFrame(clock.p, renderRotation, rasterHold);
          }
          // Derived purely from the rendered p (there is no transition tween
          // in the free-scroll model). Nothing in-app consumes data-carousel;
          // it is kept as an external observation seam (headless QA reads it).
          const attr =
            clock.p <= 0.001 ? "hero" : clock.p >= SETTLED_MIN_P ? "settled" : "transition";
          if (attr !== lastAttr) {
            lastAttr = attr;
            heroPin.setAttribute("data-carousel", attr);
          }
          // Focus seam for the left text panel (WS-B): the focused card index
          // is written imperatively on focus change. Gated on the PANEL fade
          // window rather than on settled: the container starts revealing at
          // PANEL_FADE_START_P, and waiting for p > 0.999 left the panel
          // visibly EMPTY ("/ 20", no number or title) until the scrub and
          // snap fully landed, seconds after the card was already in place.
          if (clock.p >= PANEL_FADE_START_P && !modalOpenRef.current) {
            const f = focusedIndex();
            if (f !== lastFocus) {
              lastFocus = f;
              writeActiveCard(f);
            }
          }

          // Measured rotation velocity, used to seed the chase when a wheel
          // event takes over from a mid-flight step tween. Clamped so the
          // discontinuous leave-dwell/re-settle rounding writes cannot seed
          // a garbage velocity.
          if (prevRenderedRot !== null && deltaMs > 0) {
            const rawV = (clock.rotation - prevRenderedRot) / (deltaMs / 1000);
            renderedV = Math.max(-8, Math.min(8, rawV));
          }
          prevRenderedRot = clock.rotation;
        };
        gsap.ticker.add(update);

        return () => {
          gsap.ticker.remove(update);
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("wheel", onWheel);
          rotTween?.kill();
          st?.kill();
          heroPin.removeAttribute("data-carousel");
          resetCollapse();
          setEngaged(false);
        };
      });

      // Mobile owns its own GSAP context, pin, and scrub inside MobileHome
      // (gated by matchMedia "(max-width: 767px)"), so this desktop useGSAP
      // never sets up any mobile scroll behavior. Nothing to do here on mobile.

      // Reduced motion: no pin, no forced transition, no auto-advance. The
      // settled arc renders statically (cross-faded in, rotation 0) and arrow
      // keys rotate it instantly with no tween. data-carousel-static is the
      // seam WS-D hangs the visible prev/next affordances on.
      mm.add("(min-width: 768px) and (prefers-reduced-motion: reduce)", () => {
        let rotation = 0;
        if (heroContentRef.current) {
          heroContentRef.current.style.transition = "opacity 0.5s ease";
        }
        for (let i = 0; i < total; i++) {
          const el = collapseElsRef.current[i];
          if (el) el.style.transition = "transform 0.5s ease";
        }
        renderFrame(1, rotation);
        setEngaged(true);
        heroPin.setAttribute("data-carousel", "settled");
        heroPin.setAttribute("data-carousel-static", "true");
        const writeFocus = () =>
          writeActiveCard(((Math.round(rotation) % total) + total) % total);
        writeFocus();
        const clearT = window.setTimeout(() => {
          for (let i = 0; i < total; i++) {
            const el = collapseElsRef.current[i];
            if (el) el.style.transition = "";
          }
          if (heroContentRef.current) heroContentRef.current.style.transition = "";
        }, 520);
        // Single step, +-1 card, instant (no tween: reduced motion). Shared by
        // the arrow-key handler below and the visible prev/next buttons
        // (staticStepRef), so there is exactly one place that advances
        // `rotation` in this branch.
        const step = (dir: 1 | -1) => {
          if (modalOpenRef.current || flightActiveRef.current) return;
          rotation += dir;
          renderFrame(1, rotation);
          writeFocus();
        };
        staticStepRef.current = step;
        const onKey = (e: KeyboardEvent) => {
          if (modalOpenRef.current || flightActiveRef.current) return;
          // Let browser/OS shortcuts (Cmd+Down = scroll to bottom, etc.) through.
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          // Never hijack arrows typed into a form field (e.g. the Connect form).
          const t = e.target;
          if (
            t instanceof HTMLElement &&
            (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
          )
            return;
          // Reduced motion has no pin, so the page scrolls past the hero. Only
          // steer the carousel while it is actually on screen; otherwise the
          // arrows must fall through to native keyboard scrolling.
          const r = heroPin.getBoundingClientRect();
          if (r.bottom <= 0 || r.top >= window.innerHeight) return;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") step(1);
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step(-1);
          else return;
          e.preventDefault();
          // Keyboard-only: the prev/next buttons keep their own focus so a
          // repeated click never has to chase the control.
          focusCardButton(((Math.round(rotation) % total) + total) % total);
        };
        const onResize = () => renderFrame(1, rotation);
        window.addEventListener("keydown", onKey);
        window.addEventListener("resize", onResize);
        return () => {
          staticStepRef.current = null;
          window.clearTimeout(clearT);
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("resize", onResize);
          heroPin.removeAttribute("data-carousel");
          heroPin.removeAttribute("data-carousel-static");
          resetCollapse();
          setEngaged(false);
        };
      });

      // Keep pin and scrub measurements correct after layout shifts that land
      // after setup: the post-ready layout and async font swaps. Resize is
      // refreshed by ScrollTrigger automatically.
      ScrollTrigger.refresh();

      // Refresh scroll recovery: now that the pin spacer exists and the document
      // height is final, land at the restored position (deep reload) or section
      // (deep link). Forced instant (behavior: "auto" overrides the global
      // smooth scroll-behavior) so there is no animated crawl on load, then a
      // synchronous ScrollTrigger.update() renders the collapse at the matching
      // progress in this same pre-paint pass, so the deck never flashes at the
      // top before jumping. A no-op on normal top loads (restore is null).
      const restore = restoreTargetRef.current;
      restoreTargetRef.current = null;
      const applyRestore = () => {
        if (!restore) return;
        // Resolve the fragment with getElementById, not querySelector: a hash
        // like "#123" is a valid element id but an INVALID CSS selector, so
        // querySelector would throw and abort this useGSAP callback after the
        // ScrollTrigger and listeners were already created. getElementById never
        // throws; a missing target falls through to the saved pixel position.
        const el = restore.selector
          ? document.getElementById(decodeURIComponent(restore.selector.slice(1)))
          : null;
        if (el) {
          el.scrollIntoView({ block: "start", behavior: "auto" });
        } else if (restore.y != null) {
          window.scrollTo({ top: restore.y, behavior: "auto" });
        }
        ScrollTrigger.update();
      };
      applyRestore();

      // If the visitor scrolls or interacts before fonts settle, do NOT re-land
      // the restore under them; a small font-reflow shift is far better than
      // yanking them back to the load position.
      let disposed = false;
      let userMoved = false;
      const markMoved = () => {
        userMoved = true;
      };
      window.addEventListener("wheel", markMoved, { passive: true, once: true });
      window.addEventListener("touchstart", markMoved, { passive: true, once: true });
      window.addEventListener("keydown", markMoved, { once: true });
      window.addEventListener("pointerdown", markMoved, { once: true });

      if (typeof document !== "undefined" && document.fonts) {
        // Re-measure after async font swaps; re-land the restore too, since a
        // font reflow shifts content under a pixel-based scroll position. Guarded
        // so a late resolve after unmount never refreshes/scrolls a route this
        // scene no longer owns, and never re-lands once the user has moved.
        document.fonts.ready
          .then(() => {
            if (disposed) return;
            ScrollTrigger.refresh();
            if (!userMoved) applyRestore();
          })
          .catch(() => {});
      }

      return () => {
        disposed = true;
        window.removeEventListener("wheel", markMoved);
        window.removeEventListener("touchstart", markMoved);
        window.removeEventListener("keydown", markMoved);
        window.removeEventListener("pointerdown", markMoved);
        mm.revert();
      };
    },
    { scope: sectionRef, dependencies: [scrollReady, prefersReducedMotion, total] },
  );

  // Hide the source ring tile only while the card flies OUT and sits in the
  // modal (phase "out"); the flown clone represents it there. On close (phase
  // "closing") the card DISSOLVES in place, so the deck tile is revealed at its
  // slot right away and the fading clone settles over it. No hard DOM handoff.
  const hiddenRingKey = flight && flight.phase === "out" ? flight.tile.key : null;

  // Flip only enabled in the final ready state AND when no flight is in
  // progress; during flight, cursor interactions on ring tiles are paused.
  const flipEnabled = phase === "ready" && !prefersReducedMotion && !flight;

  return (
    <RingStateContext.Provider value={{ phase: publicState, modalOpen }}>
      <section
        ref={sectionRef}
        aria-label="Home"
        className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 md:overflow-x-clip md:overflow-y-visible md:px-10"
        data-state={publicState}
      >
        {/* Ambient radial tint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(ellipse_at_center,var(--color-glass)_0%,transparent_62%)]"
        />

        {/* Center content (HomeHero). Fades in after entrance resolves, and
            fades back out as the scroll collapse gathers the ring into a deck. */}
        <div
          ref={heroContentRef}
          className="relative z-20 mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          {children}
        </div>

        {/* Desktop ring subtree. Rendered only after mount and only on desktop
            so a phone never mounts the ring perspective stage or its
            ScrollTrigger collapse; mobile gets <MobileHome> instead. SSR and the
            first client render emit neither (mounted is false), which keeps
            hydration matched and avoids a tile flash. */}
        {mounted && !isMobile && (
        <>
        {/* Perspective stage: fixed in the viewport (no motion) so the window
            frame stays still while the ring plane tilts in 3D inside it. */}
        <div
          aria-hidden={phase !== "ready"}
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            perspective: `${RING_PERSPECTIVE_PX}px`,
            perspectiveOrigin: "center center",
          }}
        >
        {/* Ring container: tilts on X/Y (and a small Z) in response to the
            cursor. preserve-3d keeps each tile's own transform composable
            with the parent rotation so the ring reads as one solid plane
            in space, not flat elements that got skewed. */}
        <motion.div
          style={{
            rotateX,
            rotateY,
            rotateZ,
            transformStyle: "preserve-3d",
          }}
          className="absolute inset-0 h-full w-full"
        >
          {tiles.map((tile, i) => {
            const seat = seats[i];
            const isFirst = i === 0;

            // During shuffling, the current top tile gets a stacking-context
            // boost so it visually renders above its siblings; during
            // firstTile the lone visible tile is elevated so the first paint
            // is clean. Everywhere else tiles share the same layer.
            const zIndex =
              phase === "shuffling" && i === shuffleTopIndex
                ? 5
                : phase === "firstTile" && isFirst
                  ? 5
                  : 1;

            const target = computeTarget({
              phase,
              isFirst,
              seat,
              staggerIndex: i,
              isShuffleTop: i === shuffleTopIndex,
              reducedMotion: !!prefersReducedMotion,
            });

            return (
              <TileSlot
                key={tile.key}
                tile={tile}
                tileIndex={i}
                target={target}
                seat={seat}
                tileWidth={tileWidth}
                tileHeight={tileHeight}
                zIndex={zIndex}
                hidden={tile.key === hiddenRingKey}
                proximityEnabled={phase === "ready" && !prefersReducedMotion && !flight && !collapseEngaged}
                radiusVmin={radius}
                prefersReducedMotion={!!prefersReducedMotion}
                entering={phase !== "ready"}
                flipEnabled={flipEnabled}
                frosted={explored.has(tile.key)}
                cursorRef={cursorRef}
                proximityTick={proximityTick}
                viewportRef={viewportRef}
                onTileClick={handleTileClick}
                registerCollapseEl={(el) => {
                  collapseElsRef.current[i] = el;
                }}
              />
            );
          })}
        </motion.div>
        </div>

        {/* Left text panel (plan §3 [data-panel] reference). Hidden in the
            ring/hero state (opacity-0 class); the driver writes opacity +
            translateX imperatively every frame as the carousel settles (see
            renderFrame's panel block). Sits above the cards' stage (z-10)
            but below modals (z-50, portaled), pinned with the hero so it
            never portals out of #hero-pin. */}
        <div
          ref={deckHintRef}
          aria-hidden={!collapseEngaged}
          className="pointer-events-none absolute left-[7vw] top-1/2 z-20 flex w-[min(34vw,480px)] -translate-y-1/2 flex-col items-start gap-5 text-left opacity-0"
        >
          <ArcIndex
            total={total}
            helperLine={siteContent.home.panelHelper}
            numRef={arcIndexNumRef}
            kindRef={arcIndexKindRef}
            statusRef={arcIndexStatusRef}
            titleRef={arcIndexTitleRef}
            blurbRef={arcIndexBlurbRef}
            swapRef={arcIndexSwapRef}
          />
        </div>

        {/* Reduced-motion static affordances (plan §3 / WS-D). The settled
            arc has no wheel/auto-advance to rotate it in this mode, so these
            are the only way to browse besides arrow keys; rendered only when
            prefers-reduced-motion is active (mirrors data-carousel-static on
            #hero-pin, the seam the reduced-motion matchMedia branch sets).
            Real buttons (keyboard-focusable, visible focus ring from the
            global :focus-visible rule in globals.css), calling through
            staticStepRef so there is one rotation-stepping implementation
            shared with the arrow-key handler. */}
        {prefersReducedMotion && (
          <div
            aria-hidden={!collapseEngaged}
            className="pointer-events-none absolute right-[4vw] top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3"
          >
            <button
              type="button"
              onClick={() => staticStepRef.current?.(-1)}
              aria-label={siteContent.home.panelPrev}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-glass text-foreground backdrop-blur-md transition-colors duration-200 hover:text-accent"
            >
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => staticStepRef.current?.(1)}
              aria-label={siteContent.home.panelNext}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-glass text-foreground backdrop-blur-md transition-colors duration-200 hover:text-accent"
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
        </>
        )}

        {/* Mobile coverflow. Self-contained: owns its own GSAP context, pin,
            scroll-scrub ring->coverflow, swipe browsing, and reduced-motion
            fallback. Fades the shared heroContentRef during the scrub. Rendered
            only after mount and only on mobile, so the desktop ring above and
            this never coexist. */}
        {mounted && isMobile && (
          <MobileHome
            onOpen={handleCarouselOpen}
            heroContentRef={heroContentRef}
            scrollReady={scrollReady}
            prefersReducedMotion={!!prefersReducedMotion}
          />
        )}

      </section>

      {flight && (
        <Portal>
          <FlyingTile
            tile={flight.tile}
            homeRect={flight.homeRect}
            homeTangentDeg={flight.homeTangentDeg}
            homeRestRotX={flight.homeRestRotX}
            homeRestRotY={flight.homeRestRotY}
            source={flight.source}
            target={flight.target}
            phase={flight.phase}
            revealed={flight.reveal}
            onFlyOutComplete={handleFlyOutComplete}
            onClosingComplete={handleClosingComplete}
          />
        </Portal>
      )}

      <PhotoModal photo={selectedPhoto} onClose={handleModalClose} renderMedia={modalFromCarousel} />
      <WorkModal item={selectedWork} onClose={handleModalClose} renderMedia={modalFromCarousel} />
    </RingStateContext.Provider>
  );
}

// ---------- helpers ----------

type TargetSeat = { xVmin: number; yVmin: number; rotate: number };
type TargetResult = {
  animate: {
    x: string | string[];
    y: string | string[];
    rotate: number | number[];
    scale: number;
    opacity: number;
    z: number;
  };
  transition: { duration: number; ease: Easing; delay?: number };
};

// Per-tile translateZ stagger (px) while the tiles are piled at center
// (firstTile/stacking/shuffling). Without it the stacked glass panes share a
// depth and z-fight into a diagonal seam. It eases back to 0 as they fan out.
// The stagger only guarantees separation because the piled panes are held
// FLAT: TileSlot zeroes the baseline tilt during the entrance (see the
// flipRotateXRaw init note). A tilted native-large pane sweeps ~±23px of
// depth, dwarfing this step, so re-tilting the pile brings the clipping back.
const STACK_Z_STEP = 4.5;
// The shuffle's top tile pops fully in front of the piled stack. Derived from
// the pile's back depth ((total-1) * STACK_Z_STEP) plus clearance so the popped
// card always sits ahead of the deepest pile card (a fixed 60 fell inside the
// deeper pile and re-introduced clipping).
const SHUFFLE_TOP_Z =
  (siteContent.homeTiles.length - 1) * STACK_Z_STEP + 30;

// Compute the animate target + transition for a tile given the current phase.
// Kept as a pure function so phase transitions produce fresh object refs
// (which Framer needs to schedule a new animation) without accidental
// reference reuse. The layer is laid out native-large and rendered inside the
// wrapper's REST_WRAPPER_TRANSFORM down-scale (see TILE_NATIVE_SCALE), so the
// choreography is authored in NATIVE units: positions carry TILE_NATIVE_SCALE
// and scales are the plain design values (a design scale of 1 renders as the
// 9vmin display card after the wrapper's REST_SCALE). Rotations and depth
// (translateZ) are scale-invariant and unchanged.
function computeTarget({
  phase,
  isFirst,
  seat,
  staggerIndex,
  isShuffleTop,
  reducedMotion,
}: {
  phase: Phase;
  isFirst: boolean;
  seat: TargetSeat;
  staggerIndex: number;
  isShuffleTop: boolean;
  reducedMotion: boolean;
}): TargetResult {
  // Reduced motion: tiles appear directly at their seats with a short
  // opacity-only fade. TileSlot's initial state already sits at the seat
  // (full seat transform, opacity 0), so nothing translates or rotates.
  if (reducedMotion) {
    return {
      animate: {
        x: `${seat.xVmin * TILE_NATIVE_SCALE}vmin`,
        y: `${seat.yVmin * TILE_NATIVE_SCALE}vmin`,
        rotate: seat.rotate,
        scale: 1,
        opacity: 1,
        z: 0,
      },
      transition: { duration: 0.3, ease: EASE },
    };
  }
  if (phase === "hidden") {
    return {
      animate: { x: "0vmin", y: "0vmin", rotate: 0, scale: 0.92, opacity: 0, z: 0 },
      transition: { duration: 0.0001, ease: EASE },
    };
  }
  if (phase === "firstTile") {
    // Only the first tile fades in; everyone else stays hidden at center.
    return {
      animate: {
        x: "0vmin",
        y: "0vmin",
        rotate: 0,
        scale: isFirst ? 1 : 0.92,
        opacity: isFirst ? 1 : 0,
        z: staggerIndex * STACK_Z_STEP,
      },
      transition: { duration: 0.28, ease: EASE },
    };
  }
  if (phase === "stacking") {
    // The rest of the tiles flash in on top of the first.
    return {
      animate: {
        x: "0vmin",
        y: "0vmin",
        rotate: 0,
        scale: 1,
        opacity: 1,
        z: staggerIndex * STACK_Z_STEP,
      },
      transition: { duration: 0.18, ease: EASE },
    };
  }
  if (phase === "shuffling") {
    // Card-dealer riffle: the tile on top of the stack (isShuffleTop)
    // lifts slightly with a quick cant, then drops back as the next tile
    // takes its turn. Non-top tiles sit at a flat base state. Because the
    // shuffleTopIndex ticks fast (SHUFFLE_TICK_MS), the transform targets
    // change frequently; Framer's short transition makes each cut snap
    // crisply like a dealer's riffle.
    return {
      animate: {
        x: "0vmin",
        y: isShuffleTop ? `${-1.2 * TILE_NATIVE_SCALE}vmin` : "0vmin",
        // Small alternating tilt based on index parity so consecutive top
        // tiles rock left-right instead of always the same way.
        rotate: isShuffleTop ? (staggerIndex % 2 === 0 ? 4 : -4) : 0,
        scale: isShuffleTop ? 1.04 : 1,
        opacity: 1,
        // The top tile pops fully forward; the rest keep the index stagger so
        // no two slabs share a depth.
        z: isShuffleTop ? SHUFFLE_TOP_Z : staggerIndex * STACK_Z_STEP,
      },
      transition: { duration: 0.12, ease: EASE },
    };
  }
  if (phase === "fanning") {
    // Curved revolve out to the seat, sampled as a smooth decelerating bloom.
    // The tile expands from the collapsed deck along a quadratic-bezier arc
    // (center, control, seat) and rotates from upright (deck) up to its tangent
    // seat. The decelerate-out is baked into the sample spacing via easeOutQuint
    // (which mirrors EASE's quint feel), so a single linear tween between samples
    // reads as ONE continuous ease-out with no mid-arc velocity stall, no corner,
    // and no rotation pop at launch (rotation starts at the deck's 0, matching
    // the prior phase). Resting seat values are unchanged. See docs/design.md
    // "Home-ring entrance choreography".
    const seatAngle = Math.atan2(seat.yVmin, seat.xVmin);
    const seatRadius = Math.hypot(seat.xVmin, seat.yVmin);
    const sweepRad = (FAN_SWEEP_DEG * Math.PI) / 180;

    // Control point: part way out, swung back (counter-clockwise) by half the
    // sweep and pushed past the chord by FAN_ARC_LIFT_VMIN, so each tile arcs
    // gently clockwise into its seat (a soft, symmetric unfurl).
    const controlAngle = seatAngle - sweepRad / 2;
    const controlRadius = seatRadius / 2 + FAN_ARC_LIFT_VMIN;
    const controlX = Math.cos(controlAngle) * controlRadius;
    const controlY = Math.sin(controlAngle) * controlRadius;

    const xs: string[] = [];
    const ys: string[] = [];
    const rotates: number[] = [];
    for (let k = 0; k < FAN_SAMPLES; k++) {
      const t = k / (FAN_SAMPLES - 1);
      const u = 1 - Math.pow(1 - t, 5); // easeOutQuint progress, mirrors EASE
      const mx = 2 * (1 - u) * u * controlX + u * u * seat.xVmin;
      const my = 2 * (1 - u) * u * controlY + u * u * seat.yVmin;
      xs.push(`${mx * TILE_NATIVE_SCALE}vmin`);
      ys.push(`${my * TILE_NATIVE_SCALE}vmin`);
      rotates.push(seat.rotate * u);
    }

    return {
      animate: { x: xs, y: ys, rotate: rotates, scale: 1, opacity: 1, z: 0 },
      transition: {
        duration: TILE_FAN_DURATION_MS / 1000,
        ease: "linear", // decelerate is baked into the sample spacing above
        delay: (staggerIndex * TILE_FAN_STAGGER_MS) / 1000,
      },
    };
  }

  // ready: tiles rest at their seats with full tangent rotation. Scalar (not
  // keyframe) values so the resting transform is a single static state that the
  // proximity lean and the FlyingTile shared-element handoff can read exactly.
  return {
    animate: {
      x: `${seat.xVmin * TILE_NATIVE_SCALE}vmin`,
      y: `${seat.yVmin * TILE_NATIVE_SCALE}vmin`,
      rotate: seat.rotate,
      scale: 1,
      opacity: 1,
      z: 0,
    },
    transition: {
      duration: TILE_FAN_DURATION_MS / 1000,
      ease: EASE,
    },
  };
}

// ---------- TileSlot: one tile's wrapper with proximity-driven lean ----------

type TileSlotProps = {
  tile: HomeTileEntry;
  tileIndex: number;
  target: TargetResult;
  seat: TargetSeat;
  tileWidth: number;
  tileHeight: number;
  zIndex: number;
  hidden: boolean;
  proximityEnabled: boolean;
  radiusVmin: number;
  prefersReducedMotion: boolean;
  entering: boolean;
  flipEnabled: boolean;
  // Desktop-only explored indicator: true once this tile has been opened and
  // closed. Threaded straight into GlassTile's `frosted` prop.
  frosted: boolean;
  cursorRef: React.RefObject<{ x: number; y: number }>;
  proximityTick: MotionValue<number>;
  viewportRef: React.RefObject<{ vw: number; vh: number; vmin: number }>;
  onTileClick: (
    payload: TileActivatePayload,
    tileIndex: number,
    capture: TileCapture,
    tile: HomeTileEntry,
  ) => void;
  // Registers the tile's outer wrapper element with the parent so the scroll
  // layer can drive its collapse transform. Framer keeps the inner layers.
  registerCollapseEl: (el: HTMLDivElement | null) => void;
};

// Own-refs for per-tile proximity. Values are pixel-space offsets / degrees
// applied by an inner motion.div so they compose cleanly with the outer
// seat animation without fighting each other for the single transform slot.
function TileSlot({
  tile,
  tileIndex,
  target,
  seat,
  tileWidth,
  tileHeight,
  zIndex,
  hidden,
  proximityEnabled,
  radiusVmin,
  prefersReducedMotion,
  entering,
  flipEnabled,
  frosted,
  cursorRef,
  proximityTick,
  viewportRef,
  onTileClick,
  registerCollapseEl,
}: TileSlotProps) {
  // Lean motion values (inner transform layer). Spring-smoothed so they
  // glide toward targets rather than snap when the cursor moves.
  const leanX = useMotionValue(0);
  const leanY = useMotionValue(0);
  const leanRot = useMotionValue(0);
  const leanScale = useMotionValue(1);
  const smoothLeanX = useSpring(leanX, { stiffness: 220, damping: 22, mass: 0.6 });
  const smoothLeanY = useSpring(leanY, { stiffness: 220, damping: 22, mass: 0.6 });
  const smoothLeanRot = useSpring(leanRot, { stiffness: 220, damping: 22, mass: 0.6 });
  const smoothLeanScale = useSpring(leanScale, { stiffness: 220, damping: 22, mass: 0.6 });

  // The lean springs mean VISUAL viewport px (computeFlightSource consumes
  // smoothLeanX/Y.get() as such), but the lean layer renders inside the
  // wrapper's REST_SCALE down-scale. Re-expand at render time only so the
  // on-screen lean stays the designed px; leanRot (deg) and leanScale
  // (multiplier) are scale-invariant and pass through untouched.
  const renderLeanX = useTransform(smoothLeanX, (v) => v * TILE_NATIVE_SCALE);
  const renderLeanY = useTransform(smoothLeanY, (v) => v * TILE_NATIVE_SCALE);

  // Per-tile baseline X/Y rotation so no tile is ever perfectly flat.
  const baselineRotX = tileBaselineRotX(tileIndex);
  const baselineRotY = tileBaselineRotY(tileIndex);

  // Proximity-driven flip (both axes). Soft spring so the motion takes real
  // time and a paused cursor leaves each tile suspended at its current
  // angle. The animated entrance starts FLAT (0), not at the baseline tilt:
  // while the cards are piled at center they sit only STACK_Z_STEP (4.5px)
  // apart in Z, and a ±6° baseline tilt on the native-large 244x325px pane
  // sweeps ~±23px of depth, so tilted neighbors physically intersect and the
  // browser plane-splits them into diagonal clipping seams (the shuffle-clip
  // bug, confirmed via runtime matrices 2026-07-03). The baseline eases in
  // through the springs once the ring is ready and the seats are far apart.
  // Reduced motion skips the pile entirely, so it starts at the baseline.
  const flipRotateXRaw = useMotionValue(prefersReducedMotion ? baselineRotX : 0);
  const flipRotateYRaw = useMotionValue(prefersReducedMotion ? baselineRotY : 0);
  const flipRotateX = useSpring(flipRotateXRaw, { stiffness: 80, damping: 22, mass: 1.1 });
  const flipRotateY = useSpring(flipRotateYRaw, { stiffness: 80, damping: 22, mass: 1.1 });

  const buttonRef = useRef<HTMLButtonElement>(null);

  // Capture the tile's full live transform (spring outputs, read before any
  // flight-triggered relaxation runs) and hand off to the parent's flight
  // orchestrator. The clone always starts from the card's real (front-facing)
  // rotation; the card never flips to its mirrored back face. wasKeyboard only
  // tells the parent whether to restore focus on close.
  const handleActivate = (
    payload: TileActivatePayload,
    wasKeyboard: boolean,
  ) => {
    onTileClick(
      payload,
      tileIndex,
      {
        leanX: smoothLeanX.get(),
        leanY: smoothLeanY.get(),
        leanRot: smoothLeanRot.get(),
        leanScale: smoothLeanScale.get(),
        rotX: flipRotateX.get(),
        rotY: flipRotateY.get(),
        button: buttonRef.current,
        wasKeyboard,
      },
      tile,
    );
  };

  // Recompute lean targets whenever the cursor moves (or proximityEnabled
  // flips). Uses vmin → px conversion from the current viewport size so the
  // tile's seat position in viewport pixels is accurate.
  useEffect(() => {
    if (!proximityEnabled) {
      leanX.set(0);
      leanY.set(0);
      leanRot.set(0);
      leanScale.set(1);
      // Entrance (pile/riffle/fan): hold the pane FLAT. The piled cards are
      // only STACK_Z_STEP apart in Z, far less than the baseline tilt's depth
      // sweep on the native-large pane, so any tilt makes neighbors intersect
      // and clip (see the flipRotateXRaw init note). Everywhere else the
      // resting baseline applies.
      const flat = entering && !prefersReducedMotion;
      flipRotateXRaw.set(flat ? 0 : baselineRotX);
      flipRotateYRaw.set(flat ? 0 : baselineRotY);
      return;
    }

    const compute = () => {
      const cursor = cursorRef.current;
      const px = cursor ? cursor.x : -9999;
      const py = cursor ? cursor.y : -9999;
      // Cursor parked off-screen (initial / pointer-left) → rest at baseline.
      if (px < -1000 || py < -1000) {
        leanX.set(0);
        leanY.set(0);
        leanRot.set(0);
        leanScale.set(1);
        flipRotateXRaw.set(baselineRotX);
        flipRotateYRaw.set(baselineRotY);
        return;
      }
      const vp = viewportRef.current;
      if (!vp || !vp.vmin) return; // viewport not measured yet
      const { vw, vh, vmin } = vp;
      const ringCx = vw / 2;
      const ringCy = vh / 2;
      const seatPxX = ringCx + (seat.xVmin / 100) * vmin;
      const seatPxY = ringCy + (seat.yVmin / 100) * vmin;

      const dx = px - seatPxX;
      const dy = py - seatPxY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Inverted bell curve for the 3D flip: 4t(1-t) peaks at t=0.5 with
      // value 1 and is 0 at t=0 (cursor on tile) and t=1 (cursor at edge).
      // Result: the hovered tile keeps its baseline (stays flat-ish); the
      // tiles around it, neighbors at mid-distance, tilt away from the
      // cursor direction. Far tiles are also at baseline.
      if (dist < PROXIMITY_RADIUS_PX) {
        const t = dist / PROXIMITY_RADIUS_PX;
        const bell = 4 * t * (1 - t);
        const invDist = dist > 0.01 ? 1 / dist : 0;
        const ux = dx * invDist;
        const uy = dy * invDist;
        // rotateY tilts a tile's right/left side back depending on whether
        // the cursor is to its right or left. rotateX tilts top/bottom
        // depending on cursor above/below.
        const proxRotY = -ux * NEIGHBOR_FLIP_MAX_DEG * bell;
        const proxRotX = uy * NEIGHBOR_FLIP_MAX_DEG * bell;
        flipRotateXRaw.set(baselineRotX + proxRotX);
        flipRotateYRaw.set(baselineRotY + proxRotY);
      } else {
        flipRotateXRaw.set(baselineRotX);
        flipRotateYRaw.set(baselineRotY);
      }

      if (dist >= PROXIMITY_RADIUS_PX) {
        leanX.set(0);
        leanY.set(0);
        leanRot.set(0);
        leanScale.set(1);
        return;
      }

      // Quadratic falloff so the closest tile reacts strongest on lean,
      // neighbors taper down to zero at the radius edge.
      const t = 1 - dist / PROXIMITY_RADIUS_PX;
      const strength = t * t;

      // Unit vector from tile center to cursor.
      const invDist = dist > 0.01 ? 1 / dist : 0;
      const ux = dx * invDist;
      const uy = dy * invDist;

      // Pull the tile toward the cursor, lift it slightly, lean it so it
      // "looks at" the cursor (rotateZ by the horizontal component of the
      // direction vector).
      leanX.set(ux * PROXIMITY_PULL_PX * strength);
      leanY.set(uy * PROXIMITY_PULL_PX * strength - PROXIMITY_LIFT_PX * strength);
      leanRot.set(ux * PROXIMITY_TILT_DEG * strength);
      leanScale.set(1 + PROXIMITY_SCALE_BOOST * strength);
    };

    // Compute now + once per coalesced cursor frame. A single tick
    // subscription replaces the old dual cursorPx/cursorPy pair, which ran
    // compute twice per frame on diagonal movement.
    compute();
    return proximityTick.on("change", compute);
  }, [proximityEnabled, entering, prefersReducedMotion, proximityTick, cursorRef, viewportRef, seat.xVmin, seat.yVmin, radiusVmin, leanX, leanY, leanRot, leanScale, flipRotateXRaw, flipRotateYRaw, baselineRotX, baselineRotY]);

  return (
    <div
      ref={registerCollapseEl}
      data-tile-index={tileIndex}
      className="absolute left-1/2 top-1/2 h-0 w-0 [transform-style:preserve-3d]"
      // The static rest transform is the native-frame down-scale (see
      // TILE_NATIVE_SCALE): flat 2D at the hero (ideal raster), replaced
      // wholesale by the driver while the carousel is engaged, restored by
      // resetCollapse. The Framer child below is authored in native units.
      style={{ zIndex, transform: REST_WRAPPER_TRANSFORM }}
    >
      <motion.div
        initial={
          // Reduced motion starts at the seat so the entrance is a pure
          // opacity fade; the animated entrance starts from the center deck.
          prefersReducedMotion
            ? {
                x: `${seat.xVmin * TILE_NATIVE_SCALE}vmin`,
                y: `${seat.yVmin * TILE_NATIVE_SCALE}vmin`,
                rotate: seat.rotate,
                scale: 1,
                opacity: 0,
              }
            : {
                x: "0vmin",
                y: "0vmin",
                rotate: 0,
                scale: 0.92,
                opacity: 0,
              }
        }
        animate={target.animate}
        transition={target.transition}
        style={{
          transformStyle: "preserve-3d",
          // Native-large layout: the card rasterizes at 10/3 the display size
          // and the wrapper above carries the REST_SCALE down-scale, so the
          // rendered rest is the 9vmin display card and the arc never scales
          // the texture up (see TILE_NATIVE_SCALE).
          width: `${tileWidth * TILE_NATIVE_SCALE}vmin`,
          height: `${tileHeight * TILE_NATIVE_SCALE}vmin`,
          marginLeft: `-${(tileWidth * TILE_NATIVE_SCALE) / 2}vmin`,
          marginTop: `-${(tileHeight * TILE_NATIVE_SCALE) / 2}vmin`,
          // Hidden while flight is active for this tile so the flying clone
          // is the only visible instance. (This subtree only renders post-
          // mount, so no SSR/pre-mount opacity gate is needed here.)
          opacity: hidden ? 0 : undefined,
          pointerEvents: hidden ? "none" : undefined,
          visibility: hidden ? "hidden" : undefined,
        }}
        className="pointer-events-auto"
      >
        {/* Inner wrapper carries the proximity lean so it composes on top of
            the seat transform without fighting Framer's animate prop. */}
        <motion.div
          style={{
            x: renderLeanX,
            y: renderLeanY,
            rotate: smoothLeanRot,
            scale: smoothLeanScale,
            transformStyle: "preserve-3d",
          }}
          className="h-full w-full"
        >
          <GlassTile
            tile={tile}
            entering={entering}
            flipEnabled={flipEnabled}
            flipRotateX={flipRotateX}
            flipRotateY={flipRotateY}
            buttonRef={buttonRef}
            onActivate={handleActivate}
            frosted={frosted}
            detailScale={TILE_NATIVE_SCALE}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

