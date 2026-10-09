"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { photoMoveIn, photoWipeIn, textIn } from "./reveal";
import { EASES, type Settings } from "./settings";
import { maskTable, type MaskStep } from "./timing";

// Turns the mask table into one GSAP timeline when the modal lands. The
// markup marks each part: [data-mask=id] with data-mask-kind "text" (a block
// or a line set rising inside an overflow clip, yPercent 110 to 0, the
// sections grammar's MASKED, or round six's clip opening left to right in
// place) or "photo" (a wipe or a move in, bottom up or left to right, with its
// media in [data-mask-media] for the settle). A caption takes the caption
// direction, every other text part the text direction. [data-mask-flown] is the flown card's
// slot: empty until the landing, then there. Every tween is a fromTo on an
// element React gives no inline style, and the cleanup clears only what GSAP
// wrote, so a replay starts from the server's markup.

if (typeof window !== "undefined") {
  gsap.registerPlugin(CustomEase, SplitText);
  if (!CustomEase.get("site")) CustomEase.create("site", "0.22,1,0.36,1");
}

export type Schedule = { steps: MaskStep[]; endMs: number };

// The live run, for the lab's probe: window.__galleryLab.seek(ms) pins it.
let live: gsap.core.Timeline | null = null;
export function seekMasks(ms: number | null) {
  if (!live) return false;
  if (ms === null) live.play();
  else live.pause(ms / 1000);
  return true;
}

type Options = {
  active: boolean;
  reduced: boolean;
  s: Settings;
  runKey: string;
  stepsFor: (lines: (id: string) => number) => MaskStep[];
  onSchedule: (schedule: Schedule) => void;
};

const WRITTEN = "transform,clipPath,opacity,visibility";

export function useMaskIn(rootRef: RefObject<HTMLElement | null>, { active, reduced, s, runKey, stepsFor, onSchedule }: Options) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;
    const byId = (id: string) => root.querySelector<HTMLElement>(`[data-mask="${id}"]`);
    const flown = [...root.querySelectorAll<HTMLElement>("[data-mask-flown]")];

    if (reduced) {
      onSchedule({ steps: stepsFor(() => 1), endMs: 0 });
      return;
    }

    const splits = new Map<string, SplitText>();
    if (s.textSplit === "lines") {
      // Only a marked paragraph splits (the links mask as one block), and
      // only its children move: GalleryContent keys its root by card, so
      // React replaces a split paragraph whole and never patches inside it.
      for (const el of root.querySelectorAll<HTMLElement>('[data-mask-kind="text"]')) {
        const target = el.querySelector<HTMLElement>("[data-mask-split]");
        if (target) splits.set(el.dataset.mask ?? "", SplitText.create(target, { type: "lines", mask: "lines", linesClass: "gallery-line" }));
      }
    }
    const lines = (id: string) => splits.get(id)?.lines.length ?? 1;
    const steps = stepsFor(lines);
    const timing = { startMs: s.landingMs, lengthMs: s.maskMs, staggerMs: s.staggerMs, lineStaggerMs: s.textSplit === "lines" ? s.lineStaggerMs : 0 };
    const table = maskTable(steps, timing);
    onSchedule({ steps, endMs: table.endMs });

    root.dataset.maskArmed = s.textSplit;
    const ease = EASES[s.ease].gsap;
    const duration = s.maskMs / 1000;
    const settle = 1 + s.settle / 100;
    const touched: Element[] = [...flown];
    const tl = gsap.timeline({
      onComplete: () => {
        for (const split of splits.values()) split.revert();
        splits.clear();
        gsap.set(touched, { clearProps: WRITTEN });
        delete root.dataset.maskArmed;
      },
    });

    live = tl;
    gsap.set(flown, { opacity: 0 });
    tl.set(flown, { opacity: 1 }, s.landingMs / 1000);

    for (const entry of table.entries) {
      const el = byId(entry.id);
      if (!el) continue;
      const at = entry.startMs / 1000;
      if (el.dataset.maskKind === "text") {
        const split = splits.get(entry.id);
        const targets = split ? split.lines : el.querySelector("[data-mask-inner]");
        if (!targets) continue;
        touched.push(...(Array.isArray(targets) ? targets : [targets]));
        const reveal = textIn(entry.id.startsWith("caption-") ? s.captionDirection : s.textDirection);
        tl.fromTo(targets, reveal.from, { ...reveal.to, duration, ease, stagger: split ? timing.lineStaggerMs / 1000 : 0 }, at);
        continue;
      }
      const media = el.querySelector<HTMLElement>("[data-mask-media]");
      touched.push(el);
      if (media) touched.push(media);
      if (s.photoMask === "wipe") {
        const wipe = photoWipeIn(s.photoDirection);
        tl.fromTo(el, { clipPath: wipe.from }, { clipPath: wipe.to, duration, ease }, at);
        if (media && settle > 1) tl.fromTo(media, { scale: settle }, { scale: 1, duration, ease }, at);
      } else if (media) {
        const move = photoMoveIn(s.photoDirection);
        tl.fromTo(media, { ...move.from, scale: settle }, { ...move.to, scale: 1, duration, ease }, at);
      }
    }

    return () => {
      if (live === tl) live = null;
      tl.kill();
      for (const split of splits.values()) split.revert();
      gsap.set(touched, { clearProps: WRITTEN });
      delete root.dataset.maskArmed;
    };
    // stepsFor and onSchedule are read once per run; runKey names every input
    // that should replay the masks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced, runKey]);
}
