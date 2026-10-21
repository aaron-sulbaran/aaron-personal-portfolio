"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Cover, glass, iconButton } from "@/components/soundtrack/PillParts";
import { MarqueeTitle } from "@/components/soundtrack/MarqueeTitle";
import { siteContent } from "@/lib/content";
import { playerStrings } from "@/lib/content/playerLab";
import type { SurfaceProps } from "./FullPlayer";
import { FreezeButton, PlayButton, StepButton } from "./PlayerBits";
import { TrackList } from "./TrackList";
import { usePlayerControls } from "./usePlayerControls";

// The compact sheet, the lab's direction: the current track with play and
// next, and under it a Tracks control that opens the seven tracks (each a
// button that plays it, with the artist and a Spotify link) beside a small
// Freeze the wave button that stays reachable while the music plays. In the
// band it has no close button: the band is its home. At the dock, in the
// island and anywhere else `onClose` is given, it closes. `bare` leaves out
// the glass for a surface that is already one (the island's black).
export function SheetPlayer({ credit, active, reduce, closeLabel, onClose, bare = false }: SurfaceProps) {
  const controls = usePlayerControls(active);
  const [open, setOpen] = useState(false);
  const { track } = controls;
  return (
    <div
      role="group"
      aria-label={playerStrings.groupLabel}
      data-lab-player="sheet"
      data-marquee-scope
      style={bare ? undefined : { ...glass, borderRadius: 18 }}
      className={`w-full ${bare ? "" : "p-3 md:w-[340px]"}`}
    >
      <div className="flex items-center gap-3">
        <Cover size={44} cover={track.cover} title={track.title} />
        <span className="min-w-0 flex-1">
          <MarqueeTitle text={track.title} style={{ fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.15, color: "var(--color-foreground)" }} />
          <span className="mt-0.5 block truncate font-label text-label-sm text-muted">{track.artist}</span>
        </span>
        <PlayButton controls={controls} size={36} />
        <StepButton controls={controls} direction={1} />
        {onClose && (
          <button type="button" data-cursor-hover onClick={onClose} aria-label={closeLabel} style={iconButton(24)}>
            <X aria-hidden="true" size={12} />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          data-cursor-hover
          aria-expanded={open}
          aria-label={open ? playerStrings.hideTracks : playerStrings.showTracks}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between rounded-md px-1 py-1 font-label text-label-sm text-accent transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <span>{playerStrings.tracks}</span>
          <ChevronDown aria-hidden="true" size={14} className={reduce ? "" : "transition-transform duration-200"} style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </button>
        <FreezeButton reduce={reduce} />
      </div>
      {open && (
        <div className="mt-1 flex flex-col gap-2 border-t border-border pt-2">
          <div className="max-h-[44vh] overflow-y-auto">
            <TrackList currentIndex={controls.snap.trackIndex} music={controls.music} onPlay={controls.playRow} />
          </div>
          {credit && <p data-lab-credit className="font-label text-label-sm leading-[1.4] text-muted">{siteContent.soundtrack.creditLine}</p>}
        </div>
      )}
      {!open && credit && <p data-lab-credit className="mt-1 px-1 font-label text-label-sm leading-[1.4] text-muted">{siteContent.soundtrack.creditLine}</p>}
    </div>
  );
}
