"use client";

import Image from "next/image";
import { motion, useMotionValue, type MotionValue } from "framer-motion";
import { photoBySrc, workItemBySlug, type HomeTile, type Photo, type WorkItem } from "@/lib/content";

type ResolvedTile =
  | { kind: "photo"; key: string; src: string; photo: Photo }
  | { kind: "work"; key: string; slug: WorkItem["slug"]; workItem: WorkItem };

export type TileActivatePayload =
  | { kind: "photo"; photo: Photo }
  | { kind: "work"; workItem: WorkItem };

type Props = {
  tile: HomeTile;
  /**
   * True during the entrance (pile + fan, before `ready`). The translucent pane
   * gets an opaque backing then, so the stacked/shuffling cards do not bleed
   * through one another. Once `ready`, the pane goes translucent again for the
   * deck/carousel layering.
   */
  entering: boolean;
  flipEnabled: boolean;
  /** Proximity-driven X rotation (degrees), driven by the parent TileSlot. */
  flipRotateX: MotionValue<number>;
  /** Proximity-driven Y rotation (degrees). */
  flipRotateY: MotionValue<number>;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /**
   * Multiplies every fixed-pixel glass cue (corner radius, rim highlight, float
   * shadow, ring border) so they survive a CSS transform scale-down. Both homes
   * lay the card out large and scale it DOWN (mobile ~0.2 via RING_SCALE with
   * detailScale ~2.5, desktop 0.3 via REST_SCALE with detailScale 10/3); a plain
   * 8px radius / 1px rim would shrink to ~1.6px / 0.2px and vanish, leaving a
   * bare sharp-cornered photo. detailScale keeps the radius/card ratio matched
   * to the 8px-on-9vmin design at every scale, since the ratio is scale
   * invariant. Defaults to 1 (the plain Tailwind path).
   */
  detailScale?: number;
  /**
   * keyboardFlipped is true when the focus-forced 180 degree flip is engaged
   * at activation time, so the flight clone can start from the back face the
   * user was actually looking at.
   */
  onActivate: (payload: TileActivatePayload, keyboardFlipped: boolean) => void;
  /**
   * True once the card has been explored (opened and closed at least once).
   * Fades a frost veil in over the pane so the photo/logo ghosts through
   * rather than reading fully clear anymore. Defaults to false so every
   * existing caller (MobileHome, and desktop before this prop existed) stays
   * pixel-identical; only the desktop ring/carousel passes it.
   */
  frosted?: boolean;
};


function resolveTile(tile: HomeTile): ResolvedTile | null {
  if (tile.kind === "photo") {
    const photo = photoBySrc.get(tile.src);
    if (!photo) return null;
    return { kind: "photo", key: tile.key, src: tile.src, photo };
  }
  const workItem = workItemBySlug.get(tile.slug);
  if (!workItem) return null;
  return { kind: "work", key: tile.key, slug: tile.slug, workItem };
}

