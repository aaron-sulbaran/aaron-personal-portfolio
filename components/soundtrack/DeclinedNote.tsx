"use client";

import type { MouseEventHandler } from "react";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { PRIMARY, QUIET } from "./bandButtons";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The line after Not now: the "No problem" sentence with Play it and Freeze the
// wave beside it, in the same two looks as the first visit's Play it and Not
// now (bandButtons). The freeze toggle is not offered under reduced motion,
// since nothing moves then.
export function DeclinedNote({ onPlay }: { onPlay: MouseEventHandler<HTMLButtonElement> }) {
  const c = siteContent.listen;
  const frozen = useFrozen();
  const reduce = useReducedMotionLive();
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <p>{c.declinedNote}</p>
      <div className="flex items-baseline gap-4">
        <Fill {...FILL_PICK.band} shape="rect" type="button" onClick={onPlay} data-cursor-hover {...PRIMARY}>
          {c.accept}
        </Fill>
        {!reduce && (
          <Fill {...FILL_PICK.band} shape="rect" type="button" aria-pressed={frozen} onClick={() => setFrozen(!frozen)} data-cursor-hover {...QUIET}>
            {frozen ? c.unfreeze : c.freeze}
          </Fill>
        )}
      </div>
    </div>
  );
}
