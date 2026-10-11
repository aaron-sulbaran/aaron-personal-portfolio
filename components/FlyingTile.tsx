"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Quad } from "@/lib/coil/geometry";
import { homography, matrix3d, type Rect } from "@/lib/coil/flight";
import { siteEase } from "@/lib/coil/motion";
import { COIL } from "@/lib/coil/constants";
import { cardPhotoInset } from "@/lib/coil/cardFace";
import { CARD_PICTURE_SIZES } from "@/lib/photoSizes";
import { flightProbe } from "@/lib/coil/flightProbe";
import { carryTransform, followable } from "@/lib/coil/scrollFollow";
import type { CoilFlightHandle, CoilSceneApi } from "@/components/coil/CoilScene";

export type FlightPhase = "out" | "closing";

// The shared-element flight: a curved card in the WebGL helix into the
// modal's [data-tile-slot] and back. The flown card is the mesh itself: the
// scene draws the clicked card, with the card shader, into a canvas mounted
// here above the modal, so the frame the mesh hides and the frame it shows
// again are the same pixels (its bend, its shading, its lift, the cards that
// cover it). This component owns the clock and the layer: one progress value
// runs the site ease, and every frame the scene draws the card at that
// progress between its seat and the slot, flattening the bend and releasing
// the shading on the way. The slot is tracked live on the way out (the panel
// tweens in) and while parked (a resize, the dialog scrolling); the seat is
// read from the frozen scene on every frame, so a resize still lands.
//
// Parked in a dialog that scrolls, the card is drawn again where the slot has
// gone, but only a frame after the compositor moved the slot. So the layer
// also carries a scroll-driven animation (app/globals.css, lib/coil/scrollFollow.ts)
// that moves it with the dialog in the same frame; the card is still the scene's
// own render, only its layer moves. Where the browser has no scroll-driven
// animations the redraw alone follows.
//
// Once parked, a photo lays a sharp copy of itself exactly over the painted
// one (the texture is 384px wide; the modal slot is larger), and takes it away
// as the card leaves.

export type FlyingTileProps = {
  kind: "photo" | "work";
  slot: number;
  scene: RefObject<CoilSceneApi | null>;
  photoSrc?: string;
  phase: FlightPhase;
  revealed: boolean;
  onFlyOutComplete: () => void;
  onClosingComplete: () => void;
  // The scene cannot fly this card: the modal draws its own media.
  onUnavailable: () => void;
};

const BOX_W = 300;
const BOX_H = BOX_W / COIL.cardAspect;
const FLIGHT_MS = 520;
// The sharp copy comes in as the card settles and is gone before the card
// has bent again on its way home.
const SHARP_IN_MS = 300;
const SHARP_OUT_MS = 110;

// The slot's box and the scroll offset of the dialog it sits in, read together.
function slotRead(kind: "photo" | "work"): { rect: Rect | null; scroll: number } {
  const slot = document.querySelector<HTMLElement>(`[data-tile-slot="${kind}"]`);
  if (!slot) return { rect: null, scroll: 0 };
  const r = slot.getBoundingClientRect();
  const scroll = slot.closest<HTMLElement>("[data-card-modal]")?.scrollTop ?? 0;
  if (r.width <= 0 || r.height <= 0) return { rect: null, scroll };
  return { rect: { left: r.left, top: r.top, width: r.width, height: r.height }, scroll };
}

