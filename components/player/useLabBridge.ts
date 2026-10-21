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
//   waveWait     the wave waits for the band to scroll away
//   bandFull     the band's run is drawn whole whenever the band shows
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

  const sheetInBand = active && settings.onPlay === "sheet" && settings.statusLine === "hidden" && bandPlayerMounted(view);
  useEffect(() => {
    setBridge({ status: sheetInBand ? "hidden" : "today" });
    return () => setBridge({ status: "today" });
  }, [sheetInBand]);

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

  useEffect(() => {
    setBridge({ bandFull: on });
    return () => setBridge({ bandFull: false });
  }, [on]);
}
