"use client";

import { ExternalLink, X } from "lucide-react";
import { FreezeRow, glass, iconButton } from "@/components/soundtrack/PillParts";
import { siteContent } from "@/lib/content";
import { playerStrings } from "@/lib/content/playerLab";
import { SeekRow, TitleBlock, TransportRow } from "./PlayerBits";
import { TrackList } from "./TrackList";
import { usePlayerControls } from "./usePlayerControls";

export type SurfaceProps = {
  layout: "wide" | "stack"; // wide: the band's card, the transport beside the list from 1360px up; stack: one column
  credit: boolean; // the credit line rides in the player
  active: boolean; // on screen: the playhead is polled
  reduce: boolean;
  closeLabel: string;
  onClose: () => void;
};

// The player card: the cover, the title and artist, seek, previous, play and
// next, volume, and the seven tracks, each a button that plays it with a link
// to its Spotify page. In the band it opens wide (transport on the left, the
// list on the right) from 1360px up, where it fits beside the copy, and as one
// column below; at the dock it is always one column, bottom left, where the
// pill's own card opens.
export function FullPlayer({ layout, credit, active, reduce, closeLabel, onClose }: SurfaceProps) {
  const controls = usePlayerControls(active);
  const wide = layout === "wide";
  const { track } = controls;
  return (
    <div
      role="group"
      aria-label={playerStrings.groupLabel}
      data-lab-player="card"
      data-marquee-scope
      style={{ ...glass, borderRadius: 22 }}
      className={`flex w-full flex-col gap-3 p-4 ${wide ? "lg:w-[360px] min-[1360px]:w-[600px] min-[1360px]:flex-row min-[1360px]:gap-5" : ""}`}
    >
      <div className={`flex min-w-0 flex-col gap-3 ${wide ? "min-[1360px]:w-[212px] min-[1360px]:flex-none" : ""}`}>
        <div className="flex items-center gap-3.5">
          <TitleBlock controls={controls} coverSize={56} titleSize={19} />
          <span className={wide ? "min-[1360px]:hidden" : ""}>
            <button type="button" data-cursor-hover onClick={onClose} aria-label={closeLabel} style={iconButton(28)}>
              <X aria-hidden="true" size={14} />
            </button>
          </span>
        </div>
        <SeekRow controls={controls} />
        <TransportRow controls={controls} />
        {track.spotifyUrl && (
          <a
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor-hover
            className="inline-flex w-fit items-center gap-1.5 font-label text-label-sm text-accent transition-colors duration-200 hover:text-accent-hover min-[1360px]:mt-auto"
          >
            {siteContent.soundtrack.openInSpotify}
            <ExternalLink aria-hidden="true" size={12} className="relative -top-px" />
          </a>
        )}
        {credit && <p data-lab-credit className="font-label text-label-sm leading-[1.4] text-muted">{siteContent.soundtrack.creditLine}</p>}
      </div>
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 border-t border-border pt-3 ${wide ? "min-[1360px]:border-l min-[1360px]:border-t-0 min-[1360px]:pl-4 min-[1360px]:pt-0" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="font-label text-label-sm text-muted">{playerStrings.tracks}</span>
          <div className="flex items-center gap-3">
            <FreezeRow reduce={reduce} />
            {wide && (
              <span className="hidden min-[1360px]:block">
                <button type="button" data-cursor-hover onClick={onClose} aria-label={closeLabel} style={iconButton(24)}>
                  <X aria-hidden="true" size={12} />
                </button>
              </span>
            )}
          </div>
        </div>
        <div className={`overflow-y-auto ${wide ? "max-h-[132px] min-[1360px]:max-h-[196px]" : "min-h-[112px] max-h-[calc(100vh-440px)]"}`}>
          <TrackList currentIndex={controls.snap.trackIndex} music={controls.music} onPlay={controls.playRow} dense={wide} />
        </div>
      </div>
    </div>
  );
}
