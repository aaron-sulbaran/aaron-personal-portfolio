"use client";

import Image from "next/image";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { siteContent, type HomeTile, type Photo, type WorkItem } from "@/lib/content";

type ResolvedTile =
  | { kind: "photo"; key: string; src: string; photo: Photo }
  | { kind: "work"; key: string; slug: WorkItem["slug"]; workItem: WorkItem };

export type TileActivatePayload =
  | { kind: "photo"; photo: Photo }
  | { kind: "work"; workItem: WorkItem };

type Props = {
  tile: HomeTile;
  flipEnabled: boolean;
  /** Proximity-driven X rotation (degrees), driven by the parent TileSlot. */
  flipRotateX: MotionValue<number>;
  /** Proximity-driven Y rotation (degrees). */
  flipRotateY: MotionValue<number>;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /**
   * keyboardFlipped is true when the focus-forced 180 degree flip is engaged
   * at activation time, so the flight clone can start from the back face the
   * user was actually looking at.
   */
  onActivate: (payload: TileActivatePayload, keyboardFlipped: boolean) => void;
};

// Card thickness in px. The front/back faces are pushed ±THICKNESS/2 along
// Z and four edge strips fill the gap so the card reads as a 3D glass
// object instead of flat paper. Kept subtle (5px) so the ring doesn't feel
// chunky.
const THICKNESS_PX = 5;

function resolveTile(tile: HomeTile): ResolvedTile | null {
  if (tile.kind === "photo") {
    const photo = siteContent.photos.find((p) => p.src === tile.src);
    if (!photo) return null;
    return { kind: "photo", key: tile.key, src: tile.src, photo };
  }
  const workItem = siteContent.workItems.find((w) => w.slug === tile.slug);
  if (!workItem) return null;
  return { kind: "work", key: tile.key, slug: tile.slug, workItem };
}

function KindMark({ kind }: { kind: "photo" | "work" }) {
  const glyph = kind === "photo" ? "○" : "▸";
  const label = kind === "photo" ? "Photo" : "Work";
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 text-[9px] font-medium uppercase tracking-caps text-muted"
    >
      <span className="opacity-0 transition-opacity duration-200 group-hover:opacity-80 group-focus-visible:opacity-80">
        {label}
      </span>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-background/70 leading-none">
        {glyph}
      </span>
    </span>
  );
}