export function FlyingTile(props: FlyingTileProps) {
  const prefersReducedMotion = useReducedMotion();
  const mountRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<HTMLDivElement>(null);
  const carryRef = useRef<HTMLDivElement>(null);
  const sharpRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CoilFlightHandle | null>(null);
  const progressRef = useRef(0);
  const liveRef = useRef(props);
  const [sharpLoaded, setSharpLoaded] = useState(false);

  useLayoutEffect(() => {
    liveRef.current = props;
  });

  // Before paint on mount: the scene draws the card on its seat in the flown
  // canvas, then hides its mesh, in one frame.
  useLayoutEffect(() => {
    const mount = mountRef.current;
    const { scene, slot, onUnavailable } = liveRef.current;
    const handle = mount ? (scene.current?.beginFlight(slot, mount) ?? null) : null;
    handleRef.current = handle;
    if (!handle) {
      onUnavailable();
      return;
    }
    return () => {
      handle.abort();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    let raf = 0;
    let done = false;
    const duration = prefersReducedMotion ? 0 : FLIGHT_MS;
    // The flight's own clock: real time, which ?coildebug=flight can hold.
    const probe = flightProbe();
    let elapsed = 0;
    let last = performance.now();
    let parkedAt = "";
    let following = false;
    let first = true;
    const { kind, phase } = liveRef.current;
    // Home from wherever the card is: parked in the slot, or still on its
    // way out when the modal closes early.
    const from = progressRef.current;
    probe?.mark("flight-start", { phase, from });

    // The sharp copy rides the card's four corners.
    const place = (quad: Quad | null) => {
      const sharp = sharpRef.current;
      if (!sharp) return;
      const m = quad ? homography(quad, BOX_W, BOX_H) : null;
      sharp.style.visibility = m ? "visible" : "hidden";
      if (m) sharp.style.transform = matrix3d(m);
    };
    // The layer rides the dialog's scroll on the compositor from here, and
    // carries the offset the card was drawn at. A browser whose animation did
    // not take the dialog's timeline keeps the redraw alone.
    const stopFollowing = () => {
      following = false;
      const follow = followRef.current;
      if (follow) delete follow.dataset.following;
      if (carryRef.current) carryRef.current.style.transform = "";
    };
    const startFollowing = (scroll: number) => {
      const follow = followRef.current;
      const carry = carryRef.current;
      if (!follow || !carry) return;
      follow.dataset.following = "true";
      const ScrollTimelineType = (window as unknown as { ScrollTimeline?: abstract new () => AnimationTimeline }).ScrollTimeline;
      const supported = ScrollTimelineType !== undefined;
      const attached = supported && follow.getAnimations().some((animation) => animation.timeline instanceof ScrollTimelineType);
      if (!followable(supported, attached)) return stopFollowing();
      following = true;
      carry.style.transform = carryTransform(scroll);
    };
    if (phase === "closing") handle.close();
    const lost = () => {
      cancelAnimationFrame(raf);
      liveRef.current.onUnavailable();
    };

    const step = (now: number) => {
      const live = liveRef.current;
      const dt = Math.max(0, now - last) / 1000;
      elapsed += dt * 1000 * (probe ? probe.rate : 1);
      last = now;
      const t = duration ? Math.min(1, elapsed / duration) : 1;
      const eased = siteEase(t);
      if (phase === "out") {
        const { rect, scroll } = slotRead(kind);
        if (!done) {
          const e = from + (1 - from) * eased;
          progressRef.current = e;
          const quad = handle.draw(e, rect, dt);
          if (!quad) return lost();
          place(quad);
          probe?.mark("clone-frame", { phase, t, quad, face: "front" });
          if (t >= 1) {
            done = true;
            handle.arrive();
            startFollowing(scroll);
            probe?.mark("clone-parked", { quad });
            live.onFlyOutComplete();
          }
        } else {
          // Parked: the card follows its slot.
          const at = rect ? [rect.left, rect.top, rect.width, rect.height, scroll, handle.stamp()].join(",") : "";
          if (at !== parkedAt) {
            parkedAt = at;
            const quad = handle.draw(1, rect, dt);
            if (!quad) return lost();
            place(quad);
            if (following && carryRef.current) carryRef.current.style.transform = carryTransform(scroll);
          }
        }
      } else {
        const e = t >= 1 ? 0 : from * (1 - eased);
        progressRef.current = e;
        // The slot end of the path holds where the card left it (the panel
        // is on its way out): the slot as it is on the first frame home, after
        // any scrolling.
        if (first) stopFollowing();
        const quad = handle.draw(e, first ? slotRead(kind).rect : null, dt);
        first = false;
        if (!quad) return lost();
        place(quad);
        probe?.mark("clone-frame", { phase, t, quad, face: "front" });
        if (t >= 1 && !probe?.holdLanding) {
          if (!done) {
            done = true;
            handle.land();
            live.onClosingComplete();
          }
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [props.phase, prefersReducedMotion]);

  // The inset at the size the card was painted (the scene's render budget).
  const inset = cardPhotoInset(COIL.lab.textureSize);
  const showSharp = props.revealed && props.kind === "photo" && sharpLoaded;

  return (
    <div aria-hidden="true" data-flying-tile="" className="pointer-events-none fixed inset-0 z-[55]">
      <div ref={followRef} data-flying-follow="" className="absolute inset-0">
        <div ref={carryRef} className="absolute inset-0">
          <div ref={mountRef} />
          {props.kind === "photo" && props.photoSrc && (
            <div
              ref={sharpRef}
              className="fixed left-0 top-0 origin-top-left will-change-transform"
              style={{ width: BOX_W, height: BOX_H, visibility: "hidden" }}
            >
              <div
                className="absolute overflow-hidden transition-opacity [transition-timing-function:var(--ease-out)]"
                style={{
                  left: `${inset.x * 100}%`,
                  top: `${inset.y * 100}%`,
                  right: `${inset.x * 100}%`,
                  bottom: `${inset.y * 100}%`,
                  borderRadius: inset.radius * BOX_W,
                  opacity: showSharp ? 1 : 0,
                  transitionDuration: `${showSharp ? SHARP_IN_MS : SHARP_OUT_MS}ms`,
                }}
              >
                <Image
                  src={props.photoSrc}
                  alt=""
                  fill
                  quality={90}
                  sizes={CARD_PICTURE_SIZES}
                  className="object-cover"
                  style={{ objectPosition: inset.objectPosition }}
                  onLoad={() => setSharpLoaded(true)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
