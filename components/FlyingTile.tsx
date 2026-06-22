"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { siteContent, type HomeTile } from "@/lib/content";

export type FlightPhase = "out" | "closing";

export type FlightTarget = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// Live transform of the ring tile at activation time, projected by TileRing
// into the flat fixed-position space the clone animates in. Keeping the
// first frame faithful to what the user saw (parallax tilt, proximity lean,
// flip rotation) is what makes the ring-to-clone handoff invisible.
export type FlightSource = {
  rect: FlightTarget;
  /** Parallax pitch plus the tile's live flip X rotation, in degrees. */
  rotX: number;
  /** Parallax yaw plus live flip Y rotation; 180 for keyboard-initiated flights. */
  rotY: number;
  /** Z rotation on top of the normalized seat tangent: lean roll plus parallax roll. */
  rotZDelta: number;
};

type Props = {
  tile: HomeTile;
  homeRect: FlightTarget;
  homeTangentDeg: number;
  /** Baseline X rotation the ring tile rests at (non-zero, a few degrees). */
  homeRestRotX: number;
  /** Baseline Y rotation the ring tile rests at (non-zero, a few degrees). */
  homeRestRotY: number;
  /** Captured live transform of the clicked tile, for first-frame fidelity. */
  source: FlightSource;
  /** Modal-slot target rect (where the flight lands during "out"). */
  target: FlightTarget;
  phase: FlightPhase;
  onFlyOutComplete: () => void;
  onClosingComplete: () => void;
};

// Same DOM element across the entire ring-to-modal-to-ring journey.
//
// Geometry notes: the initial state is the captured live transform of the
// clicked ring tile (seat tangent plus parallax tilt, proximity lean, and
// flip rotation), so the first frame is visually identical to the tile at
// click time. It flies straight into the modal slot with every rotation
// easing to 0; keyboard-initiated flights start at rotateY 180 and animate
// down through the mirrored back face the user was already looking at. On
// closing it reverses to the clean ring seat; by then TileRing has relaxed
// parallax and lean back to rest, so the final frame matches the ring tile
// pixel-for-pixel and the DOM handoff is invisible.
export function FlyingTile({
  tile,
  homeRect,
  homeTangentDeg,
  homeRestRotX,
  homeRestRotY,
  source,
  target,
  phase,
  onFlyOutComplete,
  onClosingComplete,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const resolved = resolveTile(tile);
  if (!resolved) return null;

  const isClosing = phase === "closing";

  // Reduced motion: no spatial flight. The clone fades in already sitting in
  // the modal slot (TileRing measures the slot a frame after the modal
  // mounts) and fades out in place on close; the ring tile reappears at its
  // seat when the flight clears.
  if (prefersReducedMotion) {
    return (
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[55]"
        style={{
          x: target.left,
          y: target.top,
          width: target.width,
          height: target.height,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onAnimationComplete={() => {
          if (phase === "out") onFlyOutComplete();
          if (phase === "closing") onClosingComplete();
        }}
      >
        <FlyingFaces resolved={resolved} />
      </motion.div>
    );
  }

  // Tiles on the lower-left half of the ring carry tangents in the 180-360
  // degree range. Animating those numerically down to 0 sends the tile
  // spinning the long way around (e.g. 252 to 0 is a 252 degree spin).
  // Normalize to [-180, 180] so Framer's linear rotation interpolation
  // always takes the shorter arc. Visually identical starting frame; just a
  // different sign on the path.
  const normalizedTangent =
    ((homeTangentDeg + 180) % 360 + 360) % 360 - 180;

  const animate = isClosing
    ? {
        x: homeRect.left,
        y: homeRect.top,
        width: homeRect.width,
        height: homeRect.height,
        rotateX: homeRestRotX,
        rotateY: homeRestRotY,
        rotateZ: normalizedTangent,
      }
    : {
        x: target.left,
        y: target.top,
        width: target.width,
        height: target.height,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
      };

  const transition = {
    duration: 0.52,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  };

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[55]"
      style={{ perspective: "1400px" }}
      initial={{
        x: source.rect.left,
        y: source.rect.top,
        width: source.rect.width,
        height: source.rect.height,
        rotateX: source.rotX,
        rotateY: source.rotY,
        rotateZ: normalizedTangent + source.rotZDelta,
      }}
      animate={animate}
      transition={transition}
      onAnimationComplete={() => {
        if (phase === "out") onFlyOutComplete();
        if (phase === "closing") onClosingComplete();
      }}
    >
      <FlyingFaces resolved={resolved} />
    </motion.div>
  );
}

type ResolvedTile =
  | { kind: "photo"; src: string; alt: string }
  | { kind: "work"; logo: string; title: string };

function resolveTile(tile: HomeTile): ResolvedTile | null {
  if (tile.kind === "photo") {
    const photo = siteContent.photos.find((p) => p.src === tile.src);
    if (!photo) return null;
    return { kind: "photo", src: photo.src, alt: photo.alt };
  }
  const workItem = siteContent.workItems.find((w) => w.slug === tile.slug);
  if (!workItem) return null;
  return { kind: "work", logo: workItem.logo, title: workItem.title };
}

// NOTE: no backdrop-blur on either face. The translucent bg-glass-strong
// fill plus the covering image carry the glass read; a live blur on the
// flying clone re-rasterizes every frame of the flight for no visible
// payoff (same reasoning as the ring tiles; modal-panel blur is separate
// and intentional).
function FlyingFaces({ resolved }: { resolved: ResolvedTile }) {
  const faceShadow =
    "shadow-[0_10px_28px_-16px_rgba(10,10,10,0.4),0_0_0_1px_rgba(255,255,255,0.18)_inset]";
  return (
    <div
      className="relative h-full w-full"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Front face */}
      <div
        className={`absolute inset-0 overflow-hidden rounded-[10px] bg-glass-strong ${faceShadow} ring-1 ring-black/5 [backface-visibility:hidden] dark:ring-white/10`}
      >
        {resolved.kind === "photo" ? (
          <Image
            src={resolved.src}
            alt=""
            fill
            sizes="(max-width: 768px) 90vw, 500px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3">
            <Image
              src={resolved.logo}
              alt=""
              width={240}
              height={240}
              className="h-auto w-[78%] object-contain"
              priority
            />
          </div>
        )}
      </div>
      {/* Back face (mirrored), visible during keyboard-initiated flights */}
      <div
        className={`absolute inset-0 overflow-hidden rounded-[10px] bg-glass-strong ${faceShadow} ring-1 ring-black/5 [backface-visibility:hidden] [transform:rotateY(180deg)] dark:ring-white/10`}
      >
        {resolved.kind === "photo" ? (
          <Image
            src={resolved.src}
            alt=""
            fill
            sizes="(max-width: 768px) 90vw, 500px"
            className="scale-x-[-1] object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3">
            <Image
              src={resolved.logo}
              alt=""
              width={240}
              height={240}
              className="h-auto w-[78%] scale-x-[-1] object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
