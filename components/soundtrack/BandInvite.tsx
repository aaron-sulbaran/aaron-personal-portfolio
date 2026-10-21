"use client";

import { useEffect, useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { Fill } from "@/components/fx/Fill";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { usePlayerBridge } from "@/lib/player/bridge";
import {
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  stopSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { PRIMARY, QUIET, SMALL } from "./bandButtons";
import { DeclinedNote } from "./DeclinedNote";

// The band's copy and controls, the one place the music is offered. The
// heading is the question; the controls beside it and the note under it swap
// per state, every layer stacked in one grid cell so the band never changes
// height (no layout shift when a stored choice restores after mount). Hidden
// layers are inert: not focusable, not clickable, not read. Answering moves
// focus to the note under the question, and Pause and Resume to each other,
// so keyboard users never land on the body. Once declined, re-entry is the
// pill's quiet capsule on desktop and "Play it" beside the note on phones
// (the Menu's note works everywhere).
//
// The root carries data-wave-avoid: the waveform measures it and keeps its
// moving dots out from under this text. The controls carry
// data-wave-ripple-origin: an answer's ripple starts at their centre.
export function BandInvite() {
  const music = useSoundtrack();
  const c = siteContent.listen;
  // The music player lab (dev only): with its sheet in the band the sheet is the feedback, so the status sentence and the Pause or Resume go; in production the bridge always reads today's values.
  const bridge = usePlayerBridge();
  const sheetOwns = bridge.status === "hidden";
  // Hydration renders the server snapshot, so the desktop copy matches the server HTML; the phone copy applies after hydration, while its layer is still hidden.
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const acceptedNote = phone ? c.acceptedNotePhone : c.acceptedNote;
  const moveFocus = useRef<"note" | "control" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initSoundtrackFromStorage();
  }, []);

  useEffect(() => {
    const to = moveFocus.current;
    if (!to) return;
    moveFocus.current = null;
    const root = rootRef.current;
    const target = to === "note" ? root?.querySelector<HTMLElement>("[data-band-note]") : root?.querySelector<HTMLElement>(`[data-control="${music}"]`);
    target?.focus({ preventScroll: true });
  }, [music]);

  // Each runs inside the click, which is what lets audio start under the
  // browser's autoplay policy. Answering the question lands focus on the
  // note, so the question is not read again; Pause and Resume hand focus to
  // each other.
  const act = (write: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    moveFocus.current = event.currentTarget.dataset.focusTo === "note" ? "note" : "control";
    write();
  };

  return (
    <div ref={rootRef} data-wave-avoid data-wave-words className="pointer-events-auto w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-9 gap-y-3">
        <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
        <div data-band-controls data-wave-ripple-origin className="grid items-baseline">
          <Layer shown={music === "before"} className="flex items-baseline gap-4">
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="before" data-focus-to="note" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
              {c.accept}
            </Fill>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-focus-to="note" onClick={act(stopSoundtrack)} data-cursor-hover {...QUIET}>
              {c.decline}
            </Fill>
          </Layer>
          <Layer shown={music === "on" && !sheetOwns}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="on" onClick={act(pauseSoundtrack)} data-cursor-hover {...SMALL}>
              {c.pause}
            </Fill>
          </Layer>
          <Layer shown={music === "paused" && !sheetOwns}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="paused" onClick={act(startSoundtrack)} data-cursor-hover {...SMALL}>
              {c.resume}
            </Fill>
          </Layer>
        </div>
      </div>
      <div data-band-note tabIndex={-1} className="mt-2 grid max-w-[42rem] text-sm leading-[1.5] text-muted outline-none" aria-live="polite">
        <Layer shown={music === "before"}>
          <p><InlineCopy source={c.body} /></p>
        </Layer>
        <Layer shown={music === "on" && !sheetOwns}>
          <p><InlineCopy source={acceptedNote} /></p>
        </Layer>
        <Layer shown={music === "paused" && !sheetOwns}>
          <p>{c.pausedNote}</p>
        </Layer>
        <Layer shown={music === "off"}>
          {bridge.notNow === "buttons" ? (
            <DeclinedNote onPlay={act(startSoundtrack)} />
          ) : (
            <p>
              {c.declinedNote}{" "}
              <Fill {...FILL_PICK.band} shape="rect" type="button" onClick={act(startSoundtrack)} data-cursor-hover {...SMALL} className={`md:hidden ${SMALL.className}`}>
                {c.accept}
              </Fill>
            </p>
          )}
        </Layer>
      </div>
    </div>
  );
}

function Layer({ shown, className = "", children }: { shown: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      inert={!shown}
      className={`col-start-1 row-start-1 transition-opacity duration-300 ${shown ? "opacity-100 delay-150" : "opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}
