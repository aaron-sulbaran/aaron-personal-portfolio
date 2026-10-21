"use client";

import { useEffect, useState } from "react";
import { getSoundtrackPlayer, type PlayerSnapshot } from "@/lib/audio";
import { siteContent } from "@/lib/content";
import { PLAYHEAD_POLL_MS } from "@/lib/player/constants";
import { rowAction } from "@/lib/player/tracks";
import { cycleRepeatMode, skipNext, skipPrevious, toggleShuffle, useQueue } from "@/lib/player/queueStore";
import { pauseSoundtrack, startSoundtrack, useSoundtrack } from "@/lib/soundtrack";

// The player's one source for transport: the soundtrack store for the
// music state, the audio player for the track, playhead and volume, and the
// queue store for shuffle, repeat, next and previous. The playhead is polled
// only while a surface shows it and the music plays. Every write runs inside
// the click that asked for it, which is what lets audio start under the
// browser's autoplay policy.
export function usePlayerControls(active: boolean) {
  const music = useSoundtrack();
  const queue = useQueue();
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
    const id = playing ? setInterval(sync, PLAYHEAD_POLL_MS) : undefined;
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
    queue,
    track: siteContent.soundtrack.tracks[snap.trackIndex],
    seek: (seconds: number) => {
      player.seek(seconds);
      setPosition(seconds);
    },
    // Through the queue, so shuffle and repeat decide where it goes; the playhead restarts with the track.
    step: (direction: number) => {
      if (direction < 0) skipPrevious();
      else skipNext();
      setPosition(0);
    },
    toggleShuffle,
    cycleRepeat: cycleRepeatMode,
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
  };
}

export type PlayerControls = ReturnType<typeof usePlayerControls>;
