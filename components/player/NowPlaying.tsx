"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FreezeToggle } from "@/components/soundtrack/FreezeControls";
import { playerStrings } from "@/lib/content/player";
import { TitleBlock } from "./PlayerBits";
import { SeekBar } from "./SeekBar";
import { TrackList } from "./TrackList";
import { Transport } from "./Transport";
import { usePlayerControls } from "./usePlayerControls";

type Props = {
  active: boolean; // on screen: the playhead is polled
  reduce: boolean;
};

// The one player, used in the band, the desktop pill's open state and the
// phone island: the cover, the title and artist (both scroll when long), the
// seek bar with the time played and the time left, previous, play and next
// with quiet shuffle and repeat, and the Tracks. It has no surface of its own
// (the host gives it glass or the island's black), no close button, no credit
// line: where it opens and closes is the host's business. Its last row holds the
// Tracks and, beside it, the wave's freeze (the Menu's chip is the only other
// control that freezes it).
export function NowPlaying({ active, reduce }: Props) {
  const controls = usePlayerControls(active);
  const [open, setOpen] = useState(false);
  return (
    <div role="group" aria-label={playerStrings.groupLabel} data-player-player="player" data-marquee-scope className="flex w-full flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <TitleBlock controls={controls} coverSize={52} titleSize={18} />
      </div>
      <SeekBar controls={controls} />
      <Transport controls={controls} />
      <div className="border-t border-border pt-1">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            data-cursor-hover
            aria-expanded={open}
            aria-label={open ? playerStrings.hideTracks : playerStrings.showTracks}
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-1.5 rounded-md px-1 py-1.5 font-label text-label-sm text-accent transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <span>{playerStrings.tracks}</span>
            <ChevronDown aria-hidden="true" size={14} className={reduce ? "" : "transition-transform duration-200"} style={{ transform: open ? "rotate(180deg)" : "none" }} />
          </button>
          <FreezeToggle />
        </div>
        {open && (
          <div className="mt-1 max-h-[44vh] overflow-y-auto">
            <TrackList currentIndex={controls.snap.trackIndex} music={controls.music} onPlay={controls.playRow} />
          </div>
        )}
      </div>
    </div>
  );
}