// A single tile in the ring. Instead of a paper-thin flat card, the tile is
// a 3D box: front + back faces pushed apart by THICKNESS_PX along Z, and
// four thin glass strips filling the gap around the rim. When the card
// tilts (from proximity lean / hover interaction), viewers see the glass
// edge catch light and the tile reads as a physical object.
//
// The card never fully flips; proximity drives X/Y rotations in the
// ±30° range, which keeps text and imagery legible while still signaling
// 3D depth. Focus-visible forces a full 180° Y rotation so keyboard users
// still see the reveal gesture.
export function GlassTile({
  tile,
  flipEnabled,
  flipRotateX,
  flipRotateY,
  buttonRef,
  onActivate,
}: Props) {
  const resolved = resolveTile(tile);

  const focusedMV = useMotionValue(0);

  // The spring-smoothed proximity values pass through untouched; the parent
  // TileSlot relaxes the raw values when interaction is disabled, so the
  // springs (not a hard 0 here) carry every transition and flight start/end
  // never snaps the tilt. Keyboard focus forces the reveal flip on Y only.
  const effectiveRotateX = useTransform<number, number>(
    [flipRotateX, focusedMV],
    ([v, f]) => {
      if (flipEnabled && (f as number) > 0.5) return 0;
      return v as number;
    },
  );

  const effectiveRotateY = useTransform<number, number>(
    [flipRotateY, focusedMV],
    ([v, f]) => {
      if (flipEnabled && (f as number) > 0.5) return 180;
      return v as number;
    },
  );

  if (!resolved) return null;

  const imageSrc = resolved.kind === "photo" ? resolved.photo.src : resolved.workItem.logo;
  const imageAlt =
    resolved.kind === "photo"
      ? resolved.photo.alt
      : `${resolved.workItem.title} logo`;
  // Work labels start with the tile's visible text (the logo's title) so the
  // accessible name contains it; Lighthouse flags label-content-name-mismatch
  // otherwise. Photo labels stay descriptive.
  const ariaLabel =
    resolved.kind === "photo"
      ? `Open caption for ${resolved.photo.alt}`
      : `${resolved.workItem.title} logo, open preview, ${resolved.workItem.role}`;

  const handleClick = () => {
    const keyboardFlipped = flipEnabled && focusedMV.get() > 0.5;
    if (resolved.kind === "photo") {
      onActivate({ kind: "photo", photo: resolved.photo }, keyboardFlipped);
    } else {
      onActivate({ kind: "work", workItem: resolved.workItem }, keyboardFlipped);
    }
  };

  // Only fire the 180° reveal flip for keyboard focus. Mouse clicks also
  // focus the button in Chrome/Firefox, which would otherwise spin the tile
  // through its mirrored back face right as the click-to-modal flight
  // begins (causing a visible mirror flash on every card click).
  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (!e.target.matches(":focus-visible")) return;
    focusedMV.set(1);
  };
  const handleBlur = () => {
    focusedMV.set(0);
  };

  // Face surface (front + back): glass, tight corners, subtle inner
  // hairline + shadow. Edges reuse the same bg-glass-strong so the rim
  // reads as the same material as the faces.
  // NOTE: no backdrop-blur here. Each tile face + its 4 edges previously ran
  // `backdrop-blur-md` (14 tiles x 6 = 84 live blur layers), all inside the
  // ring's rotating preserve-3d context, so every one re-rasterized per frame.
  // The blur was effectively invisible anyway: bg-glass-strong is ~78% opaque
  // and the face is covered by an object-cover image, so it cost enormous GPU
  // fill rate for no visible payoff. The translucent fill + inset highlight +
  // ring below carry the glass read on their own. (Modal backdrops still blur;
  // those are on-open only, not per-frame.)
  const faceShadow =
    "shadow-[0_10px_28px_-16px_rgba(10,10,10,0.4),0_0_0_1px_rgba(255,255,255,0.18)_inset]";
  const faceBase = `overflow-hidden rounded-[10px] bg-glass-strong ${faceShadow} ring-1 ring-black/5 dark:ring-white/10`;
  const edgeBase = `rounded-[2px] bg-glass-strong shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]`;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-cursor-hover
      aria-label={ariaLabel}
      className="group relative block h-full w-full rounded-[10px] [perspective:1200px] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <motion.div
        style={{
          rotateX: effectiveRotateX,
          rotateY: effectiveRotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative h-full w-full"
      >
        {/* Front face: pushed forward by THICKNESS/2 */}
        <div
          className={`absolute inset-0 ${faceBase} [backface-visibility:hidden]`}
          style={{ transform: `translateZ(${THICKNESS_PX / 2}px)` }}
        >
          {resolved.kind === "photo" ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 768px) 13vmin, 11vmin"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3">
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={120}
                height={120}
                className="h-auto w-[78%] object-contain"
              />
            </div>
          )}
          <KindMark kind={resolved.kind} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
          />
        </div>

        {/* Back face: pushed back (rotateY(180) then translateZ out so it
            sits at z = -THICKNESS/2 in the parent frame). */}
        <div
          className={`absolute inset-0 ${faceBase} [backface-visibility:hidden]`}
          style={{ transform: `rotateY(180deg) translateZ(${THICKNESS_PX / 2}px)` }}
        >
          {resolved.kind === "photo" ? (
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(max-width: 768px) 13vmin, 11vmin"
              className="scale-x-[-1] object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3">
              <Image
                src={imageSrc}
                alt=""
                width={120}
                height={120}
                className="h-auto w-[78%] scale-x-[-1] object-contain"
              />
            </div>
          )}
          <KindMark kind={resolved.kind} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
          />
        </div>

        {/* Right edge */}
        <div
          aria-hidden="true"
          className={`absolute top-0 ${edgeBase}`}
          style={{
            right: 0,
            width: `${THICKNESS_PX}px`,
            height: "100%",
            transform: `translateX(${THICKNESS_PX / 2}px) rotateY(90deg)`,
          }}
        />
        {/* Left edge */}
        <div
          aria-hidden="true"
          className={`absolute top-0 ${edgeBase}`}
          style={{
            left: 0,
            width: `${THICKNESS_PX}px`,
            height: "100%",
            transform: `translateX(-${THICKNESS_PX / 2}px) rotateY(-90deg)`,
          }}
        />
        {/* Top edge */}
        <div
          aria-hidden="true"
          className={`absolute left-0 ${edgeBase}`}
          style={{
            top: 0,
            width: "100%",
            height: `${THICKNESS_PX}px`,
            transform: `translateY(-${THICKNESS_PX / 2}px) rotateX(90deg)`,
          }}
        />
        {/* Bottom edge */}
        <div
          aria-hidden="true"
          className={`absolute left-0 ${edgeBase}`}
          style={{
            bottom: 0,
            width: "100%",
            height: `${THICKNESS_PX}px`,
            transform: `translateY(${THICKNESS_PX / 2}px) rotateX(-90deg)`,
          }}
        />
      </motion.div>
    </button>
  );
}
