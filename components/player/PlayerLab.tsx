"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { ScrollTrigger } from "@/lib/gsap";
import { siteContent } from "@/lib/content";
import { playerStrings } from "@/lib/content/playerLab";
import { resetBridge, setBridge } from "@/lib/player/bridge";
import { bandPlayerMounted, type MachineConfig } from "@/lib/player/machine";
import { drawsPlayer } from "@/lib/player/settings";
import { usePlayerSettings } from "@/lib/player/useSettings";
import { useSoundtrack } from "@/lib/soundtrack";
import { isRoomy, subscribeRoomy } from "@/lib/player/viewport";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { BandSlot } from "./BandSlot";
import { DockedPlayer } from "./DockedPlayer";
import { MorphClone } from "./MorphClone";
import { PhoneBar } from "./PhoneBar";
import { Surface } from "./Surface";
import { useMorph } from "./useMorph";
import { usePillIntercept } from "./usePillIntercept";
import { usePlayerView } from "./usePlayerView";

// The music player lab's runtime, mounted once from the band (PlayerLabMount)
// in development only. Everything is off by default: with the master switch
// off it draws nothing and the band and pill read today's values from the
// bridge. On, it opens the player when the music starts and carries it from
// the band to the isle as the reader scrolls (the machine in lib/player).
export default function PlayerLab() {
  const [settings] = usePlayerSettings();
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const roomy = useSyncExternalStore(subscribeRoomy, isRoomy, () => true);
  const reduce = useReducedMotionLive();
  const music = useSoundtrack();
  const active = drawsPlayer(settings);
  const config = useMemo<MachineConfig>(
    () => ({ onPlay: settings.onPlay, intoIsle: settings.intoIsle, backUp: settings.backUp, phone, phoneMode: settings.phone, roomy, reduce }),
    [settings.onPlay, settings.intoIsle, settings.backUp, settings.phone, phone, roomy, reduce],
  );
  const { view, home, ahead, arrived, close, open } = usePlayerView(config, active, settings.isleLine);
  const card = useRef<HTMLDivElement | null>(null);
  const clone = useRef<HTMLDivElement | null>(null);

  useMorph({ view, phone, card, clone, onArrived: arrived });
  usePillIntercept(active && !phone && view === "pill" && music === "on", open);
  useEffect(() => {
    setBridge({ credit: settings.enabled ? settings.credit : "band" });
    return () => setBridge({ credit: "band" });
  }, [settings.enabled, settings.credit]);
  useEffect(() => resetBridge, []);
  // The card covers the band's lower right, where the credit line sits, so the line rides under the card instead.
  const creditBelow = active && !phone && view === "band" && settings.credit === "band";
  useEffect(() => {
    setBridge({ creditBelow });
    return () => setBridge({ creditBelow: false });
  }, [creditBelow]);

  // On a phone the band's player sits in the flow, so its arrival and removal move every trigger below the band's top; the triggers read their positions again.
  const mounted = bandPlayerMounted(view, home);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  if (!active || settings.onPlay === "today") return null;
  const variant = settings.onPlay;
  const credit = settings.credit === "player";
  return (
    <>
      {mounted && (
        <BandSlot ref={card} shown={view === "band"} reduce={reduce} caption={creditBelow ? siteContent.soundtrack.creditLine : null}>
          <Surface variant={variant} layout={phone ? "stack" : "wide"} credit={credit} active={view === "band"} reduce={reduce} closeLabel={playerStrings.close} onClose={close} />
        </BandSlot>
      )}
      {view === "docked" && <DockedPlayer variant={variant} credit={credit} reduce={reduce} lifted={ahead} onClose={close} />}
      {phone && view === "pill" && <PhoneBar reduce={reduce} />}
      <MorphClone ref={clone} />
    </>
  );
}
