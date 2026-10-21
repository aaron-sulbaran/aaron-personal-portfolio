"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FocusEvent } from "react";
import { Portal } from "@/components/Portal";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK, FILL_TRANSITION } from "@/lib/fx/fill";
import { isKeyboardFocus } from "@/lib/input/modality";
import { getSoundtrackPlayer } from "@/lib/audio";
import { getPlayFailed, getRestoredSoundtrack, startSoundtrack, subscribeSoundtrack, useSoundtrack } from "@/lib/soundtrack";
import { DOCK, capsuleName, capsuleText, dockLabel, dockMode, type DockLabel } from "@/lib/waveform/dock";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { DockGlyph, PillSlot, glass } from "./PillParts";
import { PillAnnouncer, PillLabel, labelLine, useLabelHold } from "./PillLabel";
import { GREETED_KEY } from "@/lib/home/firstVisit";
import { usePillFade } from "./usePillFade";
import { useReducedMotionLive } from "./useReducedMotionLive";

function readGreeted(): boolean {
  try {
    return sessionStorage.getItem(GREETED_KEY) !== null;
  } catch {
    return false;
  }
}

// The stock playback pill, docked at the bottom left on the wave's line
// (lib/waveform/dock): the way back to the music when no music is playing.
// From the band down it fades in at its dock once the band is above the dock
// line (usePillFade), opens with one line for the state (PillLabel), then
// collapses to a 36px capsule: "Music?" before an answer, "Music" after a no,
// "Paused" for a restored yes, or the failure when the audio could not start.
// One click plays, and the player (components/player) takes the isle: the pill
// steps away for as long as the music is playing or paused in the player. Every
// hidden layer is inert, so nothing invisible is focusable. Portaled to body so
// no transformed ancestor captures it. Phones have no pill; there the band is
// the control.
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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
  const [lastFace, setLastFace] = useState(mode);
  if (shown && mode !== lastFace) setLastFace(mode);
  const line = labelLine(kind);

  const { present, landed } = usePillFade(wrapperRef, shown);
  // The face the pill shows: while it fades out it keeps the slots it had, so
  // its box holds still in place; once it is away the slots close, so each
  // fade in opens from closed.
  const face = shown ? mode : present ? lastFace : "hidden";

  const markShown = (shownKind: DockLabel) => {
    setLabelsShown((labels) => (labels.has(shownKind) ? labels : new Set(labels).add(shownKind)));
    if (shownKind !== "returning") return;
    try {
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  };
  useLabelHold(kind, mode === "label" && landed, held.pointer || held.focus, markShown);

  const player = getSoundtrackPlayer();
  const [trackIndex, setTrackIndex] = useState(() => player.getSnapshot().trackIndex);
  useEffect(() => player.subscribe(() => setTrackIndex(player.getSnapshot().trackIndex)), [player]);

  if (phone) return null;

  const track = c.tracks[trackIndex];

  // Runs inside the click, which is what lets audio start under the browser's autoplay policy.
  const press = () => {
    if (mode === "label") markShown(kind);
    startSoundtrack();
  };
  // Only keyboard focus holds the label: a mouse click focuses the capsule too,
  // and that must not pin the label open.
  const focus = (event: FocusEvent<HTMLDivElement>) => {
    if (isKeyboardFocus(event.target)) setHeld((h) => ({ ...h, focus: true }));
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
    padding: "0 16px 0 13px",
    borderRadius: 999,
    cursor: "pointer",
    transition: `opacity 280ms ease, ${FILL_TRANSITION}`,
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
          <Fill
            {...FILL_PICK.capsule}
            className="pill-hit font-label text-label-sm text-foreground"
            onClick={press}
            aria-label={capsuleName(capsuleText(music, track.title), c.invite)}
            data-cursor-hover
            style={{ ...capsule, ["--pill-hit-inset" as string]: `${(DOCK.hitPx - DOCK.capsulePx) / 2}px` }}
            overClassName="flex items-center pl-[13px] pr-4"
          >
            <span className="relative -top-px flex">
              <DockGlyph music={music} />
            </span>
            <PillLabel line={line} open={face === "label"} reduce={reduce} />
            <PillSlot visible={face === "capsule"} maxWidth={220} reduce={reduce} ms={DOCK.collapseMs} before={8}>
              <span className={`font-label text-label-sm ${music === "on" ? "text-foreground" : "text-muted"}`}>
                {capsuleText(music, track.title)}
              </span>
            </PillSlot>
          </Fill>
        </div>
      </div>
      <PillAnnouncer line={mode === "label" ? line : null} />
    </>
  );
}
