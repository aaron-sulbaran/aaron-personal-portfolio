"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { GALLERY } from "@/lib/gallery/constants";
import { textIn } from "@/lib/gallery/reveal";
import { gsap, SplitText } from "@/lib/gsap";
import { getTransition, useTransitionState } from "@/lib/quick/transitionStore";

// The lane's lines masking in as the transition's mask lifts off it, in the
// card modal's grammar (lib/gallery/reveal: a left to right clip per line).
// Armed only when the lane mounts under the mask (a load or a link never
// waits on it): every data-lane-line part in the first screen is split into
// lines (a list, or a part marked data-lane-whole, masks as one) and closed before the mask lifts, then opened on "arriving", and the
// splits are reverted at the end. Under reduced motion the crossfade is all.

const LINE_STAGGER_S = 0.06;
const AFTER_SWEEP_S = 0.12;

export function useLaneMaskIn(rootRef: RefObject<HTMLElement | null>) {
  const path = usePathname();
  const { phase } = useTransitionState();
  const playRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const t = getTransition();
    if (!root || t.reduced || (t.phase !== "leaving" && t.phase !== "covered") || t.to !== path) return;
    const parts = [...root.querySelectorAll<HTMLElement>("[data-lane-line]")].filter((el) => el.getBoundingClientRect().top < window.innerHeight);
    const splits = parts.map((el) => (el.tagName === "UL" || el.hasAttribute("data-lane-whole") ? null : SplitText.create(el, { type: "lines", aria: "none" })));
    const targets = parts.flatMap((el, i) => splits[i]?.lines ?? [el]);
    const reveal = textIn(GALLERY.direction);
    const finish = () => {
      for (const split of splits) split?.revert();
      gsap.set(parts, { clearProps: "clipPath" });
    };
    gsap.set(targets, reveal.from);
    const tl = gsap.timeline({ paused: true, onComplete: finish });
    tl.to(targets, { ...reveal.to, duration: GALLERY.mask.lengthMs / 1000, ease: GALLERY.ease.gsap, stagger: LINE_STAGGER_S }, AFTER_SWEEP_S);
    playRef.current = () => tl.play();
    return () => {
      playRef.current = null;
      tl.kill();
      finish();
    };
    // Armed once per mount: a later phase change plays it, it never re-arms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "arriving") playRef.current?.();
  }, [phase]);
}
