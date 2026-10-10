"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap, SplitText } from "@/lib/gsap";
import { GALLERY } from "@/lib/gallery/constants";
import { photoWipeIn, textIn } from "@/lib/gallery/reveal";
import { maskTable, type MaskStep } from "@/lib/gallery/timing";

// The card modal's mask-in (modal-gallery.md, "Masking in"; the gallery lab's
// round six): one GSAP timeline from lib/gallery/timing's table, built when
// the body mounts and run on a timer from startMs (the landing after a flight,
// at once otherwise; lib/gallery/steps maskStartMs), on screen or not. A
// text part with data-mask-split is split into lines (no mask wrappers: a left
// to right clip opens in place) and each line's clip opens; any other text
// part opens its own clip. A photo part's clip edge crosses it from the left
// while its media settles. Every tween is a fromTo on an element React gives
// no inline style, and the end of the run (or a close, a replay or reduced
// motion turning on) reverts the splits and clears only what GSAP wrote, so
// nothing outlives the run. The root carries data-mask-armed while it is live.

type Options = { reduced: boolean; runKey: string; startMs: number; stepsFor: (lines: (id: string) => number) => MaskStep[] };

const WRITTEN = "clipPath,transform";

export function useMaskIn(rootRef: RefObject<HTMLElement | null>, { reduced, runKey, startMs, stepsFor }: Options) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const parts = new Map([...root.querySelectorAll<HTMLElement>("[data-mask]")].map((el) => [el.dataset.mask ?? "", el] as const));
    const splits = new Map<string, SplitText>();
    for (const [id, el] of parts) {
      if (el.dataset.maskKind === "text" && el.hasAttribute("data-mask-split")) splits.set(id, SplitText.create(el, { type: "lines", linesClass: "card-line", aria: "none" }));
    }
    const { mask, ease, direction } = GALLERY;
    const table = maskTable(stepsFor((id) => splits.get(id)?.lines.length ?? 1), { startMs, lengthMs: mask.lengthMs, staggerMs: mask.staggerMs, lineStaggerMs: mask.lineStaggerMs });
    const duration = mask.lengthMs / 1000;
    const touched: Element[] = [];
    root.dataset.maskArmed = "";
    const finish = () => {
      for (const split of splits.values()) split.revert();
      splits.clear();
      gsap.set(touched, { clearProps: WRITTEN });
      delete root.dataset.maskArmed;
    };
    const tl = gsap.timeline({ onComplete: finish });
    for (const entry of table.entries) {
      const el = parts.get(entry.id);
      if (!el) continue;
      const at = entry.startMs / 1000;
      if (el.dataset.maskKind === "text") {
        const lines = splits.get(entry.id)?.lines;
        const targets = lines?.length ? lines : [el];
        touched.push(...targets);
        const reveal = textIn(direction);
        tl.fromTo(targets, reveal.from, { ...reveal.to, duration, ease: ease.gsap, stagger: mask.lineStaggerMs / 1000 }, at);
        continue;
      }
      const wipe = photoWipeIn(direction);
      touched.push(el);
      tl.fromTo(el, { clipPath: wipe.from }, { clipPath: wipe.to, duration, ease: ease.gsap }, at);
      const media = el.querySelector<HTMLElement>("[data-mask-media]");
      if (media) {
        touched.push(media);
        tl.fromTo(media, { scale: mask.settle }, { scale: 1, duration, ease: ease.gsap }, at);
      }
    }
    return () => {
      tl.kill();
      finish();
    };
    // stepsFor and startMs are read once per run; runKey names every input that replays the masks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, runKey]);
}
