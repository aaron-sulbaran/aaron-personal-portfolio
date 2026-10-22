"use client";

import { sceneMs } from "@/lib/coil/dealSpeed";
import { tunedConstants } from "@/lib/coil/entrance";
import { entranceTuningOf, type DealKnobs } from "@/lib/home/dealKnobs";
import { addOpen, clearOpen, type OpenMode, type OpenParts } from "@/lib/home/dealOpen";
import { addDealScroll, cardsTop, type ScrollChild } from "@/lib/home/dealScroll";
import { gsap } from "@/lib/gsap";

// The deal's one clock: a paused GSAP timeline per deal, whose first child is a
// proxy tween { ms: 0 to TOTAL } on ease "none", at position 0. The Coil's
// scene reads that proxy each frame as the ms since the click (CoilEntrance
// .clockMs), so the wheel's spin, the flatten, the lift and the field's mask are
// pure functions of it: the same ms always draws the same frame, and the scene
// and the DOM can never drift apart. Its other children, in the spec's table
// (docs/superpowers/specs/2026-10-22-wheel-deal-motion.md section 2): the
// teaser's text out, the page's own scroll to the cards section (a child at
// the label "scroll", which the reader's wheel, touch or key kills alone,
// never the deal), and the columns. The proxy runs the full length on purpose:
// when autoKill removes the scroll child it would otherwise shorten the
// timeline.

export type DealMaster = {
  // Milliseconds since the click, as the timeline stands.
  clockMs: () => number;
  // The total length, ms.
  totalMs: number;
  play: () => void;
  // Everything at once: the scroll child stopped where it is, the rest at its
  // end state (onDone runs).
  finish: () => void;
  // Stops and clears every inline style it set; onDone does not run.
  kill: () => void;
};

type Args = {
  parts: OpenParts;
  mode: OpenMode;
  knobs: DealKnobs;
  // The click's deal scrolls the page itself; the reader's own scroll does not.
  scroll: boolean;
  onDone: () => void;
};

export function createDealMaster({ parts, mode, knobs, scroll, onDone }: Args): DealMaster {
  const master = gsap.timeline({ paused: true });
  const top = scroll ? cardsTop() : null;
  let scrollChild: ScrollChild | null = null;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearOpen(parts);
    onDone();
  };
  addOpen(master, parts, mode, knobs);
  if (top !== null && Math.abs(top - window.scrollY) > 1) {
    scrollChild = addDealScroll(master, top, knobs.scrollStartMs, knobs.scrollMs);
  }
  const totalMs = Math.ceil(Math.max(master.duration() * 1000, sceneMs(tunedConstants(entranceTuningOf(knobs)))));
  const clock = { ms: 0 };
  master.to(clock, { ms: totalMs, duration: totalMs / 1000, ease: "none" }, 0);
  master.eventCallback("onComplete", end);
  return {
    clockMs: () => clock.ms,
    totalMs,
    play: () => {
      master.play(0);
    },
    finish() {
      if (ended) return;
      scrollChild?.kill();
      master.progress(1, false);
      end();
    },
    kill() {
      ended = true;
      scrollChild?.kill();
      master.kill();
      clearOpen(parts);
    },
  };
}
