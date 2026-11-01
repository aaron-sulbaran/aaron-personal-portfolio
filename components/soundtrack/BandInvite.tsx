"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { bandLayersShown, declineChosen } from "@/lib/home/bandLayers";
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

// The band's copy and controls, the one place the music is offered, one quiet
// line: the question, and beside it the choices for the state. Every visit asks
// the same question with both choices: before an answer, Play it and Not now;
// after a stored yes (it restores as paused, with nothing audible yet), Resume and
// Not now; after a stored Not now, Play it and Not now. While the music plays, one
// Pause. Nothing else is said here: no sub-line, no note (the wave's freeze lives
// in the Menu's chip and the open player). Every play layer is stacked in one grid
// cell, with Not now beside it, so the band never changes height (no layout shift
// when a stored choice restores after mount). Hidden layers are inert: not
// focusable, not clickable, not read. Answering moves focus to the control the
// state brings (Pause and Resume hand it to each other), so keyboard users never
// land on the body.
//
// A returning visitor has answered, and the band still asks: it is their first
// touch with the music, and for most visitors the only one. The stored choice
// restores (initSoundtrackFromStorage) and only the labels change. The server
// cannot read the answer, so a head script (lib/home/bandInit.ts) puts it on <html>
// before paint and globals.css draws the band as it will rest, with the question
// and Not now showing and the play choice already the one the answer lands on:
// nothing flashes and nothing moves when this component restores the same answer
// after hydration. The question's words are copy.line on a first visit and
// copy.lineReturning after one; today they are the same words, so only one is drawn.
//
// A Not now is answered: the wave rolls a gentle swell out of the band (lib/wavepath/answer), and
// Not now stays beside Play it as the chosen option, this visit or a stored one: no longer a button
// (disabled, aria-pressed), drawn with its underline filled and settled, with no hover
// (app/globals.css, "Not now, once chosen"). Play it stays the invitation, and choosing it later
// moves the answer with the state, as ever.
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
  const shown = bandLayersShown(music, playerOwns);
  const declined = declineChosen(music);
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
    <div ref={rootRef} data-band-prompt="" data-band-state={music} data-wave-avoid data-wave-words className="pointer-events-auto w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-9 gap-y-2">
        <h2 data-band-question="" className="font-display text-[clamp(1.0625rem,1.45vw,1.25rem)] leading-[1.1] text-foreground">
          <span data-band-title="first">{c.line}</span>
          {c.lineReturning !== c.line && <span data-band-title="returning">{c.lineReturning}</span>}
        </h2>
        <div data-band-controls data-wave-ripple-origin className={`flex items-baseline gap-4 ${closedUp ? "h-0 overflow-hidden" : ""}`}>
          <div className="grid items-baseline">
            <Layer name="before" shown={shown.before}>
              <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="before" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
                {c.accept}
              </Fill>
            </Layer>
            <Layer name="on" shown={shown.on}>
              <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="on" onClick={act(pauseSoundtrack)} data-cursor-hover {...SMALL}>
                {c.pause}
              </Fill>
            </Layer>
            <Layer name="paused" shown={shown.paused}>
              <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="paused" onClick={act(startSoundtrack)} data-cursor-hover {...SMALL}>
                {c.resume}
              </Fill>
            </Layer>
            <Layer name="off" shown={shown.off}>
              <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="off" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
                {c.accept}
              </Fill>
            </Layer>
          </div>
          {/* Not now keeps its place beside whichever play layer shows, so it is never drawn twice. */}
          <Layer name="decline" shown={shown.decline}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" onClick={act(stopSoundtrack)} disabled={declined} aria-pressed={declined} data-cursor-hover {...QUIET}>
              {c.decline}
            </Fill>
          </Layer>
        </div>
      </div>
    </div>
  );
}

function Layer({ name, shown, className = "", children }: { name: string; shown: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      data-band-layer={name}
      inert={!shown}
      aria-hidden={shown ? undefined : true}
      className={`col-start-1 row-start-1 transition-opacity duration-300 ${shown ? "opacity-100 delay-150" : "opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}
