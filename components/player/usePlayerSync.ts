"use client";

import { useEffect, useRef } from "react";
import type { MachineConfig } from "@/lib/player/machine";
import { getPlayerView, sendPlayer } from "@/lib/player/viewStore";
import type { Zone } from "@/lib/player/zone";
import { getPlayFailed, getSoundtrackState, subscribeSoundtrack } from "@/lib/soundtrack";

// Feeds the player's machine (lib/player/machine, kept in lib/player/viewStore)
// from the two places its events come from. The music: a move into "on" with
// nothing open is a start, wherever it came from (the band's Play it, the stock
// pill's capsule, a resume), so no button needs a hook of its own; "off" and a
// start the player reported failed close it, and the stock pill speaks for
// both. And the reader: the band's zone and the window's shape, sent again
// whenever either changes.
export function usePlayerSync(config: MachineConfig, zone: Zone) {
  const latest = useRef({ config, zone });
  useEffect(() => {
    latest.current = { config, zone };
  });

  useEffect(
    () =>
      subscribeSoundtrack(() => {
        const music = getSoundtrackState();
        const { config, zone } = latest.current;
        if (music === "off" || (music === "paused" && getPlayFailed())) sendPlayer({ type: "stopped" }, config);
        else if (music === "on" && getPlayerView() === "closed") sendPlayer({ type: "started", zone }, config);
      }),
    [],
  );

  useEffect(() => sendPlayer({ type: "zone", zone }, config), [zone, config]);
}
