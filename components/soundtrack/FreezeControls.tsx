"use client";

import { siteContent } from "@/lib/content";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The wave's freeze inside the player (the band's card, the isle and the phone's
// island); the Menu's chip (components/menu) is the one freeze control outside
// it, and the playback pill has none. One flag for the whole wave
// (lib/waveform/freeze). Nothing moves under reduced motion, so no control is
// offered there.

// A text toggle in the player's quiet label style (the Tracks row's), the
// words "Freeze the wave" and, frozen, "Let the wave move".
export function FreezeToggle() {
  const frozen = useFrozen();
  const reduce = useReducedMotionLive();
  const c = siteContent.listen;
  if (reduce) return null;
  return (
    <button
      type="button"
      data-cursor-hover
      data-wave-freeze=""
      aria-pressed={frozen}
      onClick={() => setFrozen(!frozen)}
      className="rounded-md px-1 py-1.5 font-label text-label-sm text-accent transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      {frozen ? c.unfreeze : c.freeze}
    </button>
  );
}
