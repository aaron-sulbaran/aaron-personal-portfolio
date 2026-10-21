"use client";

import { useEffect } from "react";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { ScrollTrigger } from "@/lib/gsap";
import { bandPlayerMounted, bandPlayerShown } from "@/lib/player/machine";
import { usePlayerView } from "@/lib/player/viewStore";
import { useSoundtrack } from "@/lib/soundtrack";
import { Glass } from "./Glass";
import { NowPlaying } from "./NowPlaying";
import { useFocusPlayer } from "./useFocusPlayer";

// The player in the band, the music's home. From md up it floats at the band's
// right edge, on the band's content grid, over the wave and clear of the copy;
// on phones it sits in the flow under the copy. It stays mounted through the
// hand-off to the isle (hidden, not removed) so its box can be measured for the
// morph, and it is inert and invisible whenever it is not the one on show. Its
// view is the player's machine (lib/player/machine), written by the host.
export function BandPlayer() {
  const view = usePlayerView();
  const music = useSoundtrack();
  const reduce = useReducedMotionLive();
  const mounted = bandPlayerMounted(view);
  const shown = bandPlayerShown(view);
  useFocusPlayer(view, music);

  // On a phone the card sits in the flow, so its arrival and removal move every trigger below the band's top; the triggers read their positions again.
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  if (!mounted) return null;
  const fade = reduce ? 200 : 160;
  return (
    <div className="pointer-events-none relative z-20 px-[6vw] pt-3 md:absolute md:inset-x-0 md:top-3.5 md:pt-0" data-player-band-slot>
      <div className="mx-auto flex max-w-[1240px] justify-end">
        <div
          data-player-band-card
          inert={!shown}
          className="pointer-events-auto w-full md:w-auto"
          style={{
            opacity: shown ? 1 : 0,
            visibility: shown ? "visible" : "hidden",
            transition: shown ? `opacity ${fade}ms ease` : `opacity ${fade}ms ease, visibility 0s linear ${fade}ms`,
          }}
        >
          <Glass className="w-full p-4 md:w-[360px]">
            <NowPlaying active={shown} reduce={reduce} />
          </Glass>
        </div>
      </div>
    </div>
  );
}
