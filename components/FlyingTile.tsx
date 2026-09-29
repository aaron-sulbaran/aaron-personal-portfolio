"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { photoBySrc, workItemBySlug, type HomeTile } from "@/lib/content";
import { MODAL_DISMISS_HOLD, MODAL_DISMISS_RAMP } from "@/lib/modal";
import type { Quad } from "@/lib/coil/geometry";
import { fitAspect, flightQuad, homography, matrix3d, rectQuad, type Face } from "@/lib/coil/flight";
import { siteEase } from "@/lib/coil/motion";
import { COIL } from "@/lib/coil/constants";
import { cardPhotoInset } from "@/lib/coil/cardFace";

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
  /** Resting X rotation of the ring tile (collapse arc rotX; 0 at focus). */
  homeRestRotX: number;
  /** Resting Y rotation of the ring tile (0; cards rest flat). */
  homeRestRotY: number;
  /** Captured live transform of the clicked tile, for first-frame fidelity. */
  source: FlightSource;
  /**
   * Initial guess for the modal-slot rect (TileRing passes the home rect; the
   * modal has not laid out yet at flight start). The REAL slot is tracked
   * internally every frame (see the slot-tracking effect) so per-frame rect
   * updates re-render only this small clone subtree, never the 20-tile ring.
   */
  target: FlightTarget;
  phase: FlightPhase;
  /**
   * Photo flights clear their frost to true color once parked in the modal
   * (set by TileRing after the out flight lands, reset before the close flight).
   * Work flights ignore this and stay tinted glass throughout, matching the deck
   * and the mobile work modal.
   */
  revealed?: boolean;
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
  revealed = false,
  onFlyOutComplete,
  onClosingComplete,
}: Props) {
  const prefersReducedMotion = useReducedMotion();

  // Live modal-slot rect. The slot must be TRACKED, not measured once: the
  // modal panel plays an entrance tween (y: 16 -> 0, scale: 0.97 -> 1), so a
  // single measurement a frame after mount captures the slot mid-entrance and
  // the tile lands on a transient position that is wrong by the time the
  // panel settles. So we re-read every frame until the rect holds still
  // (entrance done), with a hard time cap so a stalled layout never loops
  // forever; a resize re-arms tracking. The query is scoped to the active
  // modal's slot so a sibling modal still exiting (cross-fade) can never be
  // measured by mistake. This state lives HERE, not in TileRing's flight
  // state, so the per-frame updates during the modal entrance re-render only
  // this clone, not the whole ring (TileRing owns homeRect/phase/reveal).
  const [slotRect, setSlotRect] = useState<FlightTarget>(target);
  useEffect(() => {
    if (phase !== "out") return;
    const which = tile.kind === "photo" ? "photo" : "work";
    const selector = `[data-tile-slot="${which}"]`;

    let raf = 0;
    let startTs = 0;
    let stableFrames = 0;
    let last: FlightTarget | null = null;

    const same = (a: FlightTarget, b: FlightTarget) =>
      Math.abs(a.left - b.left) < 0.5 &&
      Math.abs(a.top - b.top) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 &&
      Math.abs(a.height - b.height) < 0.5;

    const track = (ts: number) => {
      if (!startTs) startTs = ts;
      const slot = document.querySelector<HTMLDivElement>(selector);
      if (slot) {
        const rect = slot.getBoundingClientRect();
        const next: FlightTarget = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
        if (last && same(next, last)) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
          last = next;
          setSlotRect(next);
        }
      }
      if (stableFrames < 4 && ts - startTs < 900) {
        raf = requestAnimationFrame(track);
      }
    };
    raf = requestAnimationFrame(track);

    const onResize = () => {
      startTs = 0;
      stableFrames = 0;
      last = null;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(track);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [phase, tile.kind]);

  // Closing flight: take one fresh synchronous measurement of the slot before
  // the exit reads slotRect. The "out" tracking above stops once the rect holds
  // still, so a late shift (slow image decode, entrance settling past the 900ms
  // cap) could otherwise start the close flight from a stale rect. In the
  // un-shifted common case this reads the identical rect, so it is a no-op.
  useLayoutEffect(() => {
    if (phase !== "closing") return;
    const which = tile.kind === "photo" ? "photo" : "work";
    const slot = document.querySelector<HTMLDivElement>(`[data-tile-slot="${which}"]`);
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    setSlotRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  }, [phase, tile.kind]);

  const resolved = resolveTile(tile);
  if (!resolved) return null;

  const isClosing = phase === "closing";

  // The flown card wears the deck's frosted-glass material so the deck <-> flight
  // handoff is frosted-to-frosted (no color pop). Only photos defrost: once
  // parked in the modal they clear to true color (revealed), and re-frost before
  // the close flight. Work logos stay tinted glass everywhere.
  const frosted = !(revealed && resolved.kind === "photo");

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
          x: slotRect.left,
          y: slotRect.top,
          width: slotRect.width,
          height: slotRect.height,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onAnimationComplete={() => {
          if (phase === "out") onFlyOutComplete();
          if (phase === "closing") onClosingComplete();
        }}
      >
        <FlyingFaces resolved={resolved} frosted={frosted} />
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

  // Open: fly from the ring seat into the modal slot (the surfacing gesture, kept
  // as-is). Close: DISSOLVE. Flying a translucent card all the way back across
  // the translucent deck made overlapping glass panes read as clipping, so
  // instead the card travels MOST of the way toward its slot (CLOSE_DRIFT) and
  // then fades out only over the back third, as it nears home and is small. The
  // whole return happens behind the modal frost, which TileRing's photo/work
  // modals HOLD then clear on dismiss (lib/modal MODAL_DISMISS_HOLD/RAMP) so the
  // deck stays masked while the card crosses it and resolves to sharp right as
  // the card dissolves into its slot. homeRect is the resolved (peeked/deck) slot.
  const CLOSE_DRIFT = 0.85; // fraction of the way home the card travels before it's gone
  const animate = isClosing
    ? {
        x: slotRect.left + (homeRect.left - slotRect.left) * CLOSE_DRIFT,
        y: slotRect.top + (homeRect.top - slotRect.top) * CLOSE_DRIFT,
        width: slotRect.width + (homeRect.width - slotRect.width) * CLOSE_DRIFT,
        height: slotRect.height + (homeRect.height - slotRect.height) * CLOSE_DRIFT,
        rotateX: homeRestRotX * CLOSE_DRIFT,
        rotateY: homeRestRotY * CLOSE_DRIFT,
        rotateZ: normalizedTangent * CLOSE_DRIFT,
        opacity: 0,
      }
    : {
        x: slotRect.left,
        y: slotRect.top,
        width: slotRect.width,
        height: slotRect.height,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
      };

  const transition = isClosing
    ? {
        duration: 0.46,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        // Hold full opacity while the frost still masks the deck, then
        // dissolve over the back third as the frost clears. Imported from
        // lib/modal so a retune of the frost timing can never desync the
        // dissolve from the mask.
        opacity: {
          delay: MODAL_DISMISS_HOLD,
          duration: MODAL_DISMISS_RAMP,
          ease: "easeInOut" as const,
        },
      }
    : { duration: 0.52, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

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
      <FlyingFaces resolved={resolved} frosted={frosted} />
    </motion.div>
  );
}

type ResolvedTile =
  | { kind: "photo"; src: string; alt: string }
  | { kind: "work"; logo: string; title: string };

function resolveTile(tile: HomeTile): ResolvedTile | null {
  if (tile.kind === "photo") {
    const photo = photoBySrc.get(tile.src);
    if (!photo) return null;
    return { kind: "photo", src: photo.src, alt: photo.alt };
  }
  const workItem = workItemBySlug.get(tile.slug);
  if (!workItem) return null;
  return { kind: "work", logo: workItem.logo, title: workItem.title };
}

// Frosted-glass material, lifted from GlassTile so the flown card reads as the
// SAME pane as the deck tile (no drift at the handoff): a soft diagonal sheen
// plus, on work cards, an accent-tinted wash.
const sheenStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 42%, rgba(255,255,255,0.04) 100%)",
};
const workTintStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
};

