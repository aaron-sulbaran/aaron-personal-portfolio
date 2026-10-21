"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import type { PlayerView } from "@/lib/player/machine";
import { barBox, cornerRadius, ghostOpacity, isleBox, lerpBox, toBox, type Box } from "@/lib/player/zone";

const SECONDS = 0.56;
const FADE_SECONDS = 0.22;
const CARD_RADIUS = 22;

type Args = {
  view: PlayerView;
  phone: boolean;
  card: RefObject<HTMLElement | null>;
  clone: RefObject<HTMLElement | null>;
  onArrived: () => void;
};

function place(clone: HTMLElement, box: Box, progress: number) {
  gsap.set(clone, { x: box.left, y: box.top, width: box.width, height: box.height, borderRadius: cornerRadius(CARD_RADIUS, box) });
  const ghost = clone.querySelector("[data-lab-ghost]");
  if (ghost) gsap.set(ghost, { opacity: ghostOpacity(progress) });
}

// The FLIP-style hand-off between the band's player and the isle. First and
// last are measured, never assumed: the card's box is read every frame (the
// band keeps scrolling while it plays, so the start follows the page), the
// isle's from the viewport. Progress 0 is the card, 1 is the isle; one number
// is tweened and the clone's box is its blend, so a turn-around mid-flight
// reverses from wherever it is. The move is a transform; the size is the
// clone's own width and height, so the corners and the 1px border stay true.
export function useMorph({ view, phone, card, clone, onArrived }: Args) {
  const progress = useRef({ value: 0 });

  useEffect(() => {
    if (view !== "to-pill" && view !== "to-band") return;
    const cloneEl = clone.current;
    const cardEl = card.current;
    if (!cloneEl || !cardEl) {
      progress.current.value = view === "to-pill" ? 1 : 0;
      onArrived();
      return;
    }
    const target = () => (phone ? barBox(window.innerWidth, window.innerHeight) : isleBox(window.innerHeight));
    const frame = () => place(cloneEl, lerpBox(toBox(cardEl.getBoundingClientRect()), target(), progress.current.value), progress.current.value);
    const destination = view === "to-pill" ? 1 : 0;

    gsap.killTweensOf(cloneEl);
    gsap.set(cloneEl, { visibility: "visible", opacity: 1 });
    frame();
    const flight = gsap.to(progress.current, {
      value: destination,
      duration: SECONDS * Math.abs(destination - progress.current.value),
      ease: "power3.inOut",
      onUpdate: frame,
      onComplete: () => {
        onArrived();
        gsap.to(cloneEl, { opacity: 0, duration: FADE_SECONDS, ease: "none", onComplete: () => void gsap.set(cloneEl, { visibility: "hidden" }) });
      },
    });
    return () => {
      flight.kill();
    };
  }, [view, phone, card, clone, onArrived]);
}
