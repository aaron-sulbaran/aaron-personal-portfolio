"use client";

import { useEffect, useState } from "react";
import { Portal } from "@/components/Portal";
import { Cover, DockGlyph, EASE, glass } from "@/components/soundtrack/PillParts";
import { MarqueeTitle } from "@/components/soundtrack/MarqueeTitle";
import { playerStrings } from "@/lib/content/player";
import { ISLE } from "@/lib/player/constants";
import { heroLift } from "@/lib/player/lift";
import { NowPlaying } from "./NowPlaying";
import { usePillState } from "./usePillState";
import { usePlayerControls } from "./usePlayerControls";

// The desktop isle: one pill with two states, bottom left on the dock line.
// Collapsed it is the cover, the title and the artist. Hovering it (after a
// short intent delay, so a passing cursor never opens it) or focusing it with
// the keyboard grows the full player up from the same corner; a click anywhere
// on it pins it open, so Tracks and the controls stay usable; a press outside
// or Escape folds it back, and so does a few seconds with nothing touching it
// (lib/player/pill). No close button and no freeze control. Portaled to body so
// no transformed ancestor captures it, on the pill's z level. While the band is
// still ahead of the reader (`lifted`) it stands above the hero's Coil and Band
// toggle; the footer's lift is a CSS variable (globals.css).
export function IslePill({ reduce, pinned: initialPinned = false, lifted = false }: { reduce: boolean; pinned?: boolean; lifted?: boolean }) {
  const { open, pinned, root, face, handlers } = usePillState(initialPinned);
  const controls = usePlayerControls(false);
  const [entered, setEntered] = useState(false);
  // The face closes up (and goes inert) once the pill is open, but not under the keyboard's own focus: an inert element drops its focus, and a keyboard visitor who opened it by focusing would lose their place. The container shows the focus ring then.
  const [faceFocus, setFaceFocus] = useState(false);
  const { track, music } = controls;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const grow = reduce ? "opacity 200ms ease" : `width 340ms ${EASE}, border-radius 340ms ${EASE}, bottom 300ms ${EASE}, opacity 220ms ease`;
  const rows = reduce ? "opacity 200ms ease" : `grid-template-rows 340ms ${EASE}, opacity 220ms ease`;
  return (
    <Portal>
      <div
        ref={root}
        role="group"
        aria-label={playerStrings.pillLabel}
        data-player-pill={open ? (pinned ? "pinned" : "open") : "collapsed"}
        data-player-lifted={lifted || undefined}
        data-marquee-scope
        {...handlers}
        style={{
          ...glass,
          position: "fixed",
          left: ISLE.insetPx,
          bottom: ISLE.bottomPx + heroLift(lifted),
          zIndex: 45,
          width: open ? ISLE.openWidthPx : ISLE.widthPx,
          maxWidth: `calc(100vw - ${ISLE.insetPx * 2}px)`,
          borderRadius: open ? 22 : ISLE.heightPx / 2,
          overflow: "hidden",
          opacity: entered ? 1 : 0,
          transition: grow,
          outline: faceFocus ? "2px solid var(--color-accent)" : undefined,
          outlineOffset: 2,
        }}
      >
        <div style={{ display: "grid", gridTemplateRows: open ? "0fr" : "1fr", opacity: open ? 0 : 1, transition: rows }} inert={open && !faceFocus}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            <button
              ref={face}
              type="button"
              data-cursor-hover
              data-player-pill-face
              aria-expanded={open}
              aria-label={`${playerStrings.pillOpen}: ${track.title}, ${track.artist}`}
              onFocus={(event) => setFaceFocus(event.currentTarget.matches(":focus-visible"))}
              onBlur={() => setFaceFocus(false)}
              className="flex w-full items-center gap-3 text-left outline-none"
              style={{ height: ISLE.heightPx - 2, padding: "0 16px 0 8px", background: "none", border: 0, color: "inherit", cursor: "pointer", borderRadius: ISLE.heightPx / 2 }}
            >
              <Cover size={38} cover={track.cover} title={track.title} />
              <span className="min-w-0 flex-1">
                <MarqueeTitle text={track.title} active={!open} pauseOnHover={false} className="font-label text-label-sm text-foreground" />
                <MarqueeTitle text={track.artist} active={!open} pauseOnHover={false} className="font-label text-label-sm text-muted" />
              </span>
              <span className="flex flex-none">
                <DockGlyph music={music} />
              </span>
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition: rows }} inert={!open}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: 16 }}>
              <NowPlaying active={open} reduce={reduce} />
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