// One face of the flown card. It carries the deck tile's frosted-glass stack
// (translucent image + diagonal sheen + rim highlight, plus an accent tint on
// work cards), so every deck <-> flight handoff is frosted-to-frosted. `frosted`
// crossfades: a photo clears to true color once parked in the modal; the image
// goes 0.9 -> 1 opacity and the sheen/rim fade out. Work stays frosted always.
//
// NOTE: no backdrop-blur on either face. The translucent bg-glass-strong fill
// plus the covering image carry the glass read; a live blur would re-rasterize
// every frame of the flight for no payoff (modal-panel blur is separate).
function FlyingFace({
  resolved,
  faceShadow,
  frosted,
  back = false,
}: {
  resolved: ResolvedTile;
  faceShadow: string;
  frosted: boolean;
  back?: boolean;
}) {
  // Defrost (reveal) eases a touch slower so the photo "comes into focus"; the
  // re-frost on the way out is a hair quicker.
  const transition = { duration: frosted ? 0.22 : 0.34, ease: "easeOut" as const };
  const mirror = back ? "scale-x-[-1]" : "";
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-[10px] bg-glass-strong ${faceShadow} ring-1 ring-black/5 [backface-visibility:hidden] dark:ring-white/10 ${
        back ? "[transform:rotateY(180deg)]" : ""
      }`}
    >
      {resolved.kind === "work" && (
        <span aria-hidden="true" className="absolute inset-0" style={workTintStyle} />
      )}
      {/* Image/logo: muted to 0.9 like the deck tile when frosted, full color
          when revealed. */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ opacity: frosted ? 0.9 : 1 }}
        transition={transition}
      >
        {resolved.kind === "photo" ? (
          <Image
            src={resolved.src}
            alt=""
            fill
            sizes="(max-width: 768px) 90vw, 500px"
            className={`object-cover ${mirror}`}
            priority={!back}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3">
            <Image
              src={resolved.logo}
              alt=""
              width={240}
              height={240}
              className={`h-auto w-[78%] object-contain ${mirror}`}
              priority={!back}
            />
          </div>
        )}
      </motion.div>
      {/* Frosted-glass overlays (sheen + rim), faded out as the photo reveals. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{ opacity: frosted ? 1 : 0 }}
        transition={transition}
      >
        <span className="absolute inset-0" style={sheenStyle} />
        <span className="absolute inset-0 rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.14)]" />
      </motion.div>
    </div>
  );
}

function FlyingFaces({ resolved, frosted }: { resolved: ResolvedTile; frosted: boolean }) {
  const faceShadow =
    "shadow-[0_10px_28px_-16px_rgba(10,10,10,0.4),0_0_0_1px_rgba(255,255,255,0.18)_inset]";
  return (
    <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
      {/* Front face */}
      <FlyingFace resolved={resolved} faceShadow={faceShadow} frosted={frosted} />
      {/* Back face (mirrored), visible during keyboard-initiated flights */}
      <FlyingFace resolved={resolved} faceShadow={faceShadow} frosted={frosted} back />
    </div>
  );
}

// ---------------------------------------------------------------- the Coil's flight

// The Coil's shared-element flight: a curved card in the WebGL helix into the
// modal's [data-tile-slot] and back. The source contract is a projected quad
// (the card's four bent corners in viewport px, from the frozen scene) instead
// of a rect and three angles, and the clone draws the card's own painted front
// (and back, for a card seen from behind) instead of a DOM stand-in, so its
// first frame is the rendered card. One progress value runs the site ease;
// every frame the in-between quad becomes a matrix3d homography on a fixed 3:4
// box. The slot is tracked live on the way out (the panel tweens in), and the
// home quad is read from props on every frame of the way back, so a resize
// mid-flight still lands on the recomputed pose.
//
// Once parked, a photo lays a sharp copy of itself exactly over the painted
// one (the texture is 384px wide; the modal slot is larger), and takes it away
// before flying home.

export type CoilFlightProps = {
  kind: "photo" | "work";
  faces: { front: HTMLCanvasElement; back: HTMLCanvasElement };
  photoSrc?: string;
  source: Quad;
  home: Quad;
  phase: FlightPhase;
  revealed: boolean;
  // The clone is on screen: the scene hides the card's mesh now.
  onMounted: () => void;
  onFlyOutComplete: () => void;
  onClosingComplete: () => void;
};

const BOX_W = 300;
const BOX_H = BOX_W / COIL.cardAspect;
const FLIGHT_MS = 520;

function slotQuad(kind: "photo" | "work"): Quad | null {
  const slot = document.querySelector<HTMLElement>(`[data-tile-slot="${kind}"]`);
  if (!slot) return null;
  const r = slot.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return rectQuad(fitAspect({ left: r.left, top: r.top, width: r.width, height: r.height }, COIL.cardAspect));
}

export function CoilFlyingTile(props: CoilFlightProps) {
  const prefersReducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(props);
  const parkedRef = useRef<Quad | null>(null);
  const lastRef = useRef<Quad | null>(null);
  const [sharpLoaded, setSharpLoaded] = useState(false);

  useLayoutEffect(() => {
    liveRef.current = props;
  });

  const apply = (quad: Quad, face: Face) => {
    const root = rootRef.current;
    if (!root) return;
    lastRef.current = quad;
    const m = homography(quad, BOX_W, BOX_H);
    if (!m) {
      root.style.visibility = "hidden";
      return;
    }
    root.style.visibility = "visible";
    root.style.transform = matrix3d(m);
    if (frontRef.current) frontRef.current.style.display = face === "front" ? "block" : "none";
    if (backRef.current) backRef.current.style.display = face === "back" ? "block" : "none";
  };

  // Before paint on mount: copy the card's faces, sit exactly on the rendered
  // card, then let the scene hide its mesh, all in one frame.
  useLayoutEffect(() => {
    const { faces, source, onMounted } = liveRef.current;
    [
      [frontRef.current, faces.front],
      [backRef.current, faces.back],
    ].forEach(([target, face]) => {
      if (!target || !face) return;
      target.width = face.width;
      target.height = face.height;
      target.getContext("2d")?.drawImage(face, 0, 0);
    });
    apply(source, flightQuad(source, source, 0).face);
    onMounted();
  }, []);

  useEffect(() => {
    let raf = 0;
    let done = false;
    const duration = prefersReducedMotion ? 0 : FLIGHT_MS;
    const start = performance.now();
    const { kind, phase } = liveRef.current;
    // Home from wherever the clone is: parked in the slot, or still on its
    // way out when the modal closes early.
    const from = phase === "out" ? liveRef.current.source : (lastRef.current ?? liveRef.current.home);

    const step = (now: number) => {
      const live = liveRef.current;
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      const eased = siteEase(t);
      if (phase === "out") {
        const to = slotQuad(kind) ?? live.home;
        const { quad, face } = flightQuad(from, to, eased);
        apply(quad, face);
        if (t >= 1) {
          parkedRef.current = to;
          if (!done) {
            done = true;
            live.onFlyOutComplete();
          }
          return;
        }
      } else {
        const { quad, face } = flightQuad(from, live.home, eased);
        apply(quad, face);
        if (t >= 1) {
          if (!done) {
            done = true;
            live.onClosingComplete();
          }
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Parked in the modal: follow the slot through a resize.
    const onResize = () => {
      if (liveRef.current.phase !== "out" || !parkedRef.current) return;
      const to = slotQuad(kind);
      if (!to) return;
      parkedRef.current = to;
      apply(to, "front");
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [props.phase, prefersReducedMotion]);

  // The inset at the size the card was painted (the scene's render budget).
  const inset = cardPhotoInset([props.faces.front.width, props.faces.front.height]);
  const showSharp = props.revealed && props.kind === "photo" && sharpLoaded;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[55] origin-top-left will-change-transform"
      style={{ width: BOX_W, height: BOX_H, visibility: "hidden" }}
    >
      <canvas ref={frontRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={backRef} className="absolute inset-0 hidden h-full w-full [transform:scaleX(-1)]" />
      {props.kind === "photo" && props.photoSrc && (
        <div
          className="absolute overflow-hidden transition-opacity duration-300 [transition-timing-function:var(--ease-out)]"
          style={{
            left: `${inset.x * 100}%`,
            top: `${inset.y * 100}%`,
            right: `${inset.x * 100}%`,
            bottom: `${inset.y * 100}%`,
            borderRadius: inset.radius * BOX_W,
            opacity: showSharp ? 1 : 0,
          }}
        >
          <Image
            src={props.photoSrc}
            alt=""
            fill
            quality={90}
            sizes="(max-width: 768px) 92vw, 46vw"
            className="object-cover"
            style={{ objectPosition: inset.objectPosition }}
            onLoad={() => setSharpLoaded(true)}
          />
        </div>
      )}
    </div>
  );
}
