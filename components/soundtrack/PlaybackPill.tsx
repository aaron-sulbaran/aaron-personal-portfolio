"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FocusEvent, type MouseEvent } from "react";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { getSoundtrackPlayer } from "@/lib/audio";
import { getPlayFailed, getRestoredSoundtrack, startSoundtrack, subscribeSoundtrack, useSoundtrack } from "@/lib/soundtrack";
import { DOCK, capsuleText, dockLabel, dockMode, type DockLabel } from "@/lib/waveform/dock";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { Cover, DockGlyph, EASE, glass, reveal } from "./PillParts";
import { PillAnnouncer, PillLabel, labelLine, useLabelHold } from "./PillLabel";
import { PlayerCard } from "./PlayerCard";
import { usePillArrival } from "./usePillArrival";
import { usePillHover } from "./usePillHover";
import { useReducedMotionLive } from "./useReducedMotionLive";

const GREETED_KEY = "aaron-soundtrack-greeted";

function readGreeted(): boolean {
  try {
    return sessionStorage.getItem(GREETED_KEY) !== null;
  } catch {
    return false;
  }
}

// The glass playback pill, docked at the bottom left on the wave's line
// (lib/waveform/dock). From the band down it is there in every music state:
// it condenses out of the band control the visitor pressed (usePillArrival),
// lands open with one line for the state (PillLabel), then collapses to a
// 36px capsule: the track title, "Paused", "Music?" or "Music". Before a yes
// (or after a failed start) one click plays; otherwise hover grows the
// now-playing preview and a click opens the player card. Every hidden layer
// is inert, so nothing invisible is focusable. Portaled to body so no
// transformed ancestor captures it. Phones have no pill; there the band and
// the Menu's note are the controls.
export function PlaybackPill({ reached }: { reached: boolean }) {
  return (
    <Portal>
      <PillInner reached={reached} />
    </Portal>
  );
}