// Small, silent indicator shown ONLY on work cards: a single dot, no text. It
// is the one quiet hint that a card opens a case study; photo cards carry no
// indicator at all. No "Photo"/"Work" labels anywhere (they competed with the
// image). The accessible name still lives on the button's aria-label.
function WorkDot() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-foreground/40"
    />
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
  entering,
  flipEnabled,
  flipRotateX,
  flipRotateY,
  buttonRef,
  detailScale = 1,
  onActivate,
  frosted = false,
}: Props) {
  const resolved = resolveTile(tile);

  // Tracks whether the button is keyboard-focused (focus-visible). It no longer
  // drives any visual flip: the card must NEVER rotate to its mirrored back face
  // (photos would read as flipped/mirrored), so the proximity springs are the
  // only thing that rotates the card. focusedMV is kept purely as the signal the
  // parent uses to decide whether to restore focus on modal close (keyboard yes,
  // tap no), which is what stops the focus ring from appearing on tap.
  const focusedMV = useMotionValue(0);

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
    // wasKeyboard: the activation came from a keyboard-focused button. The parent
    // uses it to restore focus on modal close only for keyboard users, so a tap
    // never leaves a focus ring on the card.
    const wasKeyboard = flipEnabled && focusedMV.get() > 0.5;
    if (resolved.kind === "photo") {
      onActivate({ kind: "photo", photo: resolved.photo }, wasKeyboard);
    } else {
      onActivate({ kind: "work", workItem: resolved.workItem }, wasKeyboard);
    }
  };

  // Track keyboard focus only (focus-visible). It no longer drives a flip; it is
  // just the signal the parent reads for focus restoration on modal close.
  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (!e.target.matches(":focus-visible")) return;
    focusedMV.set(1);
  };
  const handleBlur = () => {
    focusedMV.set(0);
  };

  // ----- Card material: a single translucent frosted-glass pane -----------
  // ONE cohesive entity (no front/back/edge box -> no doubling, no "second
  // panel"). The image lives INSIDE the pane at reduced opacity, so the card is
  // see-through and overlapping cards layer through one another (inkwell-style);
  // a soft diagonal sheen + a thin rim highlight give the frosted-glass read.
  // NO backdrop-filter: it re-rasterizes every frame across the 20 rotating ring
  // tiles and tanks FPS (Layer 2 perf note); the translucency carries the glass.
  // Glass cues are fixed-px, so they survive a CSS scale-down only if we scale
  // the pixels up first by detailScale (see the prop doc). detailScale === 1
  // keeps the exact Tailwind classes; any other value (both homes today) drops
  // to inline styles with multiplied pixels.
  const scaled = detailScale !== 1;
  const radiusPx = 8 * detailScale;
  const rimShadow = `inset 0 ${1 * detailScale}px 0 rgba(255,255,255,0.4), inset 0 0 0 ${
    1 * detailScale
  }px rgba(255,255,255,0.14)`;
  const floatShadow = `0 ${10 * detailScale}px ${30 * detailScale}px ${
    -14 * detailScale
  }px rgba(10,10,10,0.35)`;
  const ringShadow = `0 0 0 ${1 * detailScale}px rgba(255,255,255,0.22)`;
  const paneFloat = scaled
    ? ""
    : "shadow-[0_10px_30px_-14px_rgba(10,10,10,0.35)] ring-1 ring-white/25 dark:ring-white/15";
  // Soft diagonal sheen across the pane (light catching the glass).
  const sheenStyle: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 42%, rgba(255,255,255,0.04) 100%)",
  };
  // Work cards: a faint accent-tinted glass wash + the logo, embedded in the same
  // translucent pane (no separate panel). Tokens only via color-mix.
  const workTintStyle: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
  };
  // Explored-state frost veil (ring-arc redesign, plan §3 + §7 boundary point
  // 3). Always mounted so `opacity` can transition both ways; `backdropFilter`
  // itself only turns on once `frosted` is true, which keeps the per-frame
  // compositing cost scoped to already-explored cards instead of all 20 ring
  // tiles. AGENTS.md bans backdrop-filter on ring tiles (it re-rasterizes
  // every frame while the ring/carousel rotates) -- this is a deliberate,
  // plan-sanctioned exception: see
  // docs/plans/Desktop card redesign exploration/ring-arc-carousel-implementation-plan.md
  // §7 (boundary point 3), which relies on the blur so the background
  // waveform shows through frosted cards.
  const veilStyle: React.CSSProperties = {
    ...(scaled ? { borderRadius: radiusPx } : {}),
    backgroundColor: "color-mix(in srgb, var(--color-background) 58%, transparent)",
    backdropFilter: frosted ? "blur(7px) saturate(0.75)" : "none",
    WebkitBackdropFilter: frosted ? "blur(7px) saturate(0.75)" : "none",
    opacity: frosted ? 1 : 0,
    transition: "opacity 700ms ease",
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-cursor-hover
      aria-label={ariaLabel}
      style={scaled ? { borderRadius: radiusPx } : undefined}
      className="group relative block h-full w-full rounded-[8px] [transform-style:preserve-3d] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* One translucent glass pane. overflow-hidden clips the embedded image to
          the rounded corners; it cannot coexist with preserve-3d (overflow forces
          a flatten), and the card no longer needs 3D depth of its own, the parent
          chain still tilts it in the stage perspective. */}
      <motion.div
        style={{
          rotateX: flipRotateX,
          rotateY: flipRotateY,
          ...(scaled
            ? { borderRadius: radiusPx, boxShadow: `${floatShadow}, ${ringShadow}` }
            : {}),
        }}
        className={`relative h-full w-full overflow-hidden rounded-[8px] ${paneFloat} ${
          entering ? "bg-background" : ""
        }`}
      >
        {resolved.kind === "photo" ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            quality={88}
            sizes="(max-width: 768px) 62vw, 26vw"
            className="object-cover opacity-[0.9]"
          />
        ) : (
          <>
            <span aria-hidden="true" className="absolute inset-0" style={workTintStyle} />
            <div className="absolute inset-0 flex items-center justify-center p-[12%]">
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={120}
                height={120}
                className="h-auto w-[86%] object-contain opacity-90"
              />
            </div>
          </>
        )}
        {/* Glass sheen across the pane. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={sheenStyle} />
        {/* Thin rim highlight = the glass pane edge. */}
        <span
          aria-hidden="true"
          style={scaled ? { borderRadius: radiusPx, boxShadow: rimShadow } : undefined}
          className="pointer-events-none absolute inset-0 rounded-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
        />
        {resolved.kind === "work" && <WorkDot />}
        {/* Frost veil: topmost layer in the pane, nothing paints above it. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[8px]" style={veilStyle} />
      </motion.div>
    </button>
  );
}
