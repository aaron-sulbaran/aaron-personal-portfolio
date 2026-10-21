"use client";

import { forwardRef } from "react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { Cover } from "@/components/soundtrack/PillParts";
import { playerStrings } from "@/lib/content/playerLab";
import { noteState } from "@/lib/note";
import { usePlayerControls } from "./usePlayerControls";

const BARS = [0, 220, 90, 310] as const;

// The island's collapsed face, a live activity: the cover at the left and, at
// the right, four level bars while the music plays or the note while it is
// paused. The middle is left empty, where the hardware island's camera sits.
// The whole face is one button that opens the island.
export const IslandFace = forwardRef<HTMLButtonElement, { height: number; onOpen: () => void }>(function IslandFace({ height, onOpen }, ref) {
  const { music, playing, track } = usePlayerControls(false);
  return (
    <button
      ref={ref}
      type="button"
      data-cursor-hover
      data-lab-island-face
      aria-label={`${playerStrings.islandOpen}: ${track.title}`}
      onClick={onOpen}
      className="flex w-full items-center justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
      style={{ height, padding: "0 12px 0 5px", background: "none", border: 0, color: "inherit", cursor: "pointer" }}
    >
      <Cover size={Math.round(height - 10)} cover={track.cover} title={track.title} />
      {playing ? (
        <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
          {BARS.map((delay) => (
            <span key={delay} className="lab-island-bar block w-[3px] rounded-full bg-accent" style={{ height: 14, animationDelay: `${delay}ms` }} />
          ))}
        </span>
      ) : (
        <NoteIcon state={noteState(music)} className="block h-4 w-[14px]" />
      )}
    </button>
  );
});
