"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { Portal } from "./Portal";
import { siteContent } from "@/lib/content";
import {
  useSoundtrack,
  setSoundtrackState,
  initSoundtrackFromStorage,
  type SoundtrackState,
} from "@/lib/soundtrack";

// The glass playback pill (spec section 6). Collapsed 26px capsule by default,
// grows to a now-playing preview on hover, opens to a full player card on click,
// dynamic-island style. It is the visible half of the soundtrack feature and the
// in-flow entry choice (spec section 5): clicking the "Play the soundtrack" invite
// opts in. Opted out (music off) removes the pill entirely; re-entry is the menu's
// Soundtrack control. Portaled to body so the pinned #hero-pin transform never
// captures this fixed element. It reads and writes lib/soundtrack.ts, the same
// state the waveform reads, so the pill glyph and the background never disagree.
//
// Phase 3 drives the stub source through this state; the transport toggles it and
// cycles the placeholder playlist. Phase 4 swaps the source behind AudioFrame with
// no change here. Deferred on mobile in v1 (spec section 9), like the waveform.

const EASE = "var(--ease-out)";
const MOBILE_MAX = 767;
const PROMPT_DELAY = 500;
const GRACE_MS = 2500;
const SUPPRESS_MS = 180;
const DURATION = 189; // placeholder track length (3:09) until Phase 4 wires real

const glass: CSSProperties = {
  background: "var(--color-glass-strong)",
  border: "1px solid var(--color-border)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function PlaybackPill() {
  return (
    <Portal>
      <PillInner />
    </Portal>
  );
}

