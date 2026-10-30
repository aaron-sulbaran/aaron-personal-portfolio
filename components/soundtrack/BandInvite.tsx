"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { bandPlayerMounted } from "@/lib/player/machine";
import { usePlayerView } from "@/lib/player/viewStore";
import {
  getRestoredSoundtrack,
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  stopSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";
import { PRIMARY, QUIET, SMALL } from "./bandButtons";

// The band's copy and controls, the one place the music is offered, one quiet
// line: the question, and beside it the answer for the state. Before an answer,
// Play it and Not now; while the music plays, one Pause; paused, one Resume;
// after a Not now, one Play it. Nothing else is said here: no sub-line, no
// note (the wave's freeze lives in the Menu's chip and the open player). Every
// layer is stacked in one grid cell so the band never changes height (no layout
// shift when a stored choice restores after mount). Hidden layers are inert: not
// focusable, not clickable, not read. Answering moves focus to the control the
// state brings (Pause and Resume hand it to each other), so keyboard users never
// land on the body.
//
// A returning visitor has answered, and the band stops asking: the stored choice
// restores (initSoundtrackFromStorage), the question goes, and the one control
// left is Play it, for a stored yes (it restores as paused, with nothing audible
// yet) and a stored no alike. A first visit keeps the question through every state.
//
// With the player in the band the player is the feedback: the Pause or Resume
// beside the heading goes, and the heading closes up on its own.
//
// The root carries data-wave-avoid: the waveform measures it and keeps its
// moving dots out from under this text. The controls carry
// data-wave-ripple-origin: an answer's ripple starts at their centre.
export function BandInvite() {
  const music = useSoundtrack();
  const c = siteContent.listen;
  const playerOwns = bandPlayerMounted(usePlayerView());
  // Nothing of the band's own shows then, so the controls close up instead of holding their height: the player sits right under the heading on a phone, and the wave's keep-out shrinks to the heading on a desktop. The controls keep their width, where an answer's ripple starts.
  const closedUp = playerOwns && (music === "on" || music === "paused");
  // Read in render: the module sets it just before the state it restores, so the render that state change brings sees it.
  const returning = getRestoredSoundtrack() !== null;
  const moveFocus = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initSoundtrackFromStorage();
  }, []);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    rootRef.current?.querySelector<HTMLElement>(`[data-control="${music}"]`)?.focus({ preventScroll: true });
  }, [music]);

  // Each runs inside the click, which is what lets audio start under the
  // browser's autoplay policy. Answering lands focus on the control the new
  // state shows, so the question is not read again.
  const act = (write: () => void) => () => {
    moveFocus.current = true;
    write();
  };

  return (
    <div ref={rootRef} data-band-prompt="" data-wave-avoid data-wave-words className="pointer-events-auto w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-9 gap-y-2">
        {!returning && <h2 className="font-display text-[clamp(1.0625rem,1.45vw,1.25rem)] leading-[1.1] text-foreground">{c.line}</h2>}
        <div data-band-controls data-wave-ripple-origin className={`grid items-baseline ${closedUp ? "h-0 overflow-hidden" : ""}`}>
          <Layer shown={music === "before"} className="flex items-baseline gap-4">
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="before" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
              {c.accept}
            </Fill>
            <Fill {...FILL_PICK.band} shape="rect" type="button" onClick={act(stopSoundtrack)} data-cursor-hover {...QUIET}>
              {c.decline}
            </Fill>
          </Layer>
          <Layer shown={music === "on" && !playerOwns}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="on" onClick={act(pauseSoundtrack)} data-cursor-hover {...SMALL}>
              {c.pause}
            </Fill>
          </Layer>
          <Layer shown={music === "paused" && !playerOwns}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="paused" onClick={act(startSoundtrack)} data-cursor-hover {...(returning ? PRIMARY : SMALL)}>
              {returning ? c.accept : c.resume}
            </Fill>
          </Layer>
          <Layer shown={music === "off"}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="off" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
              {c.accept}
            </Fill>
          </Layer>
        </div>
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
