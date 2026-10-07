"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import {
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  stopSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";

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
// moving dots out from under this text.
export function BandInvite() {
  const music = useSoundtrack();
  const c = siteContent.listen;
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
    <div ref={rootRef} data-wave-avoid className="pointer-events-auto w-fit max-w-full">
      <div className="flex flex-wrap items-baseline gap-x-9 gap-y-3">
        <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.1] text-foreground">{c.line}</h2>
        <div data-band-controls className="grid items-baseline">
          <Layer shown={music === "before"} className="flex items-baseline gap-4">
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="before" data-focus-to="note" onClick={act(startSoundtrack)} data-cursor-hover {...PRIMARY}>
              {c.accept}
            </Fill>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-focus-to="note" onClick={act(stopSoundtrack)} data-cursor-hover {...QUIET}>
              {c.decline}
            </Fill>
          </Layer>
          <Layer shown={music === "on"}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="on" onClick={act(pauseSoundtrack)} data-cursor-hover {...SMALL}>
              {c.pause}
            </Fill>
          </Layer>
          <Layer shown={music === "paused"}>
            <Fill {...FILL_PICK.band} shape="rect" type="button" data-control="paused" onClick={act(startSoundtrack)} data-cursor-hover {...SMALL}>
              {c.resume}
            </Fill>
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
            <Fill {...FILL_PICK.band} shape="rect" type="button" onClick={act(startSoundtrack)} data-cursor-hover {...SMALL} className={`md:hidden ${SMALL.className}`}>
              {c.accept}
            </Fill>
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

// "Play it": the 1.5px rise line stands in for its underline, inset by its own padding.
const PRIMARY = {
  line: 1.5,
  className: `-mx-2 inline-flex items-baseline px-2 pb-1 pt-0.5 font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-accent ${FOCUS}`,
  overClassName: "flex items-baseline px-2 pb-1 pt-0.5",
};

// "Not now" keeps its muted underline; no rise line.
const QUIET = {
  line: 0,
  className: `-mx-1.5 inline-flex items-baseline px-1.5 pb-[3px] pt-px font-label text-label text-muted underline decoration-1 underline-offset-[4px] decoration-[color:color-mix(in_srgb,var(--color-muted)_40%,transparent)] dark:decoration-[color:color-mix(in_srgb,var(--color-muted)_55%,transparent)] ${FOCUS}`,
  overClassName: "flex items-baseline px-1.5 pb-[3px] pt-px",
};

// Pause, Resume and the phone's Play it: a 1px rise line.
const SMALL = {
  line: 1,
  className: `-mx-1.5 inline-flex items-baseline px-1.5 pb-[2px] pt-px font-label text-label text-accent ${FOCUS}`,
  overClassName: "flex items-baseline px-1.5 pb-[2px] pt-px",
};
