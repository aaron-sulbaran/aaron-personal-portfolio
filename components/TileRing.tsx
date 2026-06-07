"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Easing, type MotionValue } from "framer-motion";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { siteContent, type HomeTile as HomeTileEntry, type Photo, type WorkItem } from "@/lib/content";
import { useBodyScrollLock } from "@/lib/modal";
import { GlassTile, type TileActivatePayload } from "./GlassTile";
import { FlyingTile, type FlightPhase, type FlightTarget } from "./FlyingTile";
import { PhotoModal } from "./PhotoModal";
import { WorkModal } from "./WorkModal";

// Context so the center content (HomeHero) can react to the ring's state.
// Keeps state ownership in TileRing and avoids prop-drilling through children.
// Default is "pre" so SSR + pre-hydration renders treat HomeHero as hidden;
// once the provider mounts, real state flows in.
const RingStateContext = createContext<"pre" | "entering" | "ready">("pre");
export const useRingState = () => useContext(RingStateContext);

type Props = {
  children: React.ReactNode; // HomeHero sits at the ring's center
};

// Ring geometry (desktop). 20 tiles around a 41vmin ring give ~13vmin of arc
// per tile; a 9vmin tile leaves a ~4vmin gap between each — the airy
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
const SHUFFLE_TICK_MS = 120;      // how fast the top card cycles during shuffle
const SHUFFLE_DURATION_MS = 200;  // brief riffle before the fan (kept short; not in design.md)
const TILE_FAN_DURATION_MS = 780; // per-tile travel time to its ring seat (design.md: 780)
const TILE_FAN_STAGGER_MS = 10;   // near-simultaneous: tiles bloom outward together with a faint ripple

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
// axes in response to cursor position — it reads as "looking down into a
// crystal ball that leans with your gaze," not "the page is sliding."
// Window/page frame stays still; only the ring plane is tilting in space.
const PARALLAX_MAX_TILT_DEG = 14;   // max X/Y rotation in degrees
const PARALLAX_MAX_ZROT_DEG = 3;    // small Z roll for additional depth
const RING_PERSPECTIVE_PX = 1400;   // perspective distance on the ring stage

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
// it) stays close to its baseline — the NEIGHBORS are the ones that tilt
// in 3D as the cursor passes near. A bell-shaped strength function peaks
// at mid-distance and drops to 0 both at the tile center and at the
// radius edge, producing the "cards parting around the cursor" motion.
// Tiles also carry a small per-tile baseline rotation so none of them is
// ever perfectly flat — always reads as a 3D glass card catching light.
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
    sourceAngle: number;    // flipRotateY at click time
    target: FlightTarget;   // modal slot rect
    phase: FlightPhase;
  } | null>(null);

  // Body locked through all entrance phases; released when ready.
  useBodyScrollLock(phase !== "ready");

  // Parallax motion values, spring-smoothed. pX/pY are normalized cursor
  // position in [-1..1] (0 = viewport center). Feed through springs so the
  // ring lags the cursor slightly for a "weighted" feel.
  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);
  const smoothX = useSpring(parallaxX, { stiffness: 60, damping: 20, mass: 0.9 });
  const smoothY = useSpring(parallaxY, { stiffness: 60, damping: 20, mass: 0.9 });

  // Raw cursor pixel position (viewport-relative). Used by per-tile proximity
  // handlers so each tile can compute its distance to the cursor and apply
  // a local lean. Initial value is off-screen so tiles sit at rest on mount.
  const cursorPx = useMotionValue(-9999);
  const cursorPy = useMotionValue(-9999);

  // 3D tilt: cursor X rotates the ring around the Y axis (yaw) — moving the
  // cursor right swings the right edge of the ring AWAY from the viewer.
  // Cursor Y rotates around the X axis (pitch) — moving the cursor up tips
  // the top of the ring TOWARD the viewer. Small Z roll layered on for
  // extra depth feel.
  const rotateY = useTransform(smoothX, (v) => `${v * PARALLAX_MAX_TILT_DEG}deg`);
  const rotateX = useTransform(smoothY, (v) => `${-v * PARALLAX_MAX_TILT_DEG}deg`);
  const rotateZ = useTransform(smoothX, (v) => `${v * PARALLAX_MAX_ZROT_DEG}deg`);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
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
    const fine = window.matchMedia("(pointer: fine)");
    if (!fine.matches) return;

    const onMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const nx = (e.clientX - cx) / cx;
      const ny = (e.clientY - cy) / cy;
      // Ring moves AWAY from cursor: negate.
      parallaxX.set(-nx);
      parallaxY.set(-ny);
      // Raw pixel position for per-tile proximity.
      cursorPx.set(e.clientX);
      cursorPy.set(e.clientY);
    };
    const onLeave = () => {
      parallaxX.set(0);
      parallaxY.set(0);
      cursorPx.set(-9999);
      cursorPy.set(-9999);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [parallaxX, parallaxY, cursorPx, cursorPy, phase, prefersReducedMotion, flight]);

  // When a flight starts, kick parallax back to 0 (and blank the cursor
  // motion values so all per-tile lean/flip springs also relax to 0).
  // Spring-smoothed so the ring eases to flat over ~400ms rather than
  // snapping. By the time the user closes the modal, parallax is at 0 and
  // the flying tile's closing animation lands at a position that exactly
  // matches where the ring tile will sit when flight clears — no snap.
  useEffect(() => {
    if (!flight) return;
    parallaxX.set(0);
    parallaxY.set(0);
    cursorPx.set(-9999);
    cursorPy.set(-9999);
  }, [flight, parallaxX, parallaxY, cursorPx, cursorPy]);

  // Drive the entrance sequence on mount. Each timer advances one phase.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase !== "hidden") return;

    // Kick off the sequence on the next frame so SSR/CSR render matches
    // before Framer takes over.
    const kickoff = requestAnimationFrame(() => setPhase("firstTile"));
    return () => cancelAnimationFrame(kickoff);
  }, [phase, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase !== "firstTile") return;
    const t = window.setTimeout(() => setPhase("stacking"), FIRST_TILE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase !== "stacking") return;
    const t = window.setTimeout(() => setPhase("shuffling"), STACK_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [phase, prefersReducedMotion]);

  // Shuffle: cycle which tile is on top. Every SHUFFLE_TICK_MS a different
  // tile rises to the front of the stack with a tiny pop. After
  // SHUFFLE_DURATION_MS, hand off to fanning.
  useEffect(() => {
    if (prefersReducedMotion) return;
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
  }, [phase, prefersReducedMotion]);

  // Fanning → ready: triggered when the last tile's fan animation completes
  // (see onAnimationComplete on that tile). As a safety net, also flip to
  // ready after the theoretical total fanning duration in case the
  // onAnimationComplete doesn't fire (e.g., tab backgrounded, motion paused).
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase !== "fanning") return;
    const total = siteContent.homeTiles.length;
    const totalFanMs = TILE_FAN_DURATION_MS + TILE_FAN_STAGGER_MS * (total - 1);
    const t = window.setTimeout(() => setPhase("ready"), totalFanMs + 80);
    return () => window.clearTimeout(t);
  }, [phase, prefersReducedMotion]);

  const tiles = siteContent.homeTiles;
  const total = tiles.length;
  const radius = isMobile ? RING_RADIUS_VMIN_MOBILE : RING_RADIUS_VMIN;
  const tileWidth = isMobile ? TILE_WIDTH_VMIN_MOBILE : TILE_WIDTH_VMIN;
  const tileHeight = tileWidth * (4 / 3); // 3:4 aspect

  // Seat = final position on the ring. Full tangent rotation: each tile's
  // local up-vector aligns with the radial vector from the center. Upside-
  // down tiles at the bottom are deliberate — see docs/design.md
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

  // Click on a ring tile: capture its intrinsic rect (from seat geometry,
  // NOT getBoundingClientRect which returns the axis-aligned bbox of the
  // rotated tile and would distort the flown shape) and its tangent Z
  // rotation. Start the modal mount and the flight on the same frame.
  const handleTileClick = (
    payload: TileActivatePayload,
    tileIndex: number,
    sourceAngle: number,
    homeTile: HomeTileEntry,
  ) => {
    if (flight) return; // already flying

    const home = computeHomeRect(tileIndex);
    const homeTangentDeg = seats[tileIndex].rotate;

    setFlight({
      tile: homeTile,
      tileIndex,
      homeRect: home,
      homeTangentDeg,
      homeRestRotX: tileBaselineRotX(tileIndex),
      homeRestRotY: tileBaselineRotY(tileIndex),
      sourceAngle,
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
  // tile — no geometry mismatch when the DOM handoff happens.
  const computeHomeRect = (tileIndex: number): FlightTarget => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const vmin = Math.min(vw, vh);
    const widthPx = (tileWidth / 100) * vmin;
    const heightPx = (tileHeight / 100) * vmin;
    const cx = vw / 2 + (seats[tileIndex].xVmin / 100) * vmin;
    const cy = vh / 2 + (seats[tileIndex].yVmin / 100) * vmin;
    return {
      left: cx - widthPx / 2,
      top: cy - heightPx / 2,
      width: widthPx,
      height: heightPx,
    };
  };

  // Fly-out animation completed with the tile sitting in the modal's slot.
  // Nothing to do — the tile stays put until the user closes the modal.
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
    setFlight((prev) => (prev ? { ...prev, phase: "closing" } : prev));
  };

  // Closing flight has landed at home. Because parallax/lean/flip have
  // already been eased to 0 during the modal-open period, the flying
  // tile's resting geometry now matches the ring tile's pixel-perfectly.
  // Clear the flight state and let the ring tile take over with no fade,
  // no snap — just a seamless DOM handoff.
  const handleClosingComplete = () => {
    setFlight(null);
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
      // if the viewport was resized while the modal was open.
      setFlight((prev) => {
        if (!prev) return prev;
        return { ...prev, homeRect: computeHomeRect(prev.tileIndex) };
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

  // While any flight is active, the flown tile's key identifies the ring
  // tile that should stay hidden. When flight clears, the ring tile takes
  // over at the flying tile's exact final geometry — no fade needed.
  const hiddenRingKey = flight ? flight.tile.key : null;

  // Flip only enabled in the final ready state AND when no flight is in
  // progress — during flight, cursor interactions on ring tiles are paused.
  const flipEnabled = phase === "ready" && !prefersReducedMotion && !flight;

  return (
    <RingStateContext.Provider value={publicState}>
      <section
        aria-label="Home"
        className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 md:px-10"
        data-state={publicState}
      >
        {/* Ambient radial tint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(ellipse_at_center,var(--color-glass)_0%,transparent_62%)]"
        />

        {/* Center content (HomeHero). Fades in after entrance resolves. */}
        <div className="relative z-20 mx-auto flex max-w-3xl flex-col items-center text-center">
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
        {/* Ring container — tilts on X/Y (and a small Z) in response to the
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
                proximityEnabled={phase === "ready" && !prefersReducedMotion && !flight}
                radiusVmin={radius}
                mounted={mounted}
                prefersReducedMotion={!!prefersReducedMotion}
                flipEnabled={flipEnabled}
                cursorPx={cursorPx}
                cursorPy={cursorPy}
                onTileClick={handleTileClick}
              />
            );
          })}
        </motion.div>
        </div>
      </section>

      {flight && (
        <FlyingTile
          tile={flight.tile}
          homeRect={flight.homeRect}
          homeTangentDeg={flight.homeTangentDeg}
          homeRestRotX={flight.homeRestRotX}
          homeRestRotY={flight.homeRestRotY}
          sourceAngle={flight.sourceAngle}
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
  };
  transition: { duration: number; ease: Easing; delay?: number };
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
}: {
  phase: Phase;
  isFirst: boolean;
  seat: TargetSeat;
  staggerIndex: number;
  isShuffleTop: boolean;
}): TargetResult {
  if (phase === "hidden") {
    return {
      animate: { x: "0vmin", y: "0vmin", rotate: 0, scale: 0.92, opacity: 0 },
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
      },
      transition: { duration: 0.28, ease: EASE },
    };
  }
  if (phase === "stacking") {
    // The rest of the tiles flash in on top of the first.
    return {
      animate: { x: "0vmin", y: "0vmin", rotate: 0, scale: 1, opacity: 1 },
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
        rotate: isShuffleTop ? (staggerIndex % 2 === 0 ? 5 : -5) : 0,
        scale: isShuffleTop ? 1.04 : 1,
        opacity: 1,
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
      animate: { x: xs, y: ys, rotate: rotates, scale: 1, opacity: 1 },
      transition: {
        duration: TILE_FAN_DURATION_MS / 1000,
        ease: "linear", // decelerate is baked into the sample spacing above
        delay: (staggerIndex * TILE_FAN_STAGGER_MS) / 1000,
      },
    };
  }

  // ready — tiles rest at their seats with full tangent rotation. Scalar (not
  // keyframe) values so the resting transform is a single static state that the
  // proximity lean and the FlyingTile shared-element handoff can read exactly.
  return {
    animate: {
      x: `${seat.xVmin}vmin`,
      y: `${seat.yVmin}vmin`,
      rotate: seat.rotate,
      scale: 1,
      opacity: 1,
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
  flipEnabled: boolean;
  cursorPx: MotionValue<number>;
  cursorPy: MotionValue<number>;
  onTileClick: (
    payload: TileActivatePayload,
    tileIndex: number,
    sourceAngle: number,
    tile: HomeTileEntry,
  ) => void;
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
  flipEnabled,
  cursorPx,
  cursorPy,
  onTileClick,
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

  // Capture the current flip angle and hand off to the parent's flight
  // orchestrator. The parent computes the home rect from seat geometry
  // (not from DOM getBoundingClientRect, which returns the axis-aligned
  // bbox of the rotated tile and would cause the flown tile to start with
  // a distorted aspect ratio).
  const handleActivate = (payload: TileActivatePayload) => {
    const angle = flipRotateY.get();
    onTileClick(payload, tileIndex, angle, tile);
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
      const px = cursorPx.get();
      const py = cursorPy.get();
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
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const vmin = Math.min(vw, vh);
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
      // tiles around it — neighbors at mid-distance — tilt away from the
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

    // Compute now + whenever cursor changes.
    compute();
    const unsubX = cursorPx.on("change", compute);
    const unsubY = cursorPy.on("change", compute);
    return () => {
      unsubX();
      unsubY();
    };
  }, [proximityEnabled, cursorPx, cursorPy, seat.xVmin, seat.yVmin, radiusVmin, leanX, leanY, leanRot, leanScale, flipRotateXRaw, flipRotateYRaw, baselineRotX, baselineRotY]);

  return (
    <div
      className="absolute left-1/2 top-1/2 h-0 w-0"
      style={{ zIndex }}
    >
      <motion.div
        initial={{
          x: "0vmin",
          y: "0vmin",
          rotate: 0,
          scale: 0.92,
          opacity: 0,
        }}
        animate={target.animate}
        transition={target.transition}
        style={{
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
        className="pointer-events-auto will-change-transform"
      >
        {/* Inner wrapper carries the proximity lean so it composes on top of
            the seat transform without fighting Framer's animate prop. */}
        <motion.div
          style={{
            x: smoothLeanX,
            y: smoothLeanY,
            rotate: smoothLeanRot,
            scale: smoothLeanScale,
          }}
          className="h-full w-full will-change-transform"
        >
          <GlassTile
            tile={tile}
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

