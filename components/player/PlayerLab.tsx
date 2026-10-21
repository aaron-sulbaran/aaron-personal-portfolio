"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { ScrollTrigger } from "@/lib/gsap";
import { siteContent } from "@/lib/content";
import { islandTop, islandBox } from "@/lib/player/island";
import { attachQueue } from "@/lib/player/queueStore";
import { bandPlayerMounted, labPillShown, type MachineConfig } from "@/lib/player/machine";
import { drawsPlayer } from "@/lib/player/settings";
import { usePlayerSettings } from "@/lib/player/useSettings";
import { isRoomy, subscribeRoomy } from "@/lib/player/viewport";
import { barBox, isleBox, type Box } from "@/lib/player/zone";
import { useSoundtrack } from "@/lib/soundtrack";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { BandSlot } from "./BandSlot";
import { Glass } from "./Glass";
import { IslePill } from "./IslePill";
import { MorphClone } from "./MorphClone";
import { NowPlaying } from "./NowPlaying";
import { PhoneBar } from "./PhoneBar";
import { PhoneIsland } from "./PhoneIsland";
import { useFocusSheet } from "./useFocusSheet";
import { useFooterLift } from "./useFooterLift";
import { useIslandSpec } from "./useIslandSpec";
import { useLabBridge } from "./useLabBridge";
import { useMorph } from "./useMorph";
import { usePlayerView } from "./usePlayerView";
import "./lab.css";

// The music player lab's runtime, mounted once from the band (PlayerLabMount)
// in development only. With the master switch off it draws nothing and the
// band, pill and wave read today's values from the bridge. On, it opens the
// one player in the band when the music starts and carries it to the isle (the
// one pill on a desktop, the island on a phone) as the reader scrolls (the
// machine in lib/player), and tells the real band, pill and wave what to change
// (useLabBridge).
export default function PlayerLab() {
  const [settings] = usePlayerSettings();
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const roomy = useSyncExternalStore(subscribeRoomy, isRoomy, () => true);
  const reduce = useReducedMotionLive();
  const music = useSoundtrack();
  const active = drawsPlayer(settings);
  const island = phone && settings.phone === "island";
  const config = useMemo<MachineConfig>(
    () => ({ onPlay: settings.onPlay, intoIsle: settings.intoIsle, backUp: settings.backUp, phone, phoneMode: settings.phone, roomy, reduce }),
    [settings.onPlay, settings.intoIsle, settings.backUp, settings.phone, phone, roomy, reduce],
  );
  const { view, ahead, arrived } = usePlayerView(config, active, settings.isleLine);
  const card = useRef<HTMLDivElement | null>(null);
  const clone = useRef<HTMLDivElement | null>(null);
  const metrics = useIslandSpec(settings.phoneModel);

  // Where the morph ends: the pill, the phone's bar or the island, measured when the flight reads it.
  const target = useCallback((): Box => {
    if (!phone) return isleBox(window.innerHeight);
    if (island) return islandBox(window.innerWidth, metrics.spec, islandTop(metrics.spec, metrics.insetTop));
    return barBox(window.innerWidth, window.innerHeight);
  }, [phone, island, metrics]);
  useMorph({ view, target, toIsland: island, card, clone, onArrived: arrived });
  useLabBridge({ settings, active, phone, view });
  // While a lab player is on screen the queue decides what follows a track that ends.
  useEffect(() => (active ? attachQueue() : undefined), [active]);
  useFooterLift(settings.enabled, settings.footer);
  useFocusSheet(view, music, active && settings.statusLine === "hidden");

  // On a phone the band's player sits in the flow, so its arrival and removal move every trigger below the band's top; the triggers read their positions again.
  const mounted = bandPlayerMounted(view);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  if (!active) return null;
  const credit = settings.credit === "player";
  const creditCaption = !phone && view === "band" && settings.credit === "band" ? siteContent.soundtrack.creditLine : null;
  return (
    <>
      {mounted && (
        <BandSlot ref={card} shown={view === "band"} reduce={reduce} caption={creditCaption}>
          <Glass className="w-full p-4 md:w-[360px]">
            <NowPlaying credit={credit} active={view === "band"} reduce={reduce} />
          </Glass>
        </BandSlot>
      )}
      {!phone && labPillShown(view, ahead) && <IslePill key={view} reduce={reduce} pinned={view === "docked"} lifted={ahead} />}
      {phone && view === "pill" && (island ? <PhoneIsland reduce={reduce} model={settings.phoneModel} credit={credit} /> : <PhoneBar reduce={reduce} />)}
      <MorphClone ref={clone} />
    </>
  );
}