function PillInner({ reached }: { reached: boolean }) {
  const music = useSoundtrack();
  const failed = useSyncExternalStore(subscribeSoundtrack, getPlayFailed, () => false);
  const reduce = useReducedMotionLive();
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => true);
  const [greetedAtLoad] = useState(readGreeted);
  // Labels shown this page load. "unanswered" has no line: that pill arrives as the capsule.
  const [labelsShown, setLabelsShown] = useState<ReadonlySet<DockLabel>>(() => new Set(["unanswered"]));
  const [wasFailed, setWasFailed] = useState(failed);
  const [held, setHeld] = useState({ pointer: false, focus: false });
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const capsuleRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  const c = siteContent.soundtrack;

  // A new failure speaks again, even if an earlier one already did.
  if (failed !== wasFailed) {
    setWasFailed(failed);
    if (failed && labelsShown.has("failed")) setLabelsShown(new Set([...labelsShown].filter((k) => k !== "failed")));
  }

  // A restored opt-in is greeted once per session and lands as the quiet
  // "Paused" capsule on later loads; a restored opt-out gets the quiet capsule.
  const restored = getRestoredSoundtrack();
  const input = { music, reached, phone, failed, returning: restored === "paused" && !greetedAtLoad, labelShown: false };
  const kind = dockLabel(input);
  const quietRestore = (restored === "off" && kind === "declined") || (restored === "paused" && greetedAtLoad && kind === "accepted");
  const labelShown = labelsShown.has(kind) || quietRestore;
  const mode = dockMode({ ...input, labelShown });
  const shown = mode !== "hidden";
  const line = labelLine(kind);

  const { present, landed } = usePillArrival(wrapperRef, shown, reduce);
  const [hover, send] = usePillHover(reduce, shown);
  const expanded = hover.mode === "expanded";

  const markShown = (shownKind: DockLabel) => {
    setLabelsShown((labels) => (labels.has(shownKind) ? labels : new Set(labels).add(shownKind)));
    if (shownKind !== "returning") return;
    try {
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  };
  useLabelHold(kind, mode === "label" && landed, held.pointer || held.focus || expanded, markShown);

  const player = getSoundtrackPlayer();
  const [trackIndex, setTrackIndex] = useState(() => player.getSnapshot().trackIndex);
  useEffect(() => player.subscribe(() => setTrackIndex(player.getSnapshot().trackIndex)), [player]);

  // Closing the card from inside it hands focus back to the capsule, once the
  // commit has lifted the capsule's inert.
  useEffect(() => {
    if (hover.mode !== "collapsed" || !restoreFocus.current) return;
    restoreFocus.current = false;
    capsuleRef.current?.focus({ preventScroll: true });
  }, [hover.mode]);

  if (phone) return null;

  const track = c.tracks[trackIndex];
  const startsMusic = music === "before" || music === "off" || failed;
  const previewable = mode === "capsule" && !startsMusic;
  const preview = hover.mode === "preview" && previewable;

  // Runs inside the click, which is what lets audio start under the browser's autoplay policy.
  const press = (event: MouseEvent) => {
    if (mode === "label") markShown(kind);
    if (startsMusic) {
      startSoundtrack();
      return;
    }
    setKeyboardOpen(event.detail === 0);
    send("open");
  };
  const collapse = () => {
    restoreFocus.current = Boolean(document.activeElement?.closest("[data-pill]"));
    send("collapse");
  };
  // Only keyboard focus holds the label: a mouse click focuses the capsule too,
  // and that must not pin the label open.
  const focus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target.matches(":focus-visible")) setHeld((h) => ({ ...h, focus: true }));
  };
  const blur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld((h) => ({ ...h, focus: false }));
  };

  const capsule: CSSProperties = {
    ...glass,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
    minHeight: DOCK.capsulePx,
    padding: preview ? "8px 16px 8px 8px" : "0 16px 0 13px",
    borderRadius: 999,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    color: "var(--color-foreground)",
    transition: reduce ? "opacity 280ms ease" : `opacity 280ms ease, transform 320ms ${EASE}, padding 300ms ease`,
    opacity: expanded ? 0 : 1,
    transform: reduce || !expanded ? "none" : "scale(0.92)",
    pointerEvents: expanded ? "none" : "auto",
  };

  const tip: CSSProperties = {
    ...glass,
    position: "absolute",
    left: 0,
    bottom: "calc(100% + 10px)",
    whiteSpace: "nowrap",
    transform: hover.tip ? "translateY(0)" : "translateY(4px)",
    opacity: hover.tip && preview ? 1 : 0,
    transition: `opacity 220ms ease, transform 220ms ${EASE}`,
    pointerEvents: "none",
    padding: "6px 11px",
    borderRadius: 999,
    color: "var(--color-muted)",
    fontSize: 11,
    fontFamily: "var(--font-sans)",
  };

  return (
    <>
      <div
        data-pill
        inert={!shown}
        style={{
          position: "fixed",
          left: 0,
          right: "var(--scrollbar-comp, 0px)",
          bottom: DOCK.baselineFromBottomPx - DOCK.capsulePx / 2,
          zIndex: 45,
          display: "flex",
          justifyContent: "flex-start",
          paddingLeft: DOCK.insetPx,
          pointerEvents: "none",
          opacity: present ? 1 : 0,
        }}
      >
        <div
          ref={wrapperRef}
          onMouseEnter={() => setHeld((h) => ({ ...h, pointer: true }))}
          onMouseLeave={() => setHeld((h) => ({ ...h, pointer: false }))}
          onFocus={focus}
          onBlur={blur}
          style={{ position: "relative", pointerEvents: shown ? "auto" : "none" }}
        >
          <div aria-hidden="true" style={tip}>
            {c.prompt}
          </div>
          <button
            ref={capsuleRef}
            type="button"
            className="pill-hit"
            inert={expanded}
            onClick={press}
            onMouseEnter={() => previewable && send("enter")}
            onMouseLeave={() => send("leave")}
            aria-label={`${capsuleText(music, track.title)}. ${startsMusic ? c.invite : c.ariaOpen}`}
            data-cursor-hover
            style={{ ...capsule, ["--pill-hit-inset" as string]: `${(DOCK.hitPx - DOCK.capsulePx) / 2}px` }}
          >
            <span style={reveal(preview, "40px", reduce)}>
              <Cover size={38} cover={track.cover} />
            </span>
            <span style={{ ...reveal(preview, "190px", reduce, 280, 12), display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 500 }}>{track.title}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--color-muted)" }}>{track.artist}</span>
            </span>
            <span style={{ display: "flex", marginLeft: preview ? 12 : 0, transition: `margin 280ms ${EASE}` }}>
              <DockGlyph music={music} />
            </span>
            <PillLabel line={line} open={mode === "label"} reduce={reduce} />
            <span style={reveal(mode === "capsule" && !preview, "220px", reduce, DOCK.collapseMs, 8)}>
              <span style={{ fontSize: 12, fontWeight: 500, color: music === "on" ? "var(--color-foreground)" : "var(--color-muted)" }}>
                {capsuleText(music, track.title)}
              </span>
            </span>
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
      <PillAnnouncer line={mode === "label" ? line : null} />
    </>
  );
}
