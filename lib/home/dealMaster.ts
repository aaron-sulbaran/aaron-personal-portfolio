"use client";

import { dealMs } from "@/lib/coil/dealSpeed";
import { tunedConstants } from "@/lib/coil/entrance";
import { entranceTuningOf, type DealKnobs } from "@/lib/home/dealKnobs";
import { addOpen, clearOpen, type OpenMode, type OpenParts } from "@/lib/home/dealOpen";
import { addDealScroll, addHandScroll, cardsTop, type ScrollChild } from "@/lib/home/dealScroll";
import { planHandScroll } from "@/lib/home/handScroll";
import { gsap } from "@/lib/gsap";

// The deal's one clock: a paused GSAP timeline per deal, whose first child is a
// proxy tween { ms: 0 to TOTAL } on ease "none", at position 0. The Coil's
// scene reads that proxy each frame as the ms since the click (CoilEntrance
// .clockMs), so the wheel's spin, the flatten, the lift and the field's mask are
// pure functions of it: the same ms always draws the same frame, and the scene
// and the DOM can never drift apart. Its other children, in the spec's table
// (docs/superpowers/specs/2026-10-22-wheel-deal-motion.md section 2): the
// first screen's text out, the page's own scroll to the cards section (a child at
// the label "scroll"; in the cutscene nothing the reader does can take it back,
// and without one the reader's wheel, touch or key kills it alone, never the
// deal), and the columns. The proxy runs the full length on purpose: when the
// scroll child is removed (autoKill, or stopScroll) it would otherwise shorten
// the timeline.

export type DealMaster = {
  // Milliseconds since the click, as the timeline stands.
  clockMs: () => number;
  // The total length, ms.
  totalMs: number;
  play: () => void;
  // Stops the page's own scroll where it is; the master carries on.
  stopScroll: () => void;
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
  // The page's own scroll to the cards, or none (no scene: the reader's own scroll
  // is the page's, as it always was):
  //   click: the eased scroll from rest; `holds` is the cutscene's lock, so the
  //     reader's wheel, touch or key cannot take it back;
  //   hand: the cutscene's, taking over at the page's own speed (px/s down the page).
  scroll: { kind: "click"; holds: boolean } | { kind: "hand"; velocity: number } | null;
  onDone: () => void;
};

export function createDealMaster({ parts, mode, knobs, scroll, onDone }: Args): DealMaster {
  const master = gsap.timeline({ paused: true });
  const top = scroll ? cardsTop() : null;
  const y0 = window.scrollY;
  let scrollChild: ScrollChild | null = null;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearOpen(parts);
    onDone();
  };
  addOpen(master, parts, mode, knobs);
  const clickLegStartMs = knobs.condenseMs + knobs.scrollStartMs;
  if (scroll && top !== null && Math.abs(top - y0) > 1) {
    if (scroll.kind === "click") {
      scrollChild = addDealScroll(master, top, clickLegStartMs, knobs.scrollMs, undefined, !scroll.holds);
    } else {
      // From the deal's zero, at the page's own speed, landing as the click's leg does.
      const plan = planHandScroll({ y0, v0: scroll.velocity, landing: top, nominalMs: clickLegStartMs + knobs.scrollMs });
      if (plan) scrollChild = addHandScroll(master, plan, y0, top);
    }
  }
  const totalMs = Math.ceil(Math.max(master.duration() * 1000, dealMs(tunedConstants(entranceTuningOf(knobs)))));
  const clock = { ms: 0 };
  master.to(clock, { ms: totalMs, duration: totalMs / 1000, ease: "none" }, 0);
  master.eventCallback("onComplete", end);
  return {
    clockMs: () => clock.ms,
    totalMs,
    play: () => {
      master.play(0);
    },
    stopScroll: () => scrollChild?.kill(),
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
