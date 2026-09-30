"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ExternalLink, Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { siteContent } from "@/lib/content";
import { getSoundtrackPlayer, type PlayerSnapshot } from "@/lib/audio";
import { useEscapeKey } from "@/lib/modal";
import { pauseSoundtrack, startSoundtrack, type SoundtrackState } from "@/lib/soundtrack";
import { Cover, EASE, formatTime, glass, iconButton } from "./PillParts";

type Props = {
  music: SoundtrackState;
  expanded: boolean;
  reduce: boolean;
  focusOnOpen: boolean; // opened from the keyboard: move focus into the card
  onCardLeave: () => void;
  onCollapse: () => void;
};

// The pill's open state: now playing, a seek bar, transport and volume. Every
// value comes from the player; the playhead is polled only while the card is
// open and playing. Escape closes it.
export function PlayerCard({ music, expanded, reduce, focusOnOpen, onCardLeave, onCollapse }: Props) {
  const c = siteContent.soundtrack;
  const player = getSoundtrackPlayer();
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.getSnapshot());
  const [position, setPosition] = useState(0);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const playing = music === "on";
  const track = c.tracks[snap.trackIndex];

  useEffect(() => {
    const sync = () => setSnap(player.getSnapshot());
    sync();
    return player.subscribe(sync);
  }, [player]);

  useEffect(() => {
    if (!expanded) return;
    const sync = () => setPosition(player.getPosition());
    const first = requestAnimationFrame(sync);
    const id = playing ? setInterval(sync, 500) : undefined;
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, [expanded, playing, player, snap.trackIndex]);

  useEffect(() => {
    if (expanded && focusOnOpen) playRef.current?.focus({ preventScroll: true });
  }, [expanded, focusOnOpen]);

  // A mouse open leaves focus on the page (the capsule turns inert under the
  // card), so Escape listens at the window, on the shared layered stack.
  useEscapeKey(expanded, onCollapse);

  // Derive from the player's live index, not render state, so two rapid
  // clicks never target the same base index and lose one.
  const changeTrack = (direction: number) => {
    player.selectTrack(player.getSnapshot().trackIndex + direction, playing);
    setPosition(0);
  };

  const style: CSSProperties = {
    ...glass,
    position: "absolute",
    bottom: 0,
    left: "50%",
    width: 342,
    padding: 18,
    borderRadius: 22,
    transformOrigin: "bottom center",
    transition: reduce ? "opacity 300ms ease" : `opacity 300ms ease, transform 340ms ${EASE}`,
    opacity: expanded ? 1 : 0,
    pointerEvents: expanded ? "auto" : "none",
    transform: reduce
      ? "translateX(-50%)"
      : expanded
        ? "translateX(-50%) translateY(0) scale(1)"
        : "translateX(-50%) translateY(10px) scale(0.95)",
  };
  const small: CSSProperties = { fontSize: 10, fontVariantNumeric: "tabular-nums", color: "var(--color-muted)" };
  const range: CSSProperties = { flex: "1 1 auto", minWidth: 0, accentColor: "var(--color-accent)", cursor: "pointer" };

  return (
    <div
      inert={!expanded}
      onMouseLeave={onCardLeave}
      style={style}
      role="group"
      aria-label={c.ariaOpen}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Cover size={56} cover={track.cover} />
        <span style={{ flex: "1 1 auto", minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontSize: 19,
              lineHeight: 1.15,
              color: "var(--color-foreground)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {track.title}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{track.artist}</span>
        </span>
        <button type="button" onClick={onCollapse} aria-label={c.ariaCollapse} style={iconButton(28)}>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <span style={small}>{formatTime(position)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(snap.duration))}
          value={position}
          onChange={(event) => {
            const seconds = Number(event.target.value);
            player.seek(seconds);
            setPosition(seconds);
          }}
          aria-label={c.ariaSeek}
          style={range}
        />
        <span style={small}>{formatTime(Math.max(0, snap.duration - position))}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button type="button" onClick={() => changeTrack(-1)} aria-label={c.ariaPrevious} style={iconButton()}>
            <SkipBack aria-hidden="true" size={17} fill="currentColor" />
          </button>
          <button
            ref={playRef}
            type="button"
            onClick={() => (playing ? pauseSoundtrack() : startSoundtrack())}
            aria-label={playing ? c.ariaPause : c.ariaPlay}
            style={{
              ...iconButton(42),
              border: "none",
              background: "var(--color-accent)",
              color: "var(--color-background)",
            }}
          >
            {playing ? <Pause aria-hidden="true" size={16} fill="currentColor" /> : <Play aria-hidden="true" size={16} fill="currentColor" />}
          </button>
          <button type="button" onClick={() => changeTrack(1)} aria-label={c.ariaNext} style={iconButton()}>
            <SkipForward aria-hidden="true" size={17} fill="currentColor" />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: 96, marginRight: 6 }}>
          <Volume2 aria-hidden="true" size={15} style={{ color: "var(--color-muted)", flex: "0 0 auto" }} />
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(snap.volume * 100)}
            onChange={(event) => player.setVolume(Number(event.target.value) / 100)}
            aria-label={c.ariaVolume}
            style={range}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          paddingTop: 13,
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-muted)" }}>
          {playing ? c.statusPlaying : music === "paused" ? c.statusPaused : c.statusReady}
        </span>
        {track.spotifyUrl && (
          <a
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-accent)" }}
          >
            {c.openInSpotify}
            <ExternalLink aria-hidden="true" size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
