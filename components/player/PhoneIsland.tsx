"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Portal } from "@/components/Portal";
import { EASE } from "@/components/soundtrack/PillParts";
import { playerStrings } from "@/lib/content/playerLab";
import { compactWidth, expandedWidth, islandTop } from "@/lib/player/island";
import type { PhoneModel } from "@/lib/player/settings";
import { useEscapeKey } from "@/lib/modal";
import { IslandFace } from "./IslandFace";
import { NowPlaying } from "./NowPlaying";
import { useIslandSpec } from "./useIslandSpec";
import { useSwipeUp } from "./useSwipeUp";

// The same colours as the page, but black: inside the island the page's tokens
// read as the island's, so the sheet drawn in it needs no colours of its own.
const SCOPE = {
  "--color-foreground": "var(--island-fg)",
  "--color-muted": "var(--island-muted)",
  "--color-border": "var(--island-border)",
  "--color-accent": "var(--island-accent)",
  "--color-accent-hover": "var(--island-accent-hover)",
  "--color-background": "var(--island-bg)",
} as CSSProperties;

// The phone's island: a black pill at the top of the screen, just under the
// status bar (a page cannot draw into it in Safari), sized to the phone's
// Dynamic Island where the model is known. Collapsed it is a live activity;
// a tap grows the full player down from the top, and a tap outside, a swipe
// up or Escape folds it back (a screen-reader-only button does the same, so
// the player has no close button to see). Reduced motion fades instead
// of growing. Portaled to body on the pill's z level, with a backdrop one
// level under it.
export function PhoneIsland({ reduce, model, credit }: { reduce: boolean; model: PhoneModel; credit: boolean }) {
  const { spec, insetTop, viewportWidth } = useIslandSpec(model);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const face = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEscapeKey(open, close);
  useSwipeUp(root, open, close);
  useEffect(() => {
    const island = root.current;
    const button = face.current;
    if (!open || !island) return;
    const frame = requestAnimationFrame(() => island.querySelector<HTMLElement>("[data-lab-play]")?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      if (island.contains(document.activeElement)) button?.focus({ preventScroll: true });
    };
  }, [open]);

  const grow = reduce ? "opacity 200ms ease" : `width 380ms ${EASE}, border-radius 380ms ${EASE}, box-shadow 300ms ease, opacity 220ms ease`;
  const rows = reduce ? "opacity 200ms ease" : `grid-template-rows 380ms ${EASE}, opacity 240ms ease`;
  return (
    <Portal>
      {open && <div data-lab-island-backdrop aria-hidden="true" onPointerDown={close} style={{ position: "fixed", inset: 0, zIndex: 44, touchAction: "pan-y" }} />}
      <div
        ref={root}
        role="group"
        aria-label={playerStrings.islandLabel}
        data-lab-island={open ? "open" : "closed"}
        data-marquee-scope
        style={{
          ...SCOPE,
          position: "fixed",
          top: islandTop(spec, insetTop),
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 45,
          width: open ? expandedWidth(viewportWidth) : compactWidth(spec, viewportWidth),
          maxWidth: "calc(100vw - 16px)",
          borderRadius: open ? 28 : spec.height / 2,
          background: "var(--island-bg)",
          color: "var(--island-fg)",
          border: "1px solid var(--island-border)",
          boxShadow: open ? "var(--island-shadow)" : "none",
          overflow: "hidden",
          touchAction: open ? "none" : "auto",
          opacity: entered ? 1 : 0,
          transition: grow,
        }}
      >
        <div style={{ display: "grid", gridTemplateRows: open ? "0fr" : "1fr", opacity: open ? 0 : 1, transition: rows }} inert={open}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            <IslandFace ref={face} height={spec.height - 2} onOpen={() => setOpen(true)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition: rows }} inert={!open}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: 16 }}>
              <NowPlaying credit={credit} active={open} reduce={reduce} />
              <button type="button" className="sr-only" onClick={close}>
                {playerStrings.islandClose}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
