"use client";

import { useEffect, useState } from "react";
import { getSoundtrackPlayer, type PlayerSnapshot } from "@/lib/audio";
import { siteContent } from "@/lib/content";
import { rowAction } from "@/lib/player/tracks";
import { pauseSoundtrack, startSoundtrack, useSoundtrack } from "@/lib/soundtrack";

// The lab player's one source for transport: the soundtrack store for the
// music state, the audio player for the track, playhead and volume. The
// playhead is polled only while a surface shows it and the music plays. Every
// write runs inside the click that asked for it, which is what lets audio
// start under the browser's autoplay policy.
export function usePlayerControls(active: boolean) {
  const music = useSoundtrack();
  const playing = music === "on";
  const player = getSoundtrackPlayer();
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.getSnapshot());
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const sync = () => setSnap(player.getSnapshot());
    sync();
    return player.subscribe(sync);
  }, [player]);

  useEffect(() => {
    if (!active) return;
    const sync = () => setPosition(player.getPosition());
    const first = requestAnimationFrame(sync);
    const id = playing ? setInterval(sync, 500) : undefined;
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, [active, playing, player, snap.trackIndex]);

  return {
    music,
    playing,
    snap,
    position,
    track: siteContent.soundtrack.tracks[snap.trackIndex],
    seek: (seconds: number) => {
      player.seek(seconds);
      setPosition(seconds);
    },
    // From the player's live index, so two quick presses never land on the same track.
    step: (direction: number) => {
      player.selectTrack(player.getSnapshot().trackIndex + direction, playing);
      setPosition(0);
    },
    toggle: () => (playing ? pauseSoundtrack() : startSoundtrack()),
    playRow: (index: number) => {
      const action = rowAction(index, player.getSnapshot().trackIndex, playing);
      if (action === "pause") return pauseSoundtrack();
      if (action === "switch") {
        player.selectTrack(index, false);
        setPosition(0);
      }
      startSoundtrack();
    },
    setVolume: (volume: number) => player.setVolume(volume),
  };
}

export type PlayerControls = ReturnType<typeof usePlayerControls>;
