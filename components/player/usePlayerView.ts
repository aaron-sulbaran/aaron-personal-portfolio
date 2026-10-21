"use client";

import { useCallback, useEffect, useReducer } from "react";
import { setBridge } from "@/lib/player/bridge";
import { CLOSED, pillHold, step, type MachineConfig, type PlayerEvent, type PlayerState } from "@/lib/player/machine";
import { zoneOf, type Zone } from "@/lib/player/zone";
import { DOCK } from "@/lib/waveform/dock";
import { useBandLine } from "./useBandLine";
import { useSoundtrackEvents } from "./useSoundtrackEvents";

function bandRect() {
  return document.getElementById("listen")?.getBoundingClientRect() ?? null;
}

function zoneNow(line: number): Zone {
  const rect = bandRect();
  return rect ? zoneOf(rect, window.innerHeight, line) : "ahead";
}

// The lab player's view, driven by the pure machine (lib/player/machine): the
// music starting or stopping, the band crossing the hand-off line, and the
// visitor's own close and open. It also tells the real pill where it stands
// (the bridge): away whenever the lab's own pill is the isle.
export function usePlayerView(config: MachineConfig, active: boolean, line: number) {
  const [state, send] = useReducer((current: PlayerState, event: PlayerEvent) => step(current, event, config), CLOSED);
  const { past, ahead } = useBandLine(line, active);

  useEffect(() => {
    if (active) send({ type: "line", past });
    else send({ type: "reset" });
  }, [active, past, config]);

  useSoundtrackEvents(active, {
    onStart: () => send({ type: "started", zone: zoneNow(line) }),
    onStop: () => send({ type: "stopped" }),
  });

  useEffect(() => {
    setBridge({ pill: pillHold(state.view) });
    return () => setBridge({ pill: "auto" });
  }, [state.view]);

  const arrived = useCallback(() => send({ type: "arrived" }), []);
  const close = useCallback(() => send({ type: "close", pillReady: (bandRect()?.bottom ?? Infinity) <= DOCK.passedPx }), []);
  const open = useCallback(() => send({ type: "open", zone: zoneNow(line) }), [line]);

  return { view: state.view, ahead, arrived, close, open };
}
