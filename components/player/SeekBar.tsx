"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { siteContent } from "@/lib/content";
import { playerStrings } from "@/lib/content/player";
import { formatClock, formatRemaining, progressPercent, SEEK_PAGE_S, SEEK_STEP_S, seekBy } from "@/lib/player/time";
import type { PlayerControls } from "./usePlayerControls";

const KEY_STEPS: Record<string, number> = { ArrowRight: SEEK_STEP_S, ArrowUp: SEEK_STEP_S, ArrowLeft: -SEEK_STEP_S, ArrowDown: -SEEK_STEP_S, PageUp: SEEK_PAGE_S, PageDown: -SEEK_PAGE_S };
const time = "inline-block min-w-[4ch] font-label text-label-sm tabular-nums text-muted";

// The seekable progress bar: the time played on the left, what is left on the
// right as -m:ss. A native range input, so a drag (mouse, finger or pen) and
// the keyboard work as they do everywhere; the arrow keys move 5 seconds, the
// Page keys 15, and Home and End jump to the ends. While it is being moved it
// shows where it is being moved to, not the playhead.
export function SeekBar({ controls }: { controls: PlayerControls }) {
  const { snap, position } = controls;
  const duration = snap.duration;
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position;
  const move = (seconds: number) => {
    setScrub(seconds);
    controls.seek(seconds);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Home") move(0);
    else if (event.key === "End") move(duration);
    else if (event.key in KEY_STEPS) move(seekBy(duration, shown, KEY_STEPS[event.key]));
    else return;
    event.preventDefault();
  };
  return (
    <div className="flex items-center gap-2.5" data-player-seek>
      <span className={`${time} text-right`} data-player-elapsed aria-hidden="true">
        {formatClock(shown)}
      </span>
      <input
        type="range"
        className="player-seek"
        min={0}
        max={Math.max(1, Math.round(duration))}
        step={1}
        value={Math.min(Math.round(shown), Math.max(1, Math.round(duration)))}
        aria-label={siteContent.soundtrack.ariaSeek}
        aria-valuetext={`${formatClock(shown)} ${playerStrings.seekValueOf} ${formatClock(duration)}`}
        style={{ "--player-seek": `${progressPercent(duration, shown)}%` } as CSSProperties}
        onChange={(event) => move(Number(event.target.value))}
        onKeyDown={onKeyDown}
        onPointerUp={() => setScrub(null)}
        onKeyUp={() => setScrub(null)}
        onBlur={() => setScrub(null)}
      />
      <span className={`${time} text-left`} data-player-remaining aria-hidden="true">
        {formatRemaining(duration, shown)}
      </span>
    </div>
  );
}