function PillInner() {
  const music = useSoundtrack();
  const reduce = useReducedMotion();
  const c = siteContent.soundtrack;

  const [isMobile, setIsMobile] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [pill, setPill] = useState<"collapsed" | "preview" | "expanded">("collapsed");
  const [promptVisible, setPromptVisible] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [volume, setVolume] = useState(70);
  const [position, setPosition] = useState(0);

  const promptTimer = useRef<ReturnType<typeof setTimeout>>();
  const graceTimer = useRef<ReturnType<typeof setTimeout>>();
  const suppressTimer = useRef<ReturnType<typeof setTimeout>>();
  const recentExpanded = useRef(false);
  const suppressEnter = useRef(false);

  // Desktop + back-half gating: the pill appears once the pinned ring/deck has
  // cleared (spec 5.1), stays for the whole back half, and re-hides only if the
  // visitor scrolls back up into the hero. Deferred on mobile in v1. Using #work's
  // top vs the viewport (not an intersection flag) is what keeps it revealed past
  // Work through About / Connect; an isIntersecting observer dropped it after Work.
  useEffect(() => {
    initSoundtrackFromStorage();
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const work = document.getElementById("work");
    const evalReveal = () => {
      if (work) setRevealed(work.getBoundingClientRect().top < window.innerHeight * 0.12);
    };
    evalReveal();
    window.addEventListener("scroll", evalReveal, { passive: true });
    window.addEventListener("resize", evalReveal);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("scroll", evalReveal);
      window.removeEventListener("resize", evalReveal);
    };
  }, []);

  // Reset to the collapsed capsule when opted out, so re-entry starts collapsed.
  useEffect(() => {
    if (music === "off") {
      setPill("collapsed");
      setPromptVisible(false);
    }
  }, [music]);

  // A fake playhead so the scrubber feels alive on the stub; Phase 4 replaces it
  // with the real Spotify position.
  useEffect(() => {
    if (music !== "on") return;
    const id = setInterval(() => {
      setPosition((p) => {
        if (p + 1 >= DURATION) {
          setTrackIndex((i) => (i + 1) % c.tracks.length);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [music, c.tracks.length]);

  useEffect(
    () => () => {
      clearTimeout(promptTimer.current);
      clearTimeout(graceTimer.current);
      clearTimeout(suppressTimer.current);
    },
    [],
  );

  if (isMobile || music === "off") return null;

  const playing = music === "on";
  const isExpanded = pill === "expanded";
  const isPreview = pill === "preview";
  const isCollapsed = !isExpanded && !isPreview;
  // "before" = no choice made yet: show the entry prompt card in place of the
  // capsule; answering it morphs the card into the pill (yes) or clears it (no).
  const inviting = music === "before";
  const track = c.tracks[trackIndex];
  const title = music === "before" ? c.invite : track.title;
  const artist = music === "before" ? c.inviteArtist : track.artist;
  const footLabel = playing ? c.statusPlaying : music === "paused" ? c.statusPaused : c.statusReady;

  const onEnter = () => {
    if (isExpanded || suppressEnter.current) return;
    clearTimeout(promptTimer.current);
    if (recentExpanded.current) {
      setPill("expanded");
      setPromptVisible(false);
      return;
    }
    setPill("preview");
    if (!reduce) promptTimer.current = setTimeout(() => setPromptVisible(true), PROMPT_DELAY);
  };
  const onLeave = () => {
    clearTimeout(promptTimer.current);
    if (!isExpanded) {
      setPill("collapsed");
      setPromptVisible(false);
    }
  };
  const onClick = () => {
    clearTimeout(promptTimer.current);
    clearTimeout(graceTimer.current);
    recentExpanded.current = false;
    if (music === "before") setSoundtrackState("on"); // the invite opts in
    setPill("expanded");
    setPromptVisible(false);
  };
  // Cursor leaves the expanded card: minimize, but remember "expanded" briefly so
  // a quick re-hover snaps back (spec 6.4 auto-minimize + grace window).
  const onCardLeave = () => {
    setPill("collapsed");
    setPromptVisible(false);
    recentExpanded.current = true;
    clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => (recentExpanded.current = false), GRACE_MS);
    suppressEnter.current = true;
    clearTimeout(suppressTimer.current);
    suppressTimer.current = setTimeout(() => (suppressEnter.current = false), SUPPRESS_MS);
  };
  const onCollapse = () => {
    clearTimeout(graceTimer.current);
    recentExpanded.current = false;
    setPill("collapsed");
    setPromptVisible(false);
  };
  const onPlayPause = () => setSoundtrackState(playing ? "paused" : "on");
  const changeTrack = (dir: number) => {
    setTrackIndex((i) => (i + dir + c.tracks.length) % c.tracks.length);
    setPosition(0);
  };

  // maxHeight collapses to 0 alongside maxWidth: without it the hidden two-line
  // title/artist keeps the row ~50px tall even when collapsed, so the capsule
  // must clamp height too to rest at ~26px.
  const wrap = (shown: boolean, maxW: string): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    flex: "0 0 auto",
    transition: reduce
      ? "opacity 220ms ease"
      : `max-width 280ms ${EASE}, max-height 280ms ${EASE}, opacity 220ms ease`,
    maxWidth: shown ? maxW : "0px",
    maxHeight: shown ? "48px" : "0px",
    opacity: shown ? 1 : 0,
  });

  const compactStyle: CSSProperties = {
    ...glass,
    display: "flex",
    alignItems: "center",
    gap: isPreview ? 12 : 7,
    padding: isPreview ? "8px 18px 8px 8px" : "5px 13px",
    borderRadius: 999,
    cursor: "pointer",
    color: "var(--color-foreground)",
    transition: reduce
      ? "opacity 280ms ease"
      : `opacity 280ms ease, transform 320ms ${EASE}, padding 300ms ease, gap 300ms ease`,
    opacity: isExpanded || inviting ? 0 : 1,
    transform: reduce ? "none" : isExpanded ? "scale(0.92)" : "scale(1)",
    pointerEvents: isExpanded || inviting ? "none" : "auto",
  };

  const promptCardStyle: CSSProperties = {
    ...glass,
    position: "absolute",
    bottom: 0,
    left: "50%",
    width: 320,
    padding: 18,
    borderRadius: 20,
    transformOrigin: "bottom center",
    transition: reduce ? "opacity 300ms ease" : `opacity 320ms ease, transform 360ms ${EASE}`,
    opacity: inviting ? 1 : 0,
    pointerEvents: inviting ? "auto" : "none",
    transform: reduce
      ? "translateX(-50%)"
      : inviting
        ? "translateX(-50%) translateY(0) scale(1)"
        : "translateX(-50%) translateY(6px) scale(0.9)",
  };

  const promptStyle: CSSProperties = {
    ...glass,
    position: "absolute",
    left: "50%",
    bottom: "calc(100% + 10px)",
    whiteSpace: "nowrap",
    transform: promptVisible
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(4px)",
    opacity: promptVisible ? 1 : 0,
    transition: `opacity 220ms ease, transform 220ms ${EASE}`,
    pointerEvents: "none",
    padding: "6px 11px",
    borderRadius: 999,
    color: "var(--color-muted)",
    fontSize: 11,
    fontFamily: "var(--font-grotesk)",
    letterSpacing: "0.04em",
  };

  const expandedStyle: CSSProperties = {
    ...glass,
    position: "absolute",
    bottom: 0,
    left: "50%",
    width: 342,
    padding: 18,
    borderRadius: 22,
    transformOrigin: "bottom center",
    transition: reduce ? "opacity 300ms ease" : `opacity 300ms ease, transform 340ms ${EASE}`,
    opacity: isExpanded ? 1 : 0,
    pointerEvents: isExpanded ? "auto" : "none",
    transform: reduce
      ? "translateX(-50%)"
      : isExpanded
        ? "translateX(-50%) translateY(0) scale(1)"
        : "translateX(-50%) translateY(10px) scale(0.95)",
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 30,
        zIndex: 45,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: revealed ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
      aria-hidden={!revealed}
    >
      <div style={{ position: "relative", pointerEvents: revealed ? "auto" : "none" }}>
        <div style={promptStyle}>{c.prompt}</div>

        <button
          type="button"
          onClick={onClick}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          aria-label={c.ariaOpen}
          style={compactStyle}
        >
          <span style={wrap(isCollapsed, "24px")}>
            <Music aria-hidden="true" size={14} style={{ color: "var(--color-accent)" }} />
          </span>
          <span style={wrap(isPreview, "40px")}>
            <Cover size={38} cover={track.cover} />
          </span>
          <span style={{ ...wrap(isPreview, "190px"), display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-foreground)",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
            <span
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--color-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {artist}
            </span>
          </span>
          <Glyph music={music} />
        </button>

        <div onMouseLeave={onCardLeave} style={expandedStyle} role="group" aria-label={c.ariaOpen}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Cover size={56} cover={track.cover} />
            <span style={{ flex: "1 1 auto", minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-serif)",
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
              <span style={{ display: "block", fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                {track.artist}
              </span>
            </span>
            <button
              type="button"
              onClick={onCollapse}
              aria-label={c.ariaCollapse}
              style={iconBtn(28)}
            >
              <ChevronDown aria-hidden="true" size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: "var(--color-muted)" }}>
              {fmt(position)}
            </span>
            <input
              type="range"
              min={0}
              max={DURATION}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              aria-label={c.ariaSeek}
              style={{ flex: "1 1 auto", minWidth: 0, accentColor: "var(--color-accent)", cursor: "pointer" }}
            />
            <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", color: "var(--color-muted)" }}>
              {fmt(DURATION - position)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <button type="button" onClick={() => changeTrack(-1)} aria-label={c.ariaPrevious} style={iconBtn()}>
                <SkipBack aria-hidden="true" size={17} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={onPlayPause}
                aria-label={playing ? c.ariaPause : c.ariaPlay}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: "var(--color-accent)",
                  color: "var(--color-background)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {playing ? (
                  <Pause aria-hidden="true" size={16} fill="currentColor" />
                ) : (
                  <Play aria-hidden="true" size={16} fill="currentColor" />
                )}
              </button>
              <button type="button" onClick={() => changeTrack(1)} aria-label={c.ariaNext} style={iconBtn()}>
                <SkipForward aria-hidden="true" size={17} fill="currentColor" />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: 96, marginRight: 6 }}>
              <Volume2 aria-hidden="true" size={15} style={{ color: "var(--color-muted)", flex: "0 0 auto" }} />
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label={c.ariaVolume}
                style={{ flex: "1 1 auto", minWidth: 0, accentColor: "var(--color-accent)", cursor: "pointer" }}
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
            <span
              style={{
                fontFamily: "var(--font-grotesk)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--color-muted)",
              }}
            >
              {footLabel}
            </span>
            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "var(--color-accent)",
              }}
            >
              {c.openInSpotify}
              <ExternalLink aria-hidden="true" size={12} />
            </a>
          </div>
        </div>

        <div style={promptCardStyle} role="group" aria-label={c.promptQuestion}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              lineHeight: 1.35,
              color: "var(--color-foreground)",
            }}
          >
            {c.promptQuestion}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setSoundtrackState("on")}
              style={{
                flex: "1 1 0",
                padding: "9px 14px",
                borderRadius: 999,
                border: "none",
                background: "var(--color-accent)",
                color: "var(--color-background)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {c.promptYes}
            </button>
            <button
              type="button"
              onClick={() => setSoundtrackState("off")}
              style={{
                flex: "1 1 0",
                padding: "9px 14px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-muted)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {c.promptNo}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function iconBtn(size?: number): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: size ? "1px solid var(--color-border)" : "none",
    borderRadius: size ? 999 : 0,
    width: size,
    height: size,
    padding: 0,
    color: size ? "var(--color-muted)" : "var(--color-foreground)",
    cursor: "pointer",
    flex: "0 0 auto",
  };
}

function Cover({ size, cover }: { size: number; cover: string | null }) {
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size >= 48 ? 12 : 10,
        overflow: "hidden",
        display: "block",
        flex: "0 0 auto",
        border: "1px solid var(--color-border)",
        background: "var(--color-glass)",
        backgroundImage: cover ? `url(${cover})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {!cover && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--color-border) 0 6px, transparent 6px 12px)",
            opacity: 0.6,
          }}
        />
      )}
    </span>
  );
}

// The pill's live glyph mirrors the same audio state the big wave shows (spec
// 6.2): playing bounces the bars, paused / awaiting drops to a flat line, and
// before-a-choice shows a play affordance.
function Glyph({ music }: { music: SoundtrackState }) {
  if (music === "on") return <Equalizer />;
  if (music === "before")
    return (
      <span style={{ display: "flex", alignItems: "center", color: "var(--color-accent)" }}>
        <Play aria-hidden="true" size={13} fill="currentColor" />
      </span>
    );
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 14 }}>
      <span
        style={{
          display: "block",
          width: 16,
          height: 2,
          borderRadius: 1,
          background: "var(--color-muted)",
          opacity: 0.7,
        }}
      />
    </span>
  );
}

function Equalizer() {
  const dur = [0.7, 1.0, 0.55, 0.85];
  const delay = [0, 0.18, 0.4, 0.12];
  const h = [0.7, 1, 0.5, 0.85];
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
      {h.map((m, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 2,
            height: 14 * m,
            borderRadius: 2,
            background: "var(--color-accent)",
            transformOrigin: "bottom center",
            animation: `eqbar ${dur[i]}s ease-in-out infinite`,
            animationDelay: `${delay[i]}s`,
          }}
        />
      ))}
    </span>
  );
}
