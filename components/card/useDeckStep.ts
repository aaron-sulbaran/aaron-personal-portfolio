"use client";

import { animate } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { siteContent, type CardKey } from "@/lib/content";
import { goesRound, placeIn, stepFrom, type CardDeck, type Step } from "@/lib/card/deck";
import { useSeen } from "@/lib/home/seen";
import { GALLERY } from "@/lib/gallery/constants";

// Stepping the card modal to the card before or after it (lib/card/deck): the
// step itself, the arrow keys where the pager does not own them (the desktop
// rows, and a phone card with no pages; a phone pager hands its ends up
// through its edge instead, from its drag, its keys and its chevrons), going
// round past the deck's ends until every card
// has been seen (the seen store), a sideways swipe on a phone card with no pages, and
// the landing: the dialog back at its top, focus kept in the dialog, and the
// new panel coming in from the side it was asked for (a fade alone under
// reduced motion). The parent swaps
// the card; the modal's shell stays, so nothing behind it moves.

type Options = {
  dialogRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  cardKey: CardKey | null;
  deck: CardDeck | undefined;
  onStep: ((key: CardKey) => void) | undefined;
  keys: boolean;
  swipe: boolean;
  reduced: boolean;
};

const IN_PX = 28;
const IN_S = 0.26;
const FADE_S = 0.18;
const TYPING = "input, textarea, select, video, audio, [contenteditable='true'], [role='slider']";

export function useDeckStep({ dialogRef, panelRef, cardKey, deck, onStep, keys, swipe, reduced }: Options) {
  const seen = useSeen();
  const live = deck && onStep && cardKey ? { deck, onStep, cardKey, wrap: goesRound(deck, cardKey, seen) } : null;
  const prev = live ? stepFrom(live.deck, live.cardKey, -1, live.wrap) : null;
  const next = live ? stepFrom(live.deck, live.cardKey, 1, live.wrap) : null;
  const landingRef = useRef<Step | 0>(0);
  const fromChevronRef = useRef(false);
  const [heard, setHeard] = useState<CardKey | null>(null);
  if (cardKey === null && heard !== null) setHeard(null);

  const stepRef = useRef((step: Step) => void step);
  useEffect(() => {
    stepRef.current = (step: Step) => {
      if (!live) return;
      const target = stepFrom(live.deck, live.cardKey, step, live.wrap);
      if (!target) return;
      fromChevronRef.current = document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute("data-pager-arrow");
      landingRef.current = step;
      setHeard(target);
      live.onStep(target);
    };
  });

  useLayoutEffect(() => {
    const step = landingRef.current;
    landingRef.current = 0;
    const panel = panelRef.current;
    if (!step || !panel) return;
    const dialog = dialogRef.current;
    dialog?.scrollTo({ top: 0 });
    // Focus that sat in the card left went with it. From a chevron under its pages it lands on the new card's chevron on the same
    // side, so Enter keeps walking; from anything else (a link in its words) on the new card's close button, not the page.
    if (dialog && !dialog.contains(document.activeElement)) {
      const chevron = fromChevronRef.current ? panel.querySelector<HTMLElement>(`[data-pager-arrow="${step === 1 ? "next" : "prev"}"]:not(:disabled)`) : null;
      (chevron ?? panel.querySelector<HTMLElement>("[data-card-close]"))?.focus({ preventScroll: true });
    }
    const controls = reduced
      ? animate(panel, { opacity: [0, 1] }, { duration: FADE_S })
      : animate(panel, { opacity: [0, 1], x: [step * IN_PX, 0] }, { duration: IN_S, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
    // Only a new card lands; the refs are stable and reduced is read as the card arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  const open = live !== null;
  useEffect(() => {
    if (!open || !keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const dialog = dialogRef.current;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (!dialog || !(target === document.body || (target !== null && dialog.contains(target)))) return;
      if (target?.closest(TYPING)) return;
      e.preventDefault();
      stepRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, keys, dialogRef]);

  // Touch events, not pointer events: the dialog scrolls a card's words vertically, and a browser that takes a touch for a scroll
  // cancels its pointer but still ends its touch. Nothing follows the finger; a swipe this far, mostly sideways, steps.
  useEffect(() => {
    if (!open || !swipe) return;
    let start: { x: number; y: number } | null = null;
    const inDialog = (e: TouchEvent) => e.target instanceof Node && !!dialogRef.current?.contains(e.target);
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 1 && inDialog(e) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onEnd = (e: TouchEvent) => {
      const from = start;
      start = null;
      const touch = e.changedTouches[0];
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) >= GALLERY.pager.swipePx && Math.abs(dx) > Math.abs(dy) * 1.5) stepRef.current(dx < 0 ? 1 : -1);
    };
    const onCancel = () => {
      start = null;
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, [open, swipe, dialogRef]);

  const announce = live && heard === live.cardKey ? siteContent.modals.deck.announce(siteContent.cards[live.cardKey].modal.title, placeIn(live.deck, live.cardKey), live.deck.length) : "";
  return { enabled: open, prev, next, step: (step: Step) => stepRef.current(step), announce };
}
