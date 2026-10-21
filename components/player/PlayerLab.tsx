"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { ScrollTrigger } from "@/lib/gsap";
import { siteContent } from "@/lib/content";
import { playerStrings } from "@/lib/content/playerLab";
import { islandTop, islandBox } from "@/lib/player/island";
import { bandPlayerMounted, type MachineConfig } from "@/lib/player/machine";
import { drawsPlayer } from "@/lib/player/settings";
import { usePlayerSettings } from "@/lib/player/useSettings";
import { isRoomy, subscribeRoomy } from "@/lib/player/viewport";
import { barBox, isleBox, type Box } from "@/lib/player/zone";
import { useSoundtrack } from "@/lib/soundtrack";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { BandSlot } from "./BandSlot";
import { DockedPlayer } from "./DockedPlayer";
import { MorphClone } from "./MorphClone";
import { PhoneBar } from "./PhoneBar";
import { PhoneIsland } from "./PhoneIsland";
import { Surface } from "./Surface";
import { useFocusSheet } from "./useFocusSheet";
import { useFooterLift } from "./useFooterLift";
import { useIslandSpec } from "./useIslandSpec";
import { useLabBridge } from "./useLabBridge";
import { useMorph } from "./useMorph";
import { usePillIntercept } from "./usePillIntercept";
import { usePlayerView } from "./usePlayerView";
import "./lab.css";

// The music player lab's runtime, mounted once from the band (PlayerLabMount)
// in development only. With the master switch off it draws nothing and the
// band, pill and wave read today's values from the bridge. On, it opens the
// player when the music starts and carries it from the band to the isle as the
// reader scrolls (the machine in lib/player), and tells the real band, pill and
// wave what to change (useLabBridge).
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
  const { view, ahead, arrived, close, open } = usePlayerView(config, active, settings.isleLine);
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
  usePillIntercept(active && !phone && view === "pill" && music === "on", open);
  useLabBridge({ settings, active, phone, view });
  useFooterLift(settings.enabled, settings.footer);
  useFocusSheet(view, music, active && settings.onPlay === "sheet" && settings.statusLine === "hidden");

  // On a phone the band's player sits in the flow, so its arrival and removal move every trigger below the band's top; the triggers read their positions again.
  const mounted = bandPlayerMounted(view);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  if (!active) return null;
  const variant = settings.onPlay === "today" ? "sheet" : settings.onPlay;
  const credit = settings.credit === "player";
  const creditCaption = !phone && view === "band" && settings.credit === "band" ? siteContent.soundtrack.creditLine : null;
  return (
    <>
      {mounted && (
        <BandSlot ref={card} shown={view === "band"} reduce={reduce} caption={creditCaption}>
          <Surface
            variant={variant}
            layout={phone ? "stack" : "wide"}
            credit={credit}
            active={view === "band"}
            reduce={reduce}
            closeLabel={playerStrings.close}
            onClose={variant === "card" ? close : undefined}
          />
        </BandSlot>
      )}
      {view === "docked" && <DockedPlayer variant={variant} credit={credit} reduce={reduce} lifted={ahead} onClose={close} />}
      {phone && view === "pill" && (island ? <PhoneIsland reduce={reduce} model={settings.phoneModel} credit={credit} /> : <PhoneBar reduce={reduce} />)}
      <MorphClone ref={clone} />
    </>
  );
}
