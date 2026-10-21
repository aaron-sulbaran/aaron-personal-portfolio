"use client";

import { useEffect, useRef } from "react";
import { getSoundtrackState, subscribeSoundtrack } from "@/lib/soundtrack";

type Handlers = { onStart: () => void; onStop: () => void };

// Watches the soundtrack store for the moments the lab cares about, so it
// needs no hook in any of the places that start the music (the band's Play it,
// the chrome's Music control, the pill). A start is a move into "on" from no
// choice or a decline, or from a restored pause the first time. Resuming the
// same visit's pause is not a new start, and a stop is the move to "off".
export function useSoundtrackEvents(active: boolean, handlers: Handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!active) return;
    let previous = getSoundtrackState();
    let started = false;
    return subscribeSoundtrack(() => {
      const next = getSoundtrackState();
      const was = previous;
      previous = next;
      if (next === "on" && (was === "before" || was === "off" || (was === "paused" && !started))) {
        started = true;
        latest.current.onStart();
      }
      if (next === "off") latest.current.onStop();
    });
  }, [active]);
}
