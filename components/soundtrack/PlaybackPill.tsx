"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { Music } from "lucide-react";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { getSoundtrackPlayer } from "@/lib/audio";
import { useSoundtrack } from "@/lib/soundtrack";
import { PHONE_QUERY } from "@/lib/waveform/layout";
import { pillVisible } from "@/lib/waveform/pill";
import { Cover, EASE, Glyph, glass } from "./PillParts";
import { PlayerCard } from "./PlayerCard";
import { usePillHover } from "./usePillHover";

// The glass playback pill, a mini-player. The band under the book introduces
// the music; once music is chosen (on or paused) and the band is off screen,
// the pill holds a visible control anywhere on the page (lib/waveform/pill).
// A 26px capsule grows to a now-playing preview on hover and opens to the
// player card on click. Every hidden layer is inert, so nothing invisible is
// focusable. Portaled to body so no transformed ancestor captures it. Phones
// have never had the pill; there the band and the Menu's note are the controls.
export function PlaybackPill({ bandInView }: { bandInView: boolean | null }) {
  return (
    <Portal>
      <PillInner bandInView={bandInView} />
    </Portal>
  );
}

const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

function PillInner({ bandInView }: { bandInView: boolean | null }) {
  const music = useSoundtrack();
  const reduce = useReducedMotion() ?? false;
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => true);
  const shown = !phone && bandInView !== null && pillVisible({ music, bandInView });
  const [hover, send] = usePillHover(reduce, shown);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const capsuleRef = useRef<HTMLButtonElement | null>(null);
  const c = siteContent.soundtrack;

  const player = getSoundtrackPlayer();
  const [trackIndex, setTrackIndex] = useState(() => player.getSnapshot().trackIndex);
  useEffect(() => player.subscribe(() => setTrackIndex(player.getSnapshot().trackIndex)), [player]);

  if (phone) return null;

  const expanded = hover.mode === "expanded";
  const preview = hover.mode === "preview";
  const collapsed = hover.mode === "collapsed";
  const track = c.tracks[trackIndex];

  const open = (event: MouseEvent) => {
    setKeyboardOpen(event.detail === 0);
    send("open");
  };
  const collapse = () => {
    const hadFocus = Boolean(document.activeElement?.closest("[data-pill]"));
    send("collapse");
    if (hadFocus) requestAnimationFrame(() => capsuleRef.current?.focus({ preventScroll: true }));
  };

  // maxHeight collapses with maxWidth: without it the hidden two-line title
  // keeps the row about 50px tall and the capsule never rests at 26px.
  const reveal = (visible: boolean, maxWidth: string): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    flex: "0 0 auto",
    transition: reduce ? "opacity 220ms ease" : `max-width 280ms ${EASE}, max-height 280ms ${EASE}, opacity 220ms ease`,
    maxWidth: visible ? maxWidth : "0px",
    maxHeight: visible ? "48px" : "0px",
    opacity: visible ? 1 : 0,
  });

  const capsule: CSSProperties = {
    ...glass,
    display: "flex",
    alignItems: "center",
    gap: preview ? 12 : 7,
    padding: preview ? "8px 18px 8px 8px" : "5px 13px",
    borderRadius: 999,
    cursor: "pointer",
    color: "var(--color-foreground)",
    transition: reduce ? "opacity 280ms ease" : `opacity 280ms ease, transform 320ms ${EASE}, padding 300ms ease, gap 300ms ease`,
    opacity: expanded ? 0 : 1,
    transform: reduce || !expanded ? "none" : "scale(0.92)",
    pointerEvents: expanded ? "none" : "auto",
  };

  const tip: CSSProperties = {
    ...glass,
    position: "absolute",
    left: "50%",
    bottom: "calc(100% + 10px)",
    whiteSpace: "nowrap",
    transform: hover.tip ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(4px)",
    opacity: hover.tip ? 1 : 0,
    transition: `opacity 220ms ease, transform 220ms ${EASE}`,
    pointerEvents: "none",
    padding: "6px 11px",
    borderRadius: 999,
    color: "var(--color-muted)",
    fontSize: 11,
    fontFamily: "var(--font-sans)",
  };

  return (
    <div
      data-pill
      inert={!shown}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 30,
        zIndex: 45,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: shown ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
    >
      <div style={{ position: "relative", pointerEvents: shown ? "auto" : "none" }}>
        <div aria-hidden="true" style={tip}>
          {c.prompt}
        </div>
        <button
          ref={capsuleRef}
          type="button"
          inert={expanded}
          onClick={open}
          onMouseEnter={() => send("enter")}
          onMouseLeave={() => send("leave")}
          aria-label={c.ariaOpen}
          style={capsule}
        >
          <span style={reveal(collapsed, "24px")}>
            <Music aria-hidden="true" size={14} style={{ color: "var(--color-accent)" }} />
          </span>
          <span style={reveal(preview, "40px")}>
            <Cover size={38} cover={track.cover} />
          </span>
          <span style={{ ...reveal(preview, "190px"), display: "block" }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{track.title}</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
              {track.artist}
            </span>
          </span>
          <Glyph music={music} />
        </button>
        <PlayerCard
          music={music}
          expanded={expanded}
          reduce={reduce}
          focusOnOpen={keyboardOpen}
          onCardLeave={() => send("cardLeave")}
          onCollapse={collapse}
        />
      </div>
    </div>
  );
}
