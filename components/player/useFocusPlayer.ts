"use client";

import { useEffect, useRef } from "react";
import type { SoundtrackState } from "@/lib/soundtrack";
import { bandPlayerMounted, type PlayerView } from "@/lib/player/machine";

// With the band's status gone, the button the visitor pressed (Play it, or
// Resume) is hidden once the music starts, and focus would fall to the page.
// Hand it to the band's player instead, only if focus was lost or was still on
// the band's own controls; focus the visitor moved elsewhere stays.
export function useFocusPlayer(view: PlayerView, music: SoundtrackState) {
  const was = useRef(false);
  const has = bandPlayerMounted(view);
  useEffect(() => {
    const arrived = has && !was.current;
    was.current = has;
    if (!arrived || music !== "on") return;
    const frame = requestAnimationFrame(() => {
      const focused = document.activeElement;
      const lost = !focused || focused === document.body || Boolean(focused.closest("[data-band-controls], [data-band-note]"));
      if (lost) document.querySelector<HTMLElement>("[data-player-band-slot] [data-player-play]")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [has, music]);
}
