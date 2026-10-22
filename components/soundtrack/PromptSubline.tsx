"use client";

import { siteContent } from "@/lib/content";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The prompt's line under the question: "It moves with you, or freeze it." The
// last two words are the freeze toggle, a text button in the accent with its
// own underline; frozen, the line is the one button, "Let the wave move". The
// same one flag the player and the decline note write (lib/waveform/freeze).
// Nothing moves under reduced motion, so there the toggle is not offered and
// the line is plain.
export function PromptSubline() {
  const c = siteContent.listen;
  const frozen = useFrozen();
  const reduce = useReducedMotionLive();
  if (reduce) return <p>{c.subline.moves.replace(/, or $/, ".")}</p>;
  return (
    <p>
      {frozen ? null : c.subline.moves}
      <button
        type="button"
        data-wave-avoid
        aria-pressed={frozen}
        onClick={() => setFrozen(!frozen)}
        data-cursor-hover
        className="rounded-sm font-label text-label-sm text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {frozen ? c.unfreeze : c.subline.freeze}
      </button>
      {frozen ? null : c.subline.end}
    </p>
  );
}
