"use client";

import { useEffect } from "react";
import { resetBridge, setBridge } from "@/lib/player/bridge";
import { bandPlayerMounted, type PlayerView } from "@/lib/player/machine";
import type { PlayerLabSettings } from "@/lib/player/settings";

type Args = {
  settings: PlayerLabSettings;
  active: boolean; // the lab draws a player
  phone: boolean;
  view: PlayerView;
};

// What the lab tells the real band, pill and wave (lib/player/bridge). Every
// field has the production value when the master switch is off, and the
// bridge goes back to production's values when the lab unmounts.
//   credit       the band's credit line follows the lab's choice
//   creditBelow  the card is open over the line's corner, so it rides under it
//   status       the sheet is in the band, so the band drops its status
//   notNow       two buttons beside the No problem line
//   waveWait     the wave is one line that follows the scroll only while the band
//                is above the release line, and waits there after an answer
//   idle         the idle ripple's strength (0 off)
//   labPill      the lab's pill is the isle, so the band keeps its freeze link
export function useLabBridge({ settings, active, phone, view }: Args) {
  const on = settings.enabled;
  useEffect(() => resetBridge, []);
  useEffect(() => {
    setBridge({ credit: on ? settings.credit : "band" });
    return () => setBridge({ credit: "band" });
  }, [on, settings.credit]);

  const creditBelow = active && !phone && view === "band" && settings.credit === "band";
  useEffect(() => {
    setBridge({ creditBelow });
    return () => setBridge({ creditBelow: false });
  }, [creditBelow]);

  const playerInBand = active && settings.statusLine === "hidden" && bandPlayerMounted(view);
  useEffect(() => {
    setBridge({ status: playerInBand ? "hidden" : "today" });
    return () => setBridge({ status: "today" });
  }, [playerInBand]);

  const notNow = on ? settings.notNow : "today";
  useEffect(() => {
    setBridge({ notNow });
    return () => setBridge({ notNow: "today" });
  }, [notNow]);

  const waveWait = on && settings.waveAfterAnswer === "waits" ? settings.waveLine : null;
  useEffect(() => {
    setBridge({ waveWait });
    return () => setBridge({ waveWait: null });
  }, [waveWait]);

  const idle = on && settings.idleRipple === "ripple" ? settings.idleStrength : 0;
  useEffect(() => {
    setBridge({ idle });
    return () => setBridge({ idle: 0 });
  }, [idle]);

  useEffect(() => {
    setBridge({ labPill: active });
    return () => setBridge({ labPill: false });
  }, [active]);
}
