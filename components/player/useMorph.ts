"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { MORPH } from "@/lib/player/constants";
import type { PlayerView } from "@/lib/player/machine";
import { cornerRadius, ghostOpacity, lerpBox, toBox, type Box } from "@/lib/player/zone";

type Args = {
  view: PlayerView;
  target: () => Box; // where the isle is now: the pill, or the island in the header row
  toIsland: boolean; // the glass turns black on the way (the phone's island)
  clone: RefObject<HTMLElement | null>;
  onArrived: () => void;
};

const bandCard = () => document.querySelector<HTMLElement>("[data-player-band-card]");

function place(clone: HTMLElement, box: Box, progress: number, toIsland: boolean) {
  gsap.set(clone, { x: box.left, y: box.top, width: box.width, height: box.height, borderRadius: cornerRadius(MORPH.cardRadiusPx, box) });
  const ghost = clone.querySelector("[data-player-ghost]");
  if (ghost) gsap.set(ghost, { opacity: toIsland ? 0 : ghostOpacity(progress) });
  const tone = clone.querySelector("[data-player-tone]");
  if (tone) gsap.set(tone, { opacity: toIsland ? progress : 0 });
}

// The FLIP-style hand-off between the band's player and the isle. First and
// last are measured, never assumed: the card's box is read every frame (the
// band keeps scrolling while it plays, so the start follows the page), the
// isle's from `target`. Progress 0 is the card, 1 is the isle; one number
// is tweened and the clone's box is its blend, so a turn-around mid-flight
// reverses from wherever it is. The move is a transform; the size is the
// clone's own width and height, so the corners and the 1px border stay true.
export function useMorph({ view, target, toIsland, clone, onArrived }: Args) {
  const progress = useRef({ value: 0 });
  const latest = useRef({ target, toIsland });
  useEffect(() => {
    latest.current = { target, toIsland };
  });

  useEffect(() => {
    if (view !== "to-pill" && view !== "to-band") return;
    const cloneEl = clone.current;
    const cardEl = bandCard();
    if (!cloneEl || !cardEl) {
      progress.current.value = view === "to-pill" ? 1 : 0;
      onArrived();
      return;
    }
    const frame = () => {
      const { target: end, toIsland: black } = latest.current;
      place(cloneEl, lerpBox(toBox(cardEl.getBoundingClientRect()), end(), progress.current.value), progress.current.value, black);
    };
    const destination = view === "to-pill" ? 1 : 0;

    gsap.killTweensOf(cloneEl);
    gsap.set(cloneEl, { visibility: "visible", opacity: 1 });
    frame();
    const flight = gsap.to(progress.current, {
      value: destination,
      duration: MORPH.seconds * Math.abs(destination - progress.current.value),
      ease: "power3.inOut",
      onUpdate: frame,
      onComplete: () => {
        onArrived();
        gsap.to(cloneEl, { opacity: 0, duration: MORPH.fadeSeconds, ease: "none", onComplete: () => void gsap.set(cloneEl, { visibility: "hidden" }) });
      },
    });
    return () => {
      flight.kill();
    };
  }, [view, clone, onArrived]);
}
