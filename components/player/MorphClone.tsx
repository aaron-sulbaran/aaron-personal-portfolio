"use client";

import { forwardRef } from "react";
import { Portal } from "@/components/Portal";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { glass } from "@/components/soundtrack/PillParts";
import { noteState } from "@/lib/note";
import { usePlayerControls } from "./usePlayerControls";

// The glass that travels between the band's player and the isle during the
// morph. The player fades out under it and the pill (or bar) fades in over
// it; near the isle end it ghosts in the pill's note and title so it reads as
// the pill forming. On a phone with the island, a black layer fades in over
// the glass instead, so the sheet turns into the island as it flies up. GSAP
// owns every property of this element, its ghost and its tone (useMorph);
// React only mounts them, hidden, on the pill's z level.
export const MorphClone = forwardRef<HTMLDivElement>(function MorphClone(_, ref) {
  const { music, track } = usePlayerControls(false);
  return (
    <Portal>
      <div
        ref={ref}
        aria-hidden="true"
        data-lab-clone
        style={{ ...glass, position: "fixed", left: 0, top: 0, zIndex: 45, pointerEvents: "none", visibility: "hidden", opacity: 0, overflow: "hidden" }}
      >
        <span data-lab-tone className="absolute inset-0" style={{ background: "var(--island-bg)", opacity: 0 }} />
        <span data-lab-ghost className="absolute inset-y-0 left-[13px] flex items-center gap-2 whitespace-nowrap font-label text-label-sm text-foreground" style={{ opacity: 0 }}>
          <NoteIcon state={noteState(music)} className="block h-4 w-[14px]" />
          {track.title}
        </span>
      </div>
    </Portal>
  );
});
