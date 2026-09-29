"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Quad } from "@/lib/coil/geometry";
import { fitAspect, flightQuad, homography, matrix3d, rectQuad, type Face } from "@/lib/coil/flight";
import { siteEase } from "@/lib/coil/motion";
import { COIL } from "@/lib/coil/constants";
import { cardPhotoInset } from "@/lib/coil/cardFace";
import { PHOTO_SLOT_SIZES } from "@/components/PhotoModal";

export type FlightPhase = "out" | "closing";

// The shared-element flight: a curved card in the WebGL helix into the
// modal's [data-tile-slot] and back. The source is a projected quad (the
// card's four bent corners in viewport px, from the frozen scene), and the
// clone draws the card's own painted front (and back, for a card seen from
// behind), so its first frame is the rendered card. One progress value runs the site ease;
// every frame the in-between quad becomes a matrix3d homography on a fixed 3:4
// box. The slot is tracked live on the way out (the panel tweens in), and the
// home quad is read from props on every frame of the way back, so a resize
// mid-flight still lands on the recomputed pose.
//
// Once parked, a photo lays a sharp copy of itself exactly over the painted
// one (the texture is 384px wide; the modal slot is larger), and takes it away
// before flying home.

export type FlyingTileProps = {
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

export function FlyingTile(props: FlyingTileProps) {
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
            sizes={PHOTO_SLOT_SIZES}
            className="object-cover"
            style={{ objectPosition: inset.objectPosition }}
            onLoad={() => setSharpLoaded(true)}
          />
        </div>
      )}
    </div>
  );
}
