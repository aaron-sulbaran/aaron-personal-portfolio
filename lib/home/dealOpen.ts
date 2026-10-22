"use client";

import { COIL } from "@/lib/coil/constants";
import type { DealKnobs } from "@/lib/home/dealKnobs";
import { gsap } from "@/lib/gsap";

// The DOM half of the deal's entrance (the cards' flight is the Coil's own
// timeline, started with it): the cards section's stage opens from a circle
// anchored at its top center to the whole section, then the two columns
// arrive last, the group labels and then the titles, a short fade-up each. On
// the still path (no scene) the stage cross-fades in instead.
//
// prepareOpen runs before the page's <html data-deal> leaves "closed", so the
// moment the CSS stops hiding things the inline styles already do (no flash);
// playOpen then clears every inline style it set when it ends.

export type OpenParts = {
  stage: HTMLElement | null;
  labels: HTMLElement[];
  titles: HTMLElement[];
};

export type OpenMode = "radial" | "fade";

export function openParts(section: HTMLElement): OpenParts {
  return {
    stage: section.querySelector<HTMLElement>("[data-coil-stage]"),
    labels: Array.from(section.querySelectorAll<HTMLElement>("[data-deal-label]")),
    titles: Array.from(section.querySelectorAll<HTMLElement>("[data-deal-title]")),
  };
}

const circle = (radius: number) => `circle(${radius.toFixed(1)}px at 50% 0px)`;

export function prepareOpen(parts: OpenParts, mode: OpenMode) {
  const { columns, open } = COIL.deal;
  gsap.set([...parts.labels, ...parts.titles], { opacity: 0, y: columns.riseY });
  if (!parts.stage) return;
  if (mode === "radial") parts.stage.style.clipPath = circle(open.fromPx);
  else gsap.set(parts.stage, { opacity: 0 });
}

export type OpenHandle = {
  // Everything at once: the end state, the inline styles cleared, onDone run.
  finish: () => void;
  // Stops where it is and clears what it set (the lab's replay).
  kill: () => void;
};

export function playOpen(parts: OpenParts, mode: OpenMode, knobs: DealKnobs, onDone: () => void): OpenHandle {
  const { columns, open } = COIL.deal;
  const s = (ms: number) => ms / 1000;
  let ended = false;
  const clear = () => {
    gsap.set([...parts.labels, ...parts.titles], { clearProps: "opacity,transform" });
    if (parts.stage) {
      parts.stage.style.clipPath = "";
      gsap.set(parts.stage, { clearProps: "opacity" });
    }
  };
  const end = () => {
    if (ended) return;
    ended = true;
    clear();
    onDone();
  };
  const tl = gsap.timeline({ onComplete: end });
  const at = mode === "radial" ? s(knobs.columnsDelayMs) : s(open.fadeMs) * 0.35;
  if (parts.stage && mode === "radial") {
    const box = parts.stage.getBoundingClientRect();
    const reach = Math.hypot(box.width / 2, box.height) * knobs.openReach;
    const grow = { r: open.fromPx };
    tl.to(grow, { r: Math.max(open.fromPx, reach), duration: s(knobs.openMs), ease: "power2.out", onUpdate: () => { parts.stage!.style.clipPath = circle(grow.r); } }, 0);
  } else if (parts.stage) {
    tl.to(parts.stage, { opacity: 1, duration: s(open.fadeMs), ease: "power1.out" }, 0);
  }
  const labelStagger = s(columns.labelStaggerMs);
  tl.to(parts.labels, { opacity: 1, y: 0, duration: s(columns.fadeMs), ease: "power2.out", stagger: labelStagger }, at);
  const labelsSpan = Math.max(0, parts.labels.length - 1) * labelStagger;
  tl.to(parts.titles, { opacity: 1, y: 0, duration: s(columns.fadeMs), ease: "power2.out", stagger: s(knobs.columnsStaggerMs) }, at + labelsSpan * 0.6);
  return {
    finish() {
      tl.kill();
      end();
    },
    kill() {
      tl.kill();
      ended = true;
      clear();
    },
  };
}
