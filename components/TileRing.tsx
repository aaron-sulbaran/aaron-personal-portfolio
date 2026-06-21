"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Easing, type MotionValue } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { siteContent, type HomeTile as HomeTileEntry, type Photo, type WorkItem } from "@/lib/content";
import { useBodyScrollLock } from "@/lib/modal";
import { readScrollY, saveScrollY } from "@/lib/scroll";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { DeckIndex } from "./DeckIndex";
import { GlassTile, type TileActivatePayload } from "./GlassTile";
import { FlyingTile, type FlightPhase, type FlightSource, type FlightTarget } from "./FlyingTile";
import { PhotoModal } from "./PhotoModal";
import { WorkModal } from "./WorkModal";

// Layout effect on the client, no-op on the server. The refresh scroll recovery
// determination must run before paint (so a deep reload never flashes the
// entrance/freeze before jumping to "ready"), but a bare useLayoutEffect warns
// during SSR. This alias keeps the pre-paint timing without the warning.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Reload threshold: a restored scroll position past half a viewport (clearly out
// of the hero) takes the fast path and skips the entrance + freeze. Below it we
// treat the reload as a top arrival and play the full intro.
const FAST_START_THRESHOLD_FRAC = 0.5;

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

// Desktop deck hover peek. The hovered card pops forward and nudges right so its
// glass face shows. PEEK_RIGHT is kept under half the on-screen card spacing
// (STEP_X_FRAC * vw, which is ~55px at a ~1280px viewport) so the lifted card
// stays within its own slot's hit band: the cursor that lifted it is still over
// it, so a click lands in place without chasing the card, and a sweep advances
// one card per slot cleanly. The lift drama comes mostly from the forward pop.
// PEEK_SWITCH_MARGIN is a small, uniform anti-jitter hold (screen-space, so near
// and far cards feel the same). The nearest-slot hit test assigns the cursor to
// the right card regardless, so this stays correct on narrower/wider desktops.
const PEEK_RIGHT = 24;          // rightward nudge of the lifted card (px, pre-perspective)
const PEEK_FORWARD = 64;        // forward pop (translateZ px) of the lifted card
const PEEK_SCALE = 1.09;        // the lifted card grows about its own center so the lift reads clearly
const PEEK_SWITCH_MARGIN = 10;  // a neighbor must beat the armed card by this (px) to take the lift

