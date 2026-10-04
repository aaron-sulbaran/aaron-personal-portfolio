"use client";

import { useEffect, useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import {
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  stopSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";
import { getDocked, setDockSource, subscribeDocked } from "@/lib/waveform/dock";

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
// The pressed control is the pill's arrival source: the pill condenses out of
// it at the dock, and while the pill is out the controls fade (150ms), so the
// pill reads as the control that left. Faded controls stay focusable and
// reappear under keyboard focus.
//
// The root carries data-wave-avoid: the waveform measures it and keeps its
// moving dots out from under this text.
export function BandInvite() {
  const music = useSoundtrack();
  const c = siteContent.listen;
  const moveFocus = useRef<"note" | "control" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const docked = useSyncExternalStore(subscribeDocked, getDocked, () => false);

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
  // browser's autoplay policy. The press is recorded in page coordinates.
  // Answering the question lands focus on the note, so the question is not
  // read again; Pause and Resume hand focus to each other.
  const act = (write: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    setDockSource(new DOMRect(r.x + window.scrollX, r.y + window.scrollY, r.width, r.height));
    moveFocus.current = event.currentTarget.dataset.focusTo === "note" ? "note" : "control";
    write();
  };

  return (
    <div ref={rootRef} data-wave-avoid className="pointer-events-auto w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
        <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
        <div
          data-band-controls
          className={`grid transition-opacity duration-150 has-[:focus-visible]:opacity-100 ${docked ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          <Layer shown={music === "before"} className="flex items-baseline gap-6">
            <button type="button" data-control="before" data-focus-to="note" onClick={act(startSoundtrack)} data-cursor-hover className={PRIMARY}>
              {c.accept}
            </button>
            <button type="button" data-focus-to="note" onClick={act(stopSoundtrack)} data-cursor-hover className={QUIET}>
              {c.decline}
            </button>
          </Layer>
          <Layer shown={music === "on"}>
            <button type="button" data-control="on" onClick={act(pauseSoundtrack)} data-cursor-hover className={SMALL}>
              {c.pause}
            </button>
          </Layer>
          <Layer shown={music === "paused"}>
            <button type="button" data-control="paused" onClick={act(startSoundtrack)} data-cursor-hover className={SMALL}>
              {c.resume}
            </button>
          </Layer>
        </div>
      </div>
      <div data-band-note tabIndex={-1} className="mt-2 grid max-w-[42rem] text-sm leading-[1.5] text-muted outline-none" aria-live="polite">
        <Layer shown={music === "before"}>
          <p>{c.body}</p>
        </Layer>
        <Layer shown={music === "on"}>
          <p>{c.acceptedNote}</p>
        </Layer>
        <Layer shown={music === "paused"}>
          <p>{c.pausedNote}</p>
        </Layer>
        <Layer shown={music === "off"}>
          <p>
            {c.declinedNote}{" "}
            <button type="button" onClick={act(startSoundtrack)} data-cursor-hover className={`md:hidden ${SMALL}`}>
              {c.accept}
            </button>
          </p>
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

const FOCUS = "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PRIMARY = `font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent underline decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-accent-hover ${FOCUS}`;

const QUIET = `text-sm text-muted transition-colors duration-200 hover:text-foreground ${FOCUS}`;

const SMALL = `text-sm text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover ${FOCUS}`;
