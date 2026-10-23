"use client";

import { Snowflake } from "lucide-react";
import { siteContent } from "@/lib/content";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { glass } from "./PillParts";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The wave's freeze, where the reader is wherever the page is (slice 4d): the
// playback pill, and the player in the isle and the phone's island. One flag
// for the whole wave (lib/waveform/freeze). Nothing moves under reduced motion,
// so neither control is offered there.

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

// The stock pill's companion: a round glass button beside the capsule, the
// capsule's own height, a snowflake that takes the accent while the wave is
// frozen.
export function FreezeButton({ size }: { size: number }) {
  const frozen = useFrozen();
  const reduce = useReducedMotionLive();
  const c = siteContent.listen;
  if (reduce) return null;
  const label = frozen ? c.unfreeze : c.freeze;
  return (
    <button
      type="button"
      data-cursor-hover
      data-wave-freeze=""
      aria-pressed={frozen}
      aria-label={label}
      title={label}
      onClick={() => setFrozen(!frozen)}
      className="flex flex-none items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ ...glass, width: size, height: size, padding: 0, cursor: "pointer", color: frozen ? "var(--color-accent)" : "var(--color-muted)" }}
    >
      <Snowflake aria-hidden="true" size={16} />
    </button>
  );
}