// Mobile cylinder carousel. The 20 ring cards roll onto a vertical-axis
// cylinder: the front card faces the viewer head-on, its neighbors curve away
// in depth left and right (showing their glass edges), the back cards recede to
// the furthest point. Swiping rotates the whole cylinder infinitely, no end
// wall. The morph maps the ring's bottom card to the front and its top card to
// the back, so the existing ring tips into the carousel in place. See
// applyCarousel / applyCarouselMorph in the scroll layer.
// Coverflow: an evenly spaced horizontal row of big glass cards. The focused
// (center) card faces the viewer head-on; cards to its left turn to face right
// and cards to its right turn to face left, so the row fans open like flipping
// through records. Cards recede in depth away from center; swiping shifts the
// whole row and it wraps, so it loops forever.
const CAROUSEL_SCALE = 4.2;           // card size; the 9vmin tile is tiny on mobile vmin
const CAROUSEL_STEP_X_FRAC = 0.46;    // gap between adjacent card centers, fraction of vw
const CAROUSEL_DEPTH = 120;           // px a card recedes per step -> perspective depth cascade
const CAROUSEL_FACE_TILT_DEG = 44;    // how far the side cards turn to face center (0 at the center card)
const CAROUSEL_Y_OFFSET_VMIN = -5;    // pull the row up from dead center
const CAROUSEL_VISIBLE = 3;           // cards each side of focus before they cull out (more of the cascade shows)
const CAROUSEL_DRAG_PX_PER_CARD = 110; // horizontal drag px to advance one card
const CAROUSEL_TILT_MAX_DEG = 7;      // extra kinetic lean added in the swipe direction
// The first collapse per load is a forced, un-skippable "wow moment" of this
// duration, driven directly (not through the scrub) so it is snappy and never
// lags; afterwards the scrub renders ring <-> collapsed 1:1 from scroll.
const FORCED_COLLAPSE_SECONDS = 0.55;

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
    target: FlightTarget;   // modal slot rect
    phase: FlightPhase;
  } | null>(null);

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
  // Invitation copy under the deck; fades in as the ring collapses.
  const deckHintRef = useRef<HTMLDivElement | null>(null);
  // Deck index ("NN · Title" of the active card). Written imperatively via
  // writeActiveCard so hover/swipe never re-renders the 20 tiles. Desktop reads
  // the hovered card (setPeeked); mobile reads the centered card and shows faded
  // prev/next around it. lastFocusRef debounces the mobile writes to snap changes.
  const deckSubtitleRef = useRef<HTMLParagraphElement | null>(null);
  const deckIndexNumRef = useRef<HTMLSpanElement | null>(null);
  const deckIndexTitleRef = useRef<HTMLSpanElement | null>(null);
  const deckIndexLineRef = useRef<HTMLDivElement | null>(null);
  const deckIndexPrevRef = useRef<HTMLSpanElement | null>(null);
  const deckIndexNextRef = useRef<HTMLSpanElement | null>(null);
  const lastFocusRef = useRef<number>(-1);
  // Index of the deck card currently peeked up on hover, or -1.
  const peekRef = useRef(-1);
  // Each settled deck card's on-screen center, used to pick the hovered card
  // from the cursor position (a stable hit test, so peeking a card up doesn't
  // re-fire enter/leave and jitter).
  const deckHitRef = useRef<{ x: number; y: number }[]>([]);
  // True only while the deck is settled AND on screen (the collapse dwell), so
  // hover peeks fire there but not mid-scrub or after scrolling on to Work.
  const deckHoverableRef = useRef(false);
  // Mobile coverflow carousel: a transparent full-bleed surface that captures
  // touch gestures. A custom handler owns the swipe (horizontal rotates the
  // coverflow, a deliberate vertical swipe exits up to the page or down to the
  // ring), so nothing competes for the gesture and the carousel cannot freeze.
  const dragSurfaceRef = useRef<HTMLDivElement | null>(null);
  // Current coverflow focus (in card units; the centered card) and the eased
  // kinetic tilt (deg) added in the swipe direction. Refs so the per-frame drag
  // handler writes them without re-rendering.
  const carouselRotationRef = useRef(0);
  const carouselTiltRef = useRef(0);
  // True exactly once the forced first collapse ("wow moment") has played this
  // load; afterwards ring <-> collapsed transitions are quick and reversible.
  const forcedDoneRef = useRef(false);

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
      // The forced first-collapse "wow moment" is part of the intro we are
      // skipping; mark it spent so it never arms on this load.
      forcedDoneRef.current = true;
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

  // Write the active card into the deck index DOM (no React state, so the 20
  // tiles never re-render on hover/swipe). `i` is the card index, or null to
  // clear. Desktop fades the single line in/out via lineRef; mobile also fills
  // the faded prev/next titles. Mirrors the imperative deckHint opacity pattern.
  const writeActiveCard = useCallback(
    (i: number | null) => {
      const num = deckIndexNumRef.current;
      const title = deckIndexTitleRef.current;
      if (!num || !title) return;
      const line = deckIndexLineRef.current;
      const subtitle = deckSubtitleRef.current;
      const prev = deckIndexPrevRef.current;
      const next = deckIndexNextRef.current;
      const tiles = siteContent.homeTiles;
      if (i == null || i < 0) {
        num.textContent = "";
        title.textContent = "";
        if (line) line.style.opacity = "0";
        // Nothing hovered: show the home-state invitation subtitle (desktop).
        if (subtitle) subtitle.style.opacity = "1";
        if (prev) prev.textContent = "";
        if (next) next.textContent = "";
        lastFocusRef.current = -1;
        return;
      }
      num.textContent = String(i + 1).padStart(2, "0");
      title.textContent = tiles[i]?.title ?? "";
      if (line) line.style.opacity = "1";
      // Hovering a card: hide the invitation so only the card's index shows.
      if (subtitle) subtitle.style.opacity = "0";
      if (prev) prev.textContent = tiles[(i - 1 + total) % total]?.title ?? "";
      if (next) next.textContent = tiles[(i + 1) % total]?.title ?? "";
    },
    [total],
  );

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
      // Initial target is the home rect itself; the useEffect below reads
      // the real modal slot rect once mounted and updates `target` so the
      // flight has a real destination.
      target: home,
      phase: "out",
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
    const cx = vw / 2 + planeX * kTz;
    const cy = vh / 2 + planeY * kTz;
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
    return {
      rect: {
        left: vw / 2 + x2 * k * kTz - width / 2,
        top: vh / 2 + y2 * k * kTz - height / 2,
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

  // Fly-out animation completed with the tile sitting in the modal's slot.
  // Nothing to do: the ring stays live and static behind the translucent
  // frosted modal (its parallax/lean listeners are already paused during
  // flight), so the blurred ring reads through the glass as intended.
  const handleFlyOutComplete = () => {
    // intentionally empty
  };

  // Modal close: exit the modal immediately (its own exit variant runs), and
  // reverse the flown tile back to its ring seat. The ring tile is hidden
  // the whole time flight is non-null; when flight clears (via
  // handleClosingComplete), the ring tile pops back.
  const handleModalClose = () => {
    setSelectedPhoto(null);
    setSelectedWork(null);
    if (!flight) {
      restoreSourceFocus();
      return;
    }
    // The parallax springs have been targeting 0 since the flight started;
    // jump clears any sub-pixel residue so the closing flight lands on a
    // perfectly flat ring.
    parallaxX.jump(0);
    parallaxY.jump(0);
    setFlight((prev) => (prev ? { ...prev, phase: "closing" } : prev));
  };

  // Closing flight has landed at home. Because parallax/lean/flip have
  // already been eased to rest during the modal-open period, the flying
  // tile's resting geometry now matches the ring tile's pixel-perfectly.
  // Clear the flight state, let the ring tile take over with a seamless
  // DOM handoff, and hand focus back to the originating tile button.
  const handleClosingComplete = () => {
    setFlight(null);
    restoreSourceFocus();
  };


  // Once a modal mounts, its [data-tile-slot] div is in the DOM. Read its
  // viewport rect and update the flight target so the flown tile lands
  // exactly in the slot, not a CSS-approximated position. Re-measures if
  // the viewport resizes while the modal is open.
  const modalOpen = selectedPhoto !== null || selectedWork !== null;
  useEffect(() => {
    if (!modalOpen) return;
    if (!flight || flight.phase !== "out") return;

    let raf = 0;
    const measure = () => {
      const slot = document.querySelector<HTMLDivElement>("[data-tile-slot]");
      if (!slot) {
        raf = requestAnimationFrame(measure);
        return;
      }
      const rect = slot.getBoundingClientRect();
      setFlight((prev) =>
        prev
          ? {
              ...prev,
              target: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              },
            }
          : prev,
      );
    };
    raf = requestAnimationFrame(measure);

    const onResize = () => {
      measure();
      // Also re-compute the home rect so closing still lands correctly
      // if the viewport was resized while the modal was open. Read through
      // the ref: this effect only depends on modalOpen, so a direct call
      // would freeze the seat geometry captured at open time.
      setFlight((prev) => {
        if (!prev) return prev;
        return { ...prev, homeRect: computeHomeRectRef.current(prev.tileIndex) };
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // Intentionally don't depend on `flight` so we don't trigger re-measure
    // on every flight state update; only on modal open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // Desktop scroll collapse: pin the hero and scrub the ring into a tight
  // horizontal overlapped deck, then release the pin so the deck is a normal
  // lingering-friendly section. GSAP owns each tile's outer-wrapper transform
  // and the matching collapseRef value; Framer keeps the inner seat/lean/flip
  // layers. Gated on the entrance being ready so it never races the fan-out.
  // Mobile and reduced-motion get their own branches in a later phase; until
  // then they do nothing and the ring simply scrolls past as the hero.
  useGSAP(
    () => {
      if (!scrollReady) return;
      const heroPin = document.getElementById("hero-pin");
      if (!heroPin) return;

      const DECK_SCALE = 1.7; // cards grow into panels as they gather
      const DECK_ANGLE = -20; // gentle rotateY: faces left, reads L to R
      // Depth recede: enough that adjacent angled planes never cross (no 3D
      // clipping) but gentle, so the last card stays readable rather than tiny.
      const DEPTH_STEP = 52;
      const STEP_X_FRAC = 0.043; // horizontal march per card (fraction of vw)
      const STEP_Y_FRAC = 0.012; // gentle vertical rise per card (fraction vmin)
      // The collapse finishes at this fraction of the pinned scroll; the rest
      // is a settled-deck dwell so a fast flick is held on the deck (with its
      // caption) for a beat before it can scroll on to Work.
      const COLLAPSE_PORTION = 0.72;
      const ease = gsap.parseEase("power2.inOut");

      const applyCollapse = (progress: number) => {
        // Any scrub cancels an in-progress hover peek so the dy bookkeeping
        // stays balanced (the loop below rewrites each card from scratch). Clear
        // the deck index too, so reforming to the ring without moving the mouse
        // does not leave a stale "NN Title" behind to flash on the next collapse.
        if (peekRef.current >= 0) writeActiveCard(null);
        peekRef.current = -1;
        const e = ease(Math.min(1, progress / COLLAPSE_PORTION));
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const vmin = Math.min(vw, vh);
        const scale = 1 + e * (DECK_SCALE - 1);
        const angle = e * DECK_ANGLE;
        const stepX = vw * STEP_X_FRAC;
        const stepY = vmin * STEP_Y_FRAC;
        const mid = (total - 1) / 2;
        for (let i = 0; i < total; i++) {
          const seatX = (seats[i].xVmin / 100) * vmin;
          const seatY = (seats[i].yVmin / 100) * vmin;
          // Counter-rotate the seat tangent to 0 so the deck cards stand
          // upright; the uniform rotateY then angles the whole stack in depth.
          const rotZDeg = -seats[i].rotate * e;
          const rz = (rotZDeg * Math.PI) / 180;
          const cos = Math.cos(rz);
          const sin = Math.sin(rz);
          const tz = e * -i * DEPTH_STEP;
          const kTz = RING_PERSPECTIVE_PX / (RING_PERSPECTIVE_PX - tz);
          // Even on-screen march across the full width: back the perspective
          // foreshortening out of the slot so each card lands at its screen x
          // (front card far left, last card far right), only the SIZE recedes.
          const screenX = (i - mid) * stepX;
          const screenY = -(i - mid) * stepY;
          const slotCx = screenX / kTz;
          const slotCy = screenY / kTz;
          // Interpolate the card CENTER from its ring seat to its deck slot.
          const cxCard = (1 - e) * seatX + e * slotCx;
          const cyCard = (1 - e) * seatY + e * slotCy;
          // Back the wrapper translate out of scale + seat rotation so the card
          // rotates about its own center (the trailing translate(-seat) below).
          const dx = cxCard - scale * (cos * seatX - sin * seatY);
          const dy = cyCard - scale * (sin * seatX + cos * seatY);
          const c = collapseRef.current[i];
          if (c) {
            c.dx = dx;
            c.dy = dy;
            c.scale = scale;
            c.rotZ = rotZDeg;
            c.rotX = 0;
            c.rotY = angle;
            c.tz = tz;
          }
          deckHitRef.current[i] = { x: vw / 2 + cxCard * kTz, y: vh / 2 + cyCard * kTz };
          const el = collapseElsRef.current[i];
          if (el) {
            // Clear any hover transition so the scrub is instant (no lag).
            el.style.transition = "";
            el.style.transform = `translate(${cxCard}px, ${cyCard}px) translateZ(${tz}px) rotateY(${angle}deg) scale(${scale}) rotate(${rotZDeg}deg) translate(${-seatX}px, ${-seatY}px)`;
          }
        }
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = String(1 - Math.min(1, e * 1.4));
          heroContentRef.current.style.pointerEvents = e > 0.02 ? "none" : "";
        }
        if (deckHintRef.current) {
          deckHintRef.current.style.opacity = String(Math.max(0, (e - 0.55) / 0.45));
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
            el.style.transform = "";
            el.style.transition = "";
            el.style.zIndex = "";
            el.style.opacity = "";
          }
        }
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = "";
          heroContentRef.current.style.pointerEvents = "";
          heroContentRef.current.style.transition = "";
        }
        if (deckHintRef.current) deckHintRef.current.style.opacity = "";
        // Clear the deck index so nothing stale survives a reform/refresh.
        writeActiveCard(null);
        if (dragSurfaceRef.current) dragSurfaceRef.current.style.pointerEvents = "none";
      };

      const setEngaged = (v: boolean) => {
        if (engagedRef.current === v) return;
        engagedRef.current = v;
        setCollapseEngaged(v);
      };

      // ---- Mobile cylinder carousel renderers -----------------------------
      // Shared placement: write a card's outer-wrapper transform AND its
      // matching collapseRef offset (the flight invariant). The trailing
      // rotate(-seat)/translate(-seat) cancels the Framer seat so the card ends
      // exactly at (sx, sy, tz) with rotateY(rotYDeg) and scale, about its own
      // center. Mirrors the composition the desktop deck uses.
      const placeCard = (
        i: number,
        sx: number,
        sy: number,
        tz: number,
        rotYDeg: number,
        scale: number,
        rotZDeg: number,
        vmin: number,
      ) => {
        const seatX = (seats[i].xVmin / 100) * vmin;
        const seatY = (seats[i].yVmin / 100) * vmin;
        const rz = (rotZDeg * Math.PI) / 180;
        const cos = Math.cos(rz);
        const sin = Math.sin(rz);
        const c = collapseRef.current[i];
        if (c) {
          c.dx = sx - scale * (cos * seatX - sin * seatY);
          c.dy = sy - scale * (sin * seatX + cos * seatY);
          c.scale = scale;
          c.rotZ = rotZDeg;
          c.rotX = 0;
          c.rotY = rotYDeg;
          c.tz = tz;
        }
        const el = collapseElsRef.current[i];
        if (el) {
          el.style.transition = "";
          el.style.transform = `translate(${sx}px, ${sy}px) translateZ(${tz}px) rotateY(${rotYDeg}deg) scale(${scale}) rotate(${rotZDeg}deg) translate(${-seatX}px, ${-seatY}px)`;
        }
      };

      // Settled coverflow at a given focus (in card units; carouselRotationRef
      // holds it). Cards sit in an evenly spaced horizontal row, ALL at the same
      // constant tilt so each reads as an angled 3D slab, receding in depth away
      // from the focused (center) card. The offset wraps to [-N/2, N/2) so the
      // row loops forever. tiltDeg is the extra kinetic lean in the swipe dir.
      const wrapOff = (off: number) => {
        const half = total / 2;
        return (((off + half) % total) + total) % total - half;
      };
      // Coverflow face angle for a card at signed offset `off` from the focus:
      // cards left of center (off<0) turn to face right, cards to the right face
      // left, the center card is flat. Ramps to the full angle by one card out,
      // then holds, so the whole fan reads as turned-toward-you records.
      const faceTilt = (off: number) => {
        const dir = off === 0 ? 0 : off < 0 ? 1 : -1;
        return dir * Math.min(Math.abs(off), 1) * CAROUSEL_FACE_TILT_DEG;
      };
      const applyCarousel = (focus: number, tiltDeg: number) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const vmin = Math.min(vw, vh);
        const stepX = vw * CAROUSEL_STEP_X_FRAC;
        const yOff = (CAROUSEL_Y_OFFSET_VMIN / 100) * vmin;
        for (let i = 0; i < total; i++) {
          const off = wrapOff(i - focus);
          const aoff = Math.abs(off);
          placeCard(
            i,
            off * stepX,
            yOff,
            -aoff * CAROUSEL_DEPTH,
            faceTilt(off) + tiltDeg,
            CAROUSEL_SCALE,
            -seats[i].rotate,
            vmin,
          );
          const el = collapseElsRef.current[i];
          if (el) {
            el.style.zIndex = String(1000 - Math.round(aoff * 10));
            el.style.opacity = aoff > CAROUSEL_VISIBLE + 0.5 ? "0" : "1";
          }
        }
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = "0";
          heroContentRef.current.style.pointerEvents = "none";
        }
        if (deckHintRef.current) deckHintRef.current.style.opacity = "1";
      };

      // Ring -> coverflow morph at p in [0,1]. Each card interpolates from its
      // ring seat (p=0, identity wrapper = card at seat) to its coverflow slot
      // centered on the middle card (p=1 == applyCarousel(CAROUSEL_HOME_FOCUS)).
      // Cards that end off-screen fade as they travel so nothing pops at the edges.
      const CAROUSEL_HOME_FOCUS = Math.floor(total / 2);
      const applyCarouselMorph = (p: number) => {
        const e = ease(p);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const vmin = Math.min(vw, vh);
        const stepX = vw * CAROUSEL_STEP_X_FRAC;
        const yOff = (CAROUSEL_Y_OFFSET_VMIN / 100) * vmin;
        for (let i = 0; i < total; i++) {
          const off = wrapOff(i - CAROUSEL_HOME_FOCUS);
          const aoff = Math.abs(off);
          const seatX = (seats[i].xVmin / 100) * vmin;
          const seatY = (seats[i].yVmin / 100) * vmin;
          const sx = (1 - e) * seatX + e * (off * stepX);
          const sy = (1 - e) * seatY + e * yOff;
          const tz = e * (-aoff * CAROUSEL_DEPTH);
          const rotY = e * faceTilt(off);
          const rotZ = e * -seats[i].rotate;
          const scale = 1 + e * (CAROUSEL_SCALE - 1);
          placeCard(i, sx, sy, tz, rotY, scale, rotZ, vmin);
          const el = collapseElsRef.current[i];
          if (el) {
            el.style.zIndex = String(1000 - Math.round(aoff * 10));
            el.style.opacity =
              aoff > CAROUSEL_VISIBLE + 0.5 ? String(Math.max(0, 1 - e * 1.3)) : "1";
          }
        }
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = String(1 - Math.min(1, e * 1.4));
          heroContentRef.current.style.pointerEvents = e > 0.02 ? "none" : "";
        }
        if (deckHintRef.current) {
          deckHintRef.current.style.opacity = String(Math.max(0, (e - 0.5) / 0.5));
        }
      };

      // Card currently centered (focused), used for tap.
      const carouselFocusedIndex = () =>
        ((Math.round(carouselRotationRef.current) % total) + total) % total;

      // ---- Forced first collapse ("wow moment") ---------------------------
      // The first scroll-down per load plays the collapse fully and a fast flick
      // cannot skip it. Mechanism: block user scroll input and smoothly drive the
      // SCROLL POSITION to the collapsed anchor over a fixed short time. The ONE
      // scrub (scrub:true -> instant, no lag) renders the collapse from that
      // driven scroll, so the visual and the scroll are never decoupled and the
      // collapse can never double-render. Afterwards the scrub is reversible.
      const blockEvent = (e: Event) => e.preventDefault();
      const blockInput = (on: boolean) => {
        if (on) {
          window.addEventListener("wheel", blockEvent, { passive: false });
          window.addEventListener("touchmove", blockEvent, { passive: false });
        } else {
          window.removeEventListener("wheel", blockEvent);
          window.removeEventListener("touchmove", blockEvent);
        }
      };
      const playForced = (st: ScrollTrigger, portion: number, onDone?: () => void) => {
        blockInput(true);
        const range = st.end - st.start;
        const o = { y: st.scroll() };
        gsap.to(o, {
          y: st.start + portion * range,
          duration: FORCED_COLLAPSE_SECONDS,
          ease: "power2.inOut",
          onUpdate: () => st.scroll(o.y),
          onComplete: () => {
            blockInput(false);
            forcedDoneRef.current = true;
            onDone?.();
          },
        });
      };
      // Arm a one-shot interceptor for the first downward scroll intent while at
      // the top, then hand off to playForced. Self-removes once consumed.
      const armForced = (st: ScrollTrigger, portion: number, onDone?: () => void) => {
        if (forcedDoneRef.current) return () => {};
        let startY = 0;
        const cleanup = () => {
          window.removeEventListener("wheel", onWheel);
          window.removeEventListener("touchstart", onTouchStart);
          window.removeEventListener("touchmove", onTouchMove);
        };
        const fire = () => {
          cleanup();
          playForced(st, portion, onDone);
        };
        const onWheel = (e: WheelEvent) => {
          if (forcedDoneRef.current) return cleanup();
          if (e.deltaY > 0 && st.progress < 0.02) {
            e.preventDefault();
            fire();
          }
        };
        const onTouchStart = (e: TouchEvent) => {
          startY = e.touches[0]?.clientY ?? 0;
        };
        const onTouchMove = (e: TouchEvent) => {
          if (forcedDoneRef.current) return cleanup();
          const y = e.touches[0]?.clientY ?? 0;
          if (st.progress < 0.02 && startY - y > 4) {
            e.preventDefault();
            fire();
          }
        };
        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        return cleanup;
      };

      const mm = gsap.matchMedia();

      // Desktop: pin + scrub ring -> angled hover-peek deck (reversible: scroll
      // up reforms the ring, Home lands there). The first collapse is forced.
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const st = ScrollTrigger.create({
          trigger: heroPin,
          start: "top top",
          end: "+=185%",
          pin: heroPin,
          pinType: "fixed",
          pinSpacing: true,
          anticipatePin: 1,
          // Smoothed scrub: the collapse eases toward the scroll position over
          // ~0.6s instead of snapping 1:1, so chunky mouse-wheel deltas glide the
          // ring into the deck (and back) rather than stepping. The settled-deck
          // hover/peek is unaffected (it lives past the collapse, progress > 0.7).
          scrub: 0.6,
          // Catch the deck so it is a stable place you LAND on (and can hover the
          // cards), not a frame you slide past. Stop near the top -> reform the
          // ring; stop in the collapse zone -> settle the deck; past the dwell ->
          // release to Work (no snap). Mirrors inkwell's settled-deck section.
          snap: {
            snapTo: (value: number) =>
              value < 0.38 ? 0 : value < 0.88 ? COLLAPSE_PORTION + 0.1 : value,
            duration: 0.3,
            delay: 0.05,
            ease: "power2.inOut",
          },
          invalidateOnRefresh: true,
          onRefreshInit: resetCollapse,
          onUpdate: (self) => {
            applyCollapse(self.progress);
            setEngaged(self.progress > 0.004);
            // Hoverable once the deck has formed (past the collapse portion). Not
            // gated on isActive, so the peek keeps working after the pin releases
            // and the deck scrolls up toward Work; the hit test corrects for that
            // scroll offset. Reforming toward the ring (progress < 0.7) disables it.
            deckHoverableRef.current = self.progress > 0.7;
          },
          onToggle: (self) => {
            // Releasing at the TOP (back to the ring) disables hover; releasing at
            // the BOTTOM (scrolled past to Work) leaves it on so the cards stay
            // hoverable while still visible.
            if (!self.isActive && self.progress < 0.5) deckHoverableRef.current = false;
          },
        });
        const disarm = armForced(st, COLLAPSE_PORTION, () => {
          deckHoverableRef.current = true;
        });
        return () => {
          disarm();
          st.kill();
          resetCollapse();
          setEngaged(false);
        };
      });

      // Mobile: a self-contained state machine. No ScrollTrigger pin and no
      // GSAP Draggable. Both caused the freeze: the pinned scrub fought the
      // horizontal swipe over one gesture stream, and a horizontal swipe leaks a
      // little vertical scroll that drifted the scrub progress until the settle
      // gate disabled the Draggable mid-gesture and stranded it dead. Here the
      // hero just sits at the top of the document at its natural height; its
      // resting look is the ring. A downward intent morphs the ring into the
      // coverflow and locks the page: while in the carousel the swipe handler
      // owns every touch (preventDefault), so nothing competes and it cannot
      // freeze. A deliberate vertical swipe leaves, on a smooth tween instead of
      // a raw scrub: swipe up continues to the page, swipe down reforms the ring.
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        const surface = dragSurfaceRef.current;

        // Tuning.
        const MORPH_SECONDS = 0.55;  // ring <-> coverflow morph
        const AXIS_LOCK_PX = 10;     // travel before we commit to swipe vs. exit
        const EXIT_SWIPE_PX = 64;    // vertical travel that counts as "leave"
        const MOMENTUM_MS = 240;     // flick projection horizon
        const SNAP_SECONDS = 0.45;   // settle-to-card after a flick
        const RING_INTENT_PX = 6;    // downward travel that opens the carousel

        // "ring": resting at top, armed for the downward intent.
        // "morphing": a transition tween owns the screen; input ignored.
        // "carousel": locked fullscreen coverflow; the swipe handler owns touch.
        // "page": scrolled past the hero; the document scrolls normally.
        type MState = "ring" | "morphing" | "carousel" | "page";
        let state: MState = "ring";
        let activeTween: gsap.core.Tween | null = null;

        const updateIndex = () => {
          const f = carouselFocusedIndex();
          if (f !== lastFocusRef.current) {
            lastFocusRef.current = f;
            writeActiveCard(f);
          }
        };
        const armSurface = (on: boolean) => {
          if (!surface) return;
          surface.style.pointerEvents = on ? "auto" : "none";
          // none = we own every touch (no native scroll); "" restores pan-y.
          surface.style.touchAction = on ? "none" : "";
        };

        // ---- transitions ----------------------------------------------------
        const toCarousel = () => {
          if (state !== "ring") return;
          state = "morphing";
          carouselRotationRef.current = CAROUSEL_HOME_FOCUS;
          carouselTiltRef.current = 0;
          setEngaged(true); // also stands proximity/parallax down
          const o = { e: 0 };
          activeTween?.kill();
          activeTween = gsap.to(o, {
            e: 1,
            duration: MORPH_SECONDS,
            ease: "none", // applyCarouselMorph eases internally
            onUpdate: () => applyCarouselMorph(o.e),
            onComplete: () => {
              applyCarousel(carouselRotationRef.current, 0);
              updateIndex();
              armSurface(true);
              state = "carousel";
            },
          });
        };
        const toRing = () => {
          // Reform the ring in place (swipe down from the carousel).
          state = "morphing";
          armSurface(false);
          const o = { e: 1 };
          activeTween?.kill();
          activeTween = gsap.to(o, {
            e: 0,
            duration: MORPH_SECONDS,
            ease: "none",
            onUpdate: () => applyCarouselMorph(o.e),
            onComplete: () => {
              resetCollapse();
              setEngaged(false);
              state = "ring";
            },
          });
        };
        const toPage = () => {
          // Continue to the rest of the page (swipe up from the carousel). Tween
          // the scroll ourselves (no ScrollToPlugin) so it is smooth, not a jump.
          state = "morphing";
          armSurface(false);
          const o = { y: window.scrollY };
          activeTween?.kill();
          activeTween = gsap.to(o, {
            y: heroPin.offsetHeight, // hero is the first, full-height block
            duration: 0.6,
            ease: "power2.inOut",
            onUpdate: () => window.scrollTo(0, o.y),
            onComplete: () => {
              // Hero is off-screen now: reform the ring invisibly so a return to
              // the top always shows the ring, never a stale coverflow.
              resetCollapse();
              setEngaged(false);
              state = "page";
            },
          });
        };

        // ---- ring: intercept the first downward intent ----------------------
        let ringStartY = 0;
        const onRingWheel = (e: WheelEvent) => {
          if (state === "ring" && e.deltaY > 0) {
            e.preventDefault();
            toCarousel();
          }
        };
        const onRingTouchStart = (e: TouchEvent) => {
          ringStartY = e.touches[0]?.clientY ?? 0;
        };
        const onRingTouchMove = (e: TouchEvent) => {
          if (state !== "ring") return;
          const y = e.touches[0]?.clientY ?? 0;
          if (ringStartY - y > RING_INTENT_PX) {
            e.preventDefault();
            toCarousel();
          }
        };

        // ---- carousel: custom horizontal swipe + vertical exit --------------
        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastT = 0;
        let vX = 0; // px/ms
        let axis: "x" | "y" | null = null;
        let baseFocus = CAROUSEL_HOME_FOCUS;
        let moved = false;

        const onSurfaceTouchStart = (e: TouchEvent) => {
          if (state !== "carousel") return;
          activeTween?.kill(); // stop a settle in progress so the grab is instant
          const t = e.touches[0];
          if (!t) return;
          startX = lastX = t.clientX;
          startY = t.clientY;
          lastT = e.timeStamp;
          vX = 0;
          axis = null;
          moved = false;
          baseFocus = carouselRotationRef.current;
        };
        const onSurfaceTouchMove = (e: TouchEvent) => {
          if (state !== "carousel") return;
          const t = e.touches[0];
          if (!t) return;
          // We own the carousel surface entirely: never let the page scroll here.
          e.preventDefault();
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          if (!axis) {
            if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
            axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
            moved = true;
          }
          if (axis !== "x") return; // vertical is resolved on release (exit)
          const now = e.timeStamp;
          const dt = now - lastT;
          if (dt > 0) vX = (t.clientX - lastX) / dt;
          lastX = t.clientX;
          lastT = now;
          const focus = baseFocus - dx / CAROUSEL_DRAG_PX_PER_CARD;
          carouselRotationRef.current = focus;
          const tilt = Math.max(
            -CAROUSEL_TILT_MAX_DEG,
            Math.min(CAROUSEL_TILT_MAX_DEG, -vX * 40),
          );
          carouselTiltRef.current = tilt;
          applyCarousel(focus, tilt);
          updateIndex();
        };
        const onSurfaceTouchEnd = (e: TouchEvent) => {
          if (state !== "carousel") return;
          if (axis === "y") {
            const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
            if (dy <= -EXIT_SWIPE_PX) return toPage(); // swipe up -> page
            if (dy >= EXIT_SWIPE_PX) return toRing(); // swipe down -> ring
            return; // small vertical: stay put
          }
          if (!moved) {
            // Tap: open the focused card (its button sits under this surface).
            const focused = carouselFocusedIndex();
            const btn = collapseElsRef.current[focused]?.querySelector("button");
            if (btn) btn.click();
            return;
          }
          // Horizontal flick: project momentum, then snap to the nearest card.
          const projected =
            carouselRotationRef.current - (vX * MOMENTUM_MS) / CAROUSEL_DRAG_PX_PER_CARD;
          const target = Math.round(projected);
          const o = { v: carouselRotationRef.current };
          activeTween?.kill();
          activeTween = gsap.to(o, {
            v: target,
            duration: SNAP_SECONDS,
            ease: "power3.out",
            onUpdate: () => {
              carouselRotationRef.current = o.v;
              applyCarousel(o.v, 0);
              updateIndex();
            },
            onComplete: () => {
              carouselRotationRef.current = target;
              carouselTiltRef.current = 0;
              applyCarousel(target, 0);
              updateIndex();
            },
          });
        };

        // ---- page <-> ring sync on real document scroll ---------------------
        // Symmetric so a deep-reload restore (applyRestore scrolls AFTER this
        // block sets the initial state) cannot strand us in "ring" while parked
        // mid-page: in "ring" the downward intent is intercepted and never
        // scrolls the document, so any real scroll there means we are actually
        // past the hero. Returning to the very top re-arms the ring.
        const onPageScroll = () => {
          if (state === "page" && window.scrollY <= 2) {
            carouselRotationRef.current = CAROUSEL_HOME_FOCUS;
            carouselTiltRef.current = 0;
            state = "ring"; // hero already shows the ring (reformed on exit)
          } else if (state === "ring" && window.scrollY > 4) {
            state = "page";
          }
        };

        // Initial state: a deep reload can land us already past the hero.
        resetCollapse();
        state = window.scrollY > 4 ? "page" : "ring";

        window.addEventListener("wheel", onRingWheel, { passive: false });
        window.addEventListener("touchstart", onRingTouchStart, { passive: true });
        window.addEventListener("touchmove", onRingTouchMove, { passive: false });
        window.addEventListener("scroll", onPageScroll, { passive: true });
        if (surface) {
          surface.addEventListener("touchstart", onSurfaceTouchStart, { passive: true });
          surface.addEventListener("touchmove", onSurfaceTouchMove, { passive: false });
          surface.addEventListener("touchend", onSurfaceTouchEnd, { passive: true });
        }

        return () => {
          activeTween?.kill();
          window.removeEventListener("wheel", onRingWheel);
          window.removeEventListener("touchstart", onRingTouchStart);
          window.removeEventListener("touchmove", onRingTouchMove);
          window.removeEventListener("scroll", onPageScroll);
          if (surface) {
            surface.removeEventListener("touchstart", onSurfaceTouchStart);
            surface.removeEventListener("touchmove", onSurfaceTouchMove);
            surface.removeEventListener("touchend", onSurfaceTouchEnd);
          }
          armSurface(false);
          resetCollapse();
          setEngaged(false);
        };
      });

      // Reduced motion: no scrub, no pin. Cross-fade the ring into the settled
      // deck and stop; the user gets the destination state without the motion.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (heroContentRef.current) {
          heroContentRef.current.style.transition = "opacity 0.5s ease";
        }
        for (let i = 0; i < total; i++) {
          const el = collapseElsRef.current[i];
          if (el) el.style.transition = "transform 0.5s ease";
        }
        applyCollapse(1);
        setEngaged(true);
        const clearT = window.setTimeout(() => {
          for (let i = 0; i < total; i++) {
            const el = collapseElsRef.current[i];
            if (el) el.style.transition = "";
          }
          if (heroContentRef.current) heroContentRef.current.style.transition = "";
        }, 520);
        return () => {
          window.clearTimeout(clearT);
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
        const el = restore.selector
          ? document.querySelector<HTMLElement>(restore.selector)
          : null;
        if (el) {
          el.scrollIntoView({ block: "start", behavior: "auto" });
        } else if (restore.y != null) {
          window.scrollTo({ top: restore.y, behavior: "auto" });
        }
        ScrollTrigger.update();
      };
      applyRestore();

      if (typeof document !== "undefined" && document.fonts) {
        // Re-measure after async font swaps; re-land the restore too, since a
        // font reflow shifts content under a pixel-based scroll position.
        document.fonts.ready
          .then(() => {
            ScrollTrigger.refresh();
            applyRestore();
          })
          .catch(() => {});
      }

      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [scrollReady, isMobile, prefersReducedMotion, total] },
  );

  // Hover peek for the settled desktop deck. The hovered card is chosen from
  // the CURSOR POSITION (deckHitRef), not per-card mouseenter, so lifting a card
  // never moves it out from under the cursor and re-fires events (the old
  // jitter). The card slides RIGHT and a touch forward (out of the stack to the
  // right, like the inkwell reference) while keeping its angle, so its glass face
  // shows. It adjusts the same collapseRef the flight reads, so a click still
  // spawns the clone there.
  const peekBackupRef = useRef<{ dx: number; tz: number; scale: number } | null>(null);
  const rebuildPeek = useCallback(
    (i: number) => {
      const el = collapseElsRef.current[i];
      const c = collapseRef.current[i];
      if (!el || !c) return;
      const vmin = Math.min(window.innerWidth, window.innerHeight);
      const seatX = (seats[i].xVmin / 100) * vmin;
      const seatY = (seats[i].yVmin / 100) * vmin;
      const rz = (c.rotZ * Math.PI) / 180;
      const cos = Math.cos(rz);
      const sin = Math.sin(rz);
      const cxCard = c.dx + c.scale * (cos * seatX - sin * seatY);
      const cyCard = c.dy + c.scale * (sin * seatX + cos * seatY);
      el.style.transform = `translate(${cxCard}px, ${cyCard}px) translateZ(${c.tz}px) rotateY(${c.rotY}deg) scale(${c.scale}) rotate(${c.rotZ}deg) translate(${-seatX}px, ${-seatY}px)`;
    },
    [seats],
  );
  const setPeeked = useCallback(
    (i: number) => {
      if (peekRef.current === i) return;
      const prev = peekRef.current;
      if (prev >= 0) {
        const c = collapseRef.current[prev];
        const b = peekBackupRef.current;
        if (c && b) {
          c.dx = b.dx;
          c.tz = b.tz;
          c.scale = b.scale;
        }
        rebuildPeek(prev);
      }
      peekRef.current = i;
      peekBackupRef.current = null;
      // Mirror the hovered card into the deck index (clears on un-hover, i < 0).
      writeActiveCard(i);
      if (i < 0) return;
      const c = collapseRef.current[i];
      const el = collapseElsRef.current[i];
      if (!c || !el) return;
      peekBackupRef.current = { dx: c.dx, tz: c.tz, scale: c.scale };
      c.dx += PEEK_RIGHT;
      c.tz += PEEK_FORWARD;
      c.scale *= PEEK_SCALE;
      el.style.transition = "transform 0.22s cubic-bezier(0.22,1,0.36,1)";
      rebuildPeek(i);
    },
    [rebuildPeek, writeActiveCard],
  );

  // Pick the hovered deck card from the cursor and peek it. Active whenever the
  // deck has formed and is visible (deckHoverableRef), including while it scrolls
  // up past the pin toward Work, so a user can hover the cards at any point they
  // can see them, not only on the settled dwell. Stable hit test = no jitter.
  useEffect(() => {
    if (isMobile) return;
    const PEEK_HIT_X = 140;
    const PEEK_HIT_Y = 210;
    // deckHitRef holds each card's UNPEEKED screen center captured while the deck
    // was pinned (section top = 0). Once the scroll passes the pin, #hero-pin
    // scrolls up, so the live card y = stored y + the section's current top. One
    // layout read per move (the pinned wrapper), reused for all 20 cards, keeps
    // the hit test aligned to where the cards actually are. x is unaffected
    // (vertical scroll only).
    let pinEl: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (!deckHoverableRef.current) {
        if (peekRef.current >= 0) setPeeked(-1);
        return;
      }
      const hits = deckHitRef.current;
      const cur = peekRef.current;
      if (!pinEl) pinEl = document.getElementById("hero-pin");
      const offY = pinEl ? pinEl.getBoundingClientRect().top : 0;
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (!h || Math.abs(e.clientY - (h.y + offY)) > PEEK_HIT_Y) continue;
        const d = Math.abs(e.clientX - h.x);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      // Light, uniform anti-jitter hold: keep the armed card unless a different
      // card is at least PEEK_SWITCH_MARGIN closer. Slot centers are evenly
      // spaced on screen, so this stickiness is identical for near and far cards
      // (no perspective scaling). The small lateral peek keeps the lifted card
      // under the cursor, so the click lands in place and the sweep stays clean.
      if (
        cur >= 0 &&
        best !== cur &&
        hits[cur] &&
        Math.abs(e.clientY - (hits[cur].y + offY)) <= PEEK_HIT_Y
      ) {
        const dCur = Math.abs(e.clientX - hits[cur].x);
        if (dCur <= PEEK_HIT_X && dCur - bestD < PEEK_SWITCH_MARGIN) {
          best = cur;
          bestD = dCur;
        }
      }
      setPeeked(best >= 0 && bestD <= PEEK_HIT_X ? best : -1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [isMobile, setPeeked]);

  // While any flight is active, the flown tile's key identifies the ring
  // tile that should stay hidden. When flight clears, the ring tile takes
  // over at the flying tile's exact final geometry; no fade needed.
  const hiddenRingKey = flight ? flight.tile.key : null;

  // Flip only enabled in the final ready state AND when no flight is in
  // progress; during flight, cursor interactions on ring tiles are paused.
  const flipEnabled = phase === "ready" && !prefersReducedMotion && !flight;

  return (
    <RingStateContext.Provider value={{ phase: publicState, modalOpen }}>
      <section
        ref={sectionRef}
        aria-label="Home"
        className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 md:px-10"
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
                mounted={mounted}
                prefersReducedMotion={!!prefersReducedMotion}
                entering={phase !== "ready"}
                flipEnabled={flipEnabled}
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

        {/* Invitation under the deck. Hidden in the ring/hero state (opacity-0
            class); the collapse drives its opacity imperatively so it fades in
            as the deck settles. */}
        <div
          ref={deckHintRef}
          aria-hidden={!collapseEngaged}
          className="pointer-events-none absolute inset-x-0 bottom-[11%] z-20 flex flex-col items-center gap-2 px-6 text-center opacity-0"
        >
          <DeckIndex
            isMobile={isMobile}
            heading={siteContent.home.deckTitle}
            subtitle={siteContent.home.deckSubtitle}
            subtitleRef={deckSubtitleRef}
            numRef={deckIndexNumRef}
            titleRef={deckIndexTitleRef}
            lineRef={deckIndexLineRef}
            prevRef={deckIndexPrevRef}
            nextRef={deckIndexNextRef}
          />
        </div>

        {/* Mobile carousel drag surface: a transparent full-bleed overlay that
            the custom touch handler uses to capture coverflow swipes. touch-action
            and pointer-events are driven from JS (armSurface): off in the ring and
            on desktop so the flat ring stays tappable, on (touch-action none) only
            once the coverflow is settled so the handler fully owns the gesture. */}
        <div
          ref={dragSurfaceRef}
          aria-hidden="true"
          className="absolute inset-0 z-30 [touch-action:pan-y]"
          style={{ pointerEvents: "none" }}
        />
      </section>

      {flight && (
        <FlyingTile
          tile={flight.tile}
          homeRect={flight.homeRect}
          homeTangentDeg={flight.homeTangentDeg}
          homeRestRotX={flight.homeRestRotX}
          homeRestRotY={flight.homeRestRotY}
          source={flight.source}
          target={flight.target}
          phase={flight.phase}
          onFlyOutComplete={handleFlyOutComplete}
          onClosingComplete={handleClosingComplete}
        />
      )}

      <PhotoModal photo={selectedPhoto} onClose={handleModalClose} />
      <WorkModal item={selectedWork} onClose={handleModalClose} />
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

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Per-tile translateZ stagger (px) while the tiles are piled at center
// (firstTile/stacking/shuffling). Without it the stacked glass slabs share a
// depth and z-fight into a diagonal seam. It eases back to 0 as they fan out.
// MUST exceed the card's physical THICKNESS_PX (3) or adjacent slabs (front
// face +1.5, back face -1.5) physically interpenetrate and clip; 4.5 leaves a
// ~1.5px gap between every pair so the pile is clean yet still tight.
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
// reference reuse.
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
        x: `${seat.xVmin}vmin`,
        y: `${seat.yVmin}vmin`,
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
        y: isShuffleTop ? "-1.2vmin" : "0vmin",
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
      xs.push(`${mx}vmin`);
      ys.push(`${my}vmin`);
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
      x: `${seat.xVmin}vmin`,
      y: `${seat.yVmin}vmin`,
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
  mounted: boolean;
  prefersReducedMotion: boolean;
  entering: boolean;
  flipEnabled: boolean;
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
  mounted,
  prefersReducedMotion,
  entering,
  flipEnabled,
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

  // Per-tile baseline X/Y rotation so no tile is ever perfectly flat.
  const baselineRotX = tileBaselineRotX(tileIndex);
  const baselineRotY = tileBaselineRotY(tileIndex);

  // Proximity-driven flip (both axes). Soft spring so the motion takes real
  // time and a paused cursor leaves each tile suspended at its current
  // angle. Initialized to the baseline so the first paint already shows
  // the resting tilt.
  const flipRotateXRaw = useMotionValue(baselineRotX);
  const flipRotateYRaw = useMotionValue(baselineRotY);
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
      flipRotateXRaw.set(baselineRotX);
      flipRotateYRaw.set(baselineRotY);
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
  }, [proximityEnabled, proximityTick, cursorRef, viewportRef, seat.xVmin, seat.yVmin, radiusVmin, leanX, leanY, leanRot, leanScale, flipRotateXRaw, flipRotateYRaw, baselineRotX, baselineRotY]);

  return (
    <div
      ref={registerCollapseEl}
      data-tile-index={tileIndex}
      className="absolute left-1/2 top-1/2 h-0 w-0 [transform-style:preserve-3d]"
      style={{ zIndex }}
    >
      <motion.div
        initial={
          // Reduced motion starts at the seat so the entrance is a pure
          // opacity fade; the animated entrance starts from the center deck.
          prefersReducedMotion
            ? {
                x: `${seat.xVmin}vmin`,
                y: `${seat.yVmin}vmin`,
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
          width: `${tileWidth}vmin`,
          height: `${tileHeight}vmin`,
          marginLeft: `-${tileWidth / 2}vmin`,
          marginTop: `-${tileHeight / 2}vmin`,
          // Hidden while flight is active for this tile so the flying clone
          // is the only visible instance. Also hides during SSR / pre-mount.
          opacity: hidden ? 0 : mounted || prefersReducedMotion ? undefined : 0,
          pointerEvents: hidden ? "none" : undefined,
          visibility: hidden ? "hidden" : undefined,
        }}
        className="pointer-events-auto"
      >
        {/* Inner wrapper carries the proximity lean so it composes on top of
            the seat transform without fighting Framer's animate prop. */}
        <motion.div
          style={{
            x: smoothLeanX,
            y: smoothLeanY,
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
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

