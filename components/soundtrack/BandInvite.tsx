"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { Fill } from "@/components/fx/Fill";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { bandPlayerMounted } from "@/lib/player/machine";
import { usePlayerView } from "@/lib/player/viewStore";
import {
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  stopSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";
import { PRIMARY, QUIET, SMALL } from "./bandButtons";
import { DeclinedNote } from "./DeclinedNote";
import { PromptSubline } from "./PromptSubline";

// The band's copy and controls, the one place the music is offered, one quiet
// line: the question, its two answers beside it, and under it the line that
// says the wave moves with the reader or can be frozen (the freeze toggle is two
// words inside that line). The controls beside the question and the note under
// it swap per state, every layer stacked in one grid cell so the band never changes
// height (no layout shift when a stored choice restores after mount). Hidden
// layers are inert: not focusable, not clickable, not read. Answering moves
// focus to the note under the question, and Pause and Resume to each other,
// so keyboard users never land on the body.
//
// With the player in the band the player is the feedback: the status sentence
// and the Pause or Resume beside the heading go, and the rows close up under
// the heading. After "Not now" the note carries Play it and Freeze the wave
// beside it, and the stock pill's quiet capsule is the way back on desktop.
//
// The root carries data-wave-avoid: the waveform measures it and keeps its
// moving dots out from under this text. The controls carry
// data-wave-ripple-origin: an answer's ripple starts at their centre.
export function BandInvite() {
  const music = useSoundtrack();
  const c = siteContent.listen;
  const playerOwns = bandPlayerMounted(usePlayerView());
  // Nothing of the band's own shows then, so its rows close up under the heading instead of holding their height: the player sits right under the heading on a phone, and the wave's keep-out shrinks to the heading on a desktop. The controls keep their width, where an answer's ripple starts.
  const closedUp = playerOwns && (music === "on" || music === "paused");
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
    <div ref={rootRef} data-band-prompt="" data-wave-avoid data-wave-words className="pointer-events-auto w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
        <h2 className="font-display text-[clamp(1.0625rem,1.45vw,1.25rem)] leading-[1.1] text-foreground">{c.line}</h2>
        <div data-band-controls data-wave-ripple-origin className={`grid items-baseline ${closedUp ? "h-0 overflow-hidden" : ""}`}>
          <Layer shown={music === "before"} className="flex items-baseline gap-4">
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="before" data-focus-to="note" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
              {c.accept}
            </Fill>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-focus-to="note" onClick={act(stopSoundtrack)} data-cursor-hover {...QUIET}>
              {c.decline}
            </Fill>
          </Layer>
          <Layer shown={music === "on" && !playerOwns}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="on" onClick={act(pauseSoundtrack)} data-cursor-hover {...SMALL}>
              {c.pause}
            </Fill>
          </Layer>
          <Layer shown={music === "paused" && !playerOwns}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="paused" onClick={act(startSoundtrack)} data-cursor-hover {...SMALL}>
              {c.resume}
            </Fill>
          </Layer>
        </div>
      </div>
      {/* The line under the question stays through the answer (the freeze toggle is two words in it, the one freeze there is while the music plays); a decline brings the toggle beside Play it instead. */}
      <div data-band-subline="" inert={music === "off"} aria-hidden={music === "off" ? true : undefined} className={`mt-1.5 max-w-[42rem] text-sm leading-[1.5] text-muted ${music === "off" ? "hidden" : ""}`}>
        <PromptSubline />
      </div>
      <div data-band-note tabIndex={-1} className={`mt-1 grid max-w-[42rem] text-sm leading-[1.5] text-muted outline-none ${closedUp ? "hidden" : ""}`} aria-live="polite">
        <Layer shown={music === "on" && !playerOwns}>
          <p><InlineCopy source={c.acceptedNote} /></p>
        </Layer>
        <Layer shown={music === "paused" && !playerOwns}>
          <p>{c.pausedNote}</p>
        </Layer>
        <Layer shown={music === "off"}>
          <DeclinedNote onPlay={act(startSoundtrack)} />
        </Layer>
      </div>
    </div>
  );
}

function Layer({ shown, className = "", children }: { shown: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      inert={!shown}
      aria-hidden={shown ? undefined : true}
      className={`col-start-1 row-start-1 transition-opacity duration-300 ${shown ? "opacity-100 delay-150" : "opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}
