"use client";

import { useEffect, useRef, type RefObject } from "react";
import { siteContent } from "@/lib/content";
import { hintStore } from "@/lib/cursor/hover";
import { KEEP_EXPLORING_KEY } from "@/lib/home/firstVisit";
import { useHomeController } from "@/components/home/HomeController";

const LINE_IN_MS = 420;
const LINE_OUT_MS = 320;
const KEEP_HOLD_MS = 2500;
const LINE_CLASS =
  "absolute bottom-[max(32px,7svh)] max-sm:bottom-[76px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[14px] leading-none text-[color:var(--hero-greeting)] opacity-0 transition-opacity [transition-timing-function:var(--ease-out)]";

// ---- fx-hero: the first-visit line ----
// Once ever, decorative (the cards stay reachable through the book). Fine
// pointer: when the first card ever opened has flown home, "Keep exploring"
// fades in at the hero's bottom center, holds, and goes (the cursor's "Open
// me" pill retires with that first open, in CustomCursor). A touch screen
// gets no line. Written imperatively, like the rest of this layer: a plain
// opacity fade, which is also the reduced-motion version.
export function HintLine({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const controller = useHomeController();
  const lineRef = useRef<HTMLParagraphElement>(null);
  const firstOpenRef = useRef(false);
  const hideRef = useRef<() => void>(() => {});
  const modalOpen = controller?.modalOpen ?? false;
  const flying = (controller?.flight ?? null) !== null;
  const input = controller?.drivers.input;

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

  return <p ref={lineRef} data-hint-line aria-hidden="true" className={LINE_CLASS} />;
}

// ---- end fx-hero ----
