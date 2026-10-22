"use client";

import { useEffect, useRef, type RefObject } from "react";
import { siteContent } from "@/lib/content";
import { hintStore } from "@/lib/cursor/hover";
import { KEEP_EXPLORING_KEY, TAP_CARD_KEY } from "@/lib/home/firstVisit";
import { useHomeController } from "@/components/home/HomeController";
import { useDealt } from "@/lib/home/deal";
import type { CoilEntrance } from "./CoilScene";

const LINE_IN_MS = 420;
const LINE_OUT_MS = 320;
const KEEP_HOLD_MS = 2500;
const TAP_HOLD_MS = 5000;
const LINE_CLASS =
  "absolute bottom-[max(32px,7svh)] max-sm:bottom-[76px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[14px] leading-none text-[color:var(--hero-greeting)] opacity-0 transition-opacity [transition-timing-function:var(--ease-out)]";

// ---- fx-hero: the first-visit lines ----
// Once ever each, decorative (the cards stay reachable through the book).
// Fine pointer: when the first card ever opened has flown home, "Keep
// exploring" fades in at the hero's bottom center, holds, and goes (the
// cursor's "Open me" pill retires with that first open, in CustomCursor).
// Touch: "Tap a card" after the entrance, gone on the first tap or after 5s.
// Written imperatively, like the rest of this layer: a plain opacity fade,
// which is also the reduced-motion version.
export function HintLine({ rootRef, entrance }: { rootRef: RefObject<HTMLDivElement | null>; entrance: CoilEntrance | null }) {
  const controller = useHomeController();
  const lineRef = useRef<HTMLParagraphElement>(null);
  const firstOpenRef = useRef(false);
  const hideRef = useRef<() => void>(() => {});
  const modalOpen = controller?.modalOpen ?? false;
  const flying = (controller?.flight ?? null) !== null;
  const input = controller?.drivers.input;
  // The lines wait for the deal to be over: the wheel and the band are not cards to tap yet.
  const dealt = useDealt();
  const ready = controller?.phase === "ready" && entrance !== null && dealt;

  // Shows `text`, holds, fades out; hideRef dismisses it early.
  const show = (text: string, holdMs: number) => {
    const line = lineRef.current;
    if (!line) return;
    hideRef.current();
    line.textContent = text;
    line.style.transitionDuration = `${LINE_IN_MS}ms`;
    line.style.opacity = "0";
    let timer = 0;
    const hide = () => {
      window.clearTimeout(timer);
      line.style.transitionDuration = `${LINE_OUT_MS}ms`;
      line.style.opacity = "0";
      hideRef.current = () => {};
    };
    const frame = requestAnimationFrame(() => {
      line.style.opacity = "1";
    });
    timer = window.setTimeout(hide, LINE_IN_MS + holdMs);
    hideRef.current = () => {
      cancelAnimationFrame(frame);
      hide();
    };
  };

  // The first card ever opened: the cursor's pill retires for good.
  useEffect(() => {
    if (!modalOpen) return;
    hideRef.current();
    const store = hintStore();
    if (store.opened()) return;
    firstOpenRef.current = true;
    store.markOpened();
  }, [modalOpen]);

  // That card has flown home: one line, if the hero is still in view. The
  // controller drops its flight in the same task as the scene's handoff lands
  // the card (FlyingTile calls land(), then onClosingComplete), so this runs
  // on the landing itself, never on a timer; with no flight, at the close.
  useEffect(() => {
    if (modalOpen || flying || !firstOpenRef.current) return;
    firstOpenRef.current = false;
    if (input !== "fine") return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.bottom < window.innerHeight * 0.5 || rect.top > window.innerHeight * 0.5) return;
    if (hintStore().takeOnce(KEEP_EXPLORING_KEY)) show(siteContent.hero.hints.keepExploring, KEEP_HOLD_MS);
  });

  // Touch: once, when the Coil is first half in view (it sits below the intro),
  // until the first tap or 5s.
  useEffect(() => {
    const root = rootRef.current;
    if (!ready || input !== "coarse" || !root) return;
    const store = hintStore();
    if (store.opened()) return;
    const onTap = () => hideRef.current();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !store.takeOnce(TAP_CARD_KEY)) return;
        observer.disconnect();
        show(siteContent.hero.hints.tapCard, TAP_HOLD_MS);
        window.addEventListener("pointerdown", onTap, { once: true });
      },
      { threshold: 0.5 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointerdown", onTap);
    };
  }, [ready, input, rootRef]);

  return <p ref={lineRef} data-hint-line aria-hidden="true" className={LINE_CLASS} />;
}

// ---- end fx-hero ----
