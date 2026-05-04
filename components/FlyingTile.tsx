"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { siteContent, type HomeTile } from "@/lib/content";

export type FlightPhase = "out" | "closing";

export type FlightTarget = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  tile: HomeTile;
  homeRect: FlightTarget;
  homeTangentDeg: number;
  /** Baseline X rotation the ring tile rests at (non-zero, ±6°). */
  homeRestRotX: number;
  /** Baseline Y rotation the ring tile rests at (non-zero, ±6°). */
  homeRestRotY: number;
  /** Y-rotation (degrees) captured from the ring tile at click time. */
  sourceAngle: number;
  /** Modal-slot target rect (where the flight lands during "out"). */
  target: FlightTarget;
  phase: FlightPhase;
  onFlyOutComplete: () => void;
  onClosingComplete: () => void;
};

// Same DOM element across the entire ring-to-modal-to-ring journey.
//
// Geometry notes: the ring tile has both a tangent Z rotation (baked into
// its seat) and a proximity Y rotation (small ±degree lean). The FlyingTile's
// initial state matches BOTH so the first frame is visually identical to the
// ring tile at click time. It flies straight into the modal slot — rotateZ
// eases to 0 and rotateY eases from the small source lean to 0 without ever
// crossing ±90°, so the back face never shows. On closing it reverses back
// to the ring seat with the same direct path; the final frame matches the
// ring tile at rest pixel-for-pixel, so the DOM handoff is invisible.
export function FlyingTile({
  tile,
  homeRect,
  homeTangentDeg,
  homeRestRotX,
  homeRestRotY,
  sourceAngle,
  target,
  phase,
  onFlyOutComplete,
  onClosingComplete,
}: Props) {
  const resolved = resolveTile(tile);
  if (!resolved) return null;

  // Tiles on the lower-left half of the ring carry tangents in the 180–360°
  // range. Animating those numerically down to 0 sends the tile spinning the
  // long way around (e.g. 252°→0° = a 252° spin). Normalize to [-180, 180]
  // so Framer's linear rotation interpolation always takes the shorter arc.
  // Visually identical starting frame; just a different sign on the path.
  const normalizedTangent =
    ((homeTangentDeg + 180) % 360 + 360) % 360 - 180;

  const isClosing = phase === "closing";

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
        x: homeRect.left,
        y: homeRect.top,
        width: homeRect.width,
        height: homeRect.height,
        rotateX: homeRestRotX,
        rotateY: sourceAngle,
        // Match the ring tile's tangent Z rotation (normalized) so the
        // first frame is pixel-identical to the ring tile the user just
        // clicked, while ensuring the rotateZ→0 animation takes the
        // shorter arc.
        rotateZ: normalizedTangent,
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
        className={`absolute inset-0 overflow-hidden rounded-[10px] bg-glass-strong ${faceShadow} ring-1 ring-black/5 backdrop-blur-md [backface-visibility:hidden] dark:ring-white/10`}
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
      {/* Back face (mirrored) */}
      <div
        className={`absolute inset-0 overflow-hidden rounded-[10px] bg-glass-strong ${faceShadow} ring-1 ring-black/5 backdrop-blur-md [backface-visibility:hidden] [transform:rotateY(180deg)] dark:ring-white/10`}
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
