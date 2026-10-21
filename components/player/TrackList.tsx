"use client";

import { ExternalLink } from "lucide-react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import { playerStrings } from "@/lib/content/playerLab";
import { noteState } from "@/lib/note";
import { trackRows } from "@/lib/player/tracks";
import type { SoundtrackState } from "@/lib/soundtrack";

type Props = {
  currentIndex: number;
  music: SoundtrackState;
  onPlay: (index: number) => void;
  dense?: boolean; // the band's wide card: 26px rows from 1360px up; otherwise 28px
};

// All seven tracks, the current one marked with the soundtrack's note. A row
// plays its track (the current row pauses and resumes); the small link at its
// end opens that track on Spotify in a new tab.
export function TrackList({ currentIndex, music, onPlay, dense = false }: Props) {
  const rows = trackRows(siteContent.soundtrack.tracks, currentIndex);
  const playing = music === "on";
  return (
    <ol aria-label={playerStrings.tracks} className="m-0 flex min-h-0 list-none flex-col overflow-y-auto p-0" data-lab-tracks>
      {rows.map((row) => (
        <li
          key={row.index}
          className={`flex min-h-[28px] items-center gap-1 rounded-lg ${dense ? "min-[1360px]:min-h-[26px]" : ""} ${row.current ? "bg-[color-mix(in_srgb,var(--color-accent)_11%,transparent)]" : ""}`}
        >
          <button
            type="button"
            data-cursor-hover
            data-track-row={row.index}
            aria-current={row.current ? "true" : undefined}
            aria-label={`${row.current && playing ? playerStrings.pauseTrack : playerStrings.playTrack} ${row.title}`}
            onClick={() => onPlay(row.index)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <span className="flex w-4 flex-none justify-center font-label text-label-sm tabular-nums text-muted">
              {row.current ? <NoteIcon state={noteState(music)} className="block h-3.5 w-3" /> : row.number}
            </span>
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span title={row.title} className={`max-w-full truncate font-label text-label-sm ${row.current ? "text-foreground" : "text-foreground/90"}`}>{row.title}</span>
              <span className="min-w-0 max-w-full truncate font-label text-label-sm text-muted">{row.artist}</span>
            </span>
          </button>
          {row.spotifyUrl && (
            <a
              href={row.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-hover
              aria-label={`${playerStrings.spotifyFor} ${row.title}`}
              className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${dense ? "min-[1360px]:h-6 min-[1360px]:w-6" : ""} text-muted transition-colors duration-200 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent`}
            >
              <ExternalLink aria-hidden="true" size={12} />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
