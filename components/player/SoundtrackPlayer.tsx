"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { islandBox } from "@/lib/player/island";
import { isleBox, type Box } from "@/lib/player/zone";
import { isleShown, type MachineConfig } from "@/lib/player/machine";
import { attachQueue } from "@/lib/player/queueStore";
import { isRoomy, subscribeRoomy } from "@/lib/player/viewport";
import { sendPlayer, usePlayerView } from "@/lib/player/viewStore";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { IslePill } from "./IslePill";
import { MorphClone } from "./MorphClone";
import { PhoneIsland } from "./PhoneIsland";
import { readMenuLeft } from "./useHeaderRow";
import { useBandZone } from "./useBandZone";
import { useIsleLift } from "./useIsleLift";
import { useMorph } from "./useMorph";
import { usePlayerSync } from "./usePlayerSync";

// The soundtrack player's host, mounted once in the layout so the music has a
// control on every page. The band's player (BandPlayer) lives in the band and
// reads the same view; this draws the isle: the pill on a desktop, the island
// on a phone, and the glass that travels between the band's card and the isle.
// It tells the machine (lib/player/machine) what the music and the reader are
// doing (usePlayerSync, useBandZone), carries the hand-off (useMorph), keeps the
// pill off the footer (useIsleLift), and hands a finished track on through the
// queue (lib/player/queueStore). With no music started it draws nothing.
export function SoundtrackPlayer() {
  const pathname = usePathname();
  // Only the home page has a hero, and the Coil and Band toggle in its corner.
  const home = pathname === "/";
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const roomy = useSyncExternalStore(subscribeRoomy, isRoomy, () => true);
  const reduce = useReducedMotionLive();
  const config = useMemo<MachineConfig>(() => ({ phone, roomy, reduce }), [phone, roomy, reduce]);
  const view = usePlayerView();
  const zone = useBandZone(pathname);
  const clone = useRef<HTMLDivElement | null>(null);

  usePlayerSync(config, zone);
  useIsleLift(pathname);
  useEffect(() => attachQueue(), []);

  // Where the morph ends: the pill on its dock, or the island in the header row, measured when the flight reads it.
  const target = useCallback((): Box => (phone ? islandBox(window.innerWidth, readMenuLeft()) : isleBox(window.innerHeight)), [phone]);
  const latest = useRef(config);
  useEffect(() => {
    latest.current = config;
  });
  const arrived = useCallback(() => sendPlayer({ type: "arrived" }, latest.current), []);
  useMorph({ view, target, toIsland: phone, clone, onArrived: arrived });

  return (
    <>
      {isleShown(view) && !phone && <IslePill key={view} reduce={reduce} pinned={view === "docked"} lifted={home && zone === "ahead"} />}
      {isleShown(view) && phone && <PhoneIsland reduce={reduce} />}
      {view !== "closed" && <MorphClone ref={clone} />}
    </>
  );
}
