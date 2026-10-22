"use client";

import type { gsap as Gsap } from "gsap";
import { COIL } from "@/lib/coil/constants";
import type { DealKnobs } from "@/lib/home/dealKnobs";
import { gsap } from "@/lib/gsap";

// The DOM half of the deal (the Coil's flight, the speed curve and the field's
// mask are the scene's own, driven by the same clock): the teaser's text
// leaves first, then the two columns arrive last, the group labels and then
// the titles, a short fade-up each. All of it is children of the deal's one
// master timeline (lib/home/dealMaster.ts), so a single clock runs the page's
// scroll, these and the scene. On the still path (no scene) the stage
// cross-fades in instead. The field no longer opens here: it opens as an alpha
// mask in the scene's composite (lib/coil/entrance.ts fieldMask).
//
// prepareOpen runs before the page's <html data-deal> leaves "closed", so the
// moment the CSS stops hiding things the inline styles already do (no flash);
// clearOpen removes every inline style the deal set.

export type OpenParts = {
  stage: HTMLElement | null;
  teaser: HTMLElement[];
  labels: HTMLElement[];
  titles: HTMLElement[];
};

export type OpenMode = "scene" | "fade";

export function openParts(section: HTMLElement): OpenParts {
  return {
    stage: section.querySelector<HTMLElement>("[data-coil-stage]"),
    teaser: Array.from(document.querySelectorAll<HTMLElement>("[data-teaser-text]")),
    labels: Array.from(section.querySelectorAll<HTMLElement>("[data-deal-label]")),
    titles: Array.from(section.querySelectorAll<HTMLElement>("[data-deal-title]")),
  };
}

export function prepareOpen(parts: OpenParts, mode: OpenMode) {
  const { columns } = COIL.deal;
  gsap.set([...parts.labels, ...parts.titles], { opacity: 0, y: columns.riseY });
  if (parts.stage && mode === "fade") gsap.set(parts.stage, { opacity: 0 });
}

// Every inline style the deal set, cleared (the teaser's text comes back for
// the page's "Back to my cards" state; the columns rest at their own CSS).
export function clearOpen(parts: OpenParts) {
  gsap.set([...parts.teaser, ...parts.labels, ...parts.titles], { clearProps: "opacity,transform" });
  if (parts.stage) gsap.set(parts.stage, { clearProps: "opacity" });
}

const s = (ms: number) => ms / 1000;

// Adds the DOM half to the master, at its times from the click: the teaser's
// text out, then the columns (the field opens at openStartMs; the columns come
// columns.delayMs into it) or the stage's cross-fade.
export function addOpen(master: ReturnType<typeof Gsap.timeline>, parts: OpenParts, mode: OpenMode, knobs: DealKnobs) {
  const { columns, open } = COIL.deal;
  if (parts.teaser.length) master.to(parts.teaser, { opacity: 0, duration: s(knobs.textOutMs), ease: "power2.out" }, 0);
  const at = mode === "scene" ? s(knobs.openStartMs + knobs.columnsDelayMs) : s(open.fadeMs) * 0.35;
  if (parts.stage && mode === "fade") master.to(parts.stage, { opacity: 1, duration: s(open.fadeMs), ease: "power1.out" }, 0);
  const labelStagger = s(columns.labelStaggerMs);
  master.to(parts.labels, { opacity: 1, y: 0, duration: s(columns.fadeMs), ease: "power2.out", stagger: labelStagger }, at);
  const labelsSpan = Math.max(0, parts.labels.length - 1) * labelStagger;
  master.to(parts.titles, { opacity: 1, y: 0, duration: s(columns.fadeMs), ease: "power2.out", stagger: s(knobs.columnsStaggerMs) }, at + labelsSpan * 0.6);
}
