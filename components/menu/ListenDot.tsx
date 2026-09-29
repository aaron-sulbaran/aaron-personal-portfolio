"use client";

import { useEffect } from "react";
import { siteContent } from "@/lib/content";
import {
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";

// The Listen control inside the Menu pill: a hollow ring while nothing plays
// (before, paused, off), a filled accent dot with a pulsing halo while the
// soundtrack plays. It mirrors lib/soundtrack, the same store the playback
// pill and the waveform read, so the three can never disagree.
//
// The pill is layout-mounted, so on a case page (where neither ListenInvite
// nor PlaybackPill mounts) this is the only reader: it seeds the stored
// choice itself, and a returning visitor who opted in sees the paused ring,
// one tap from playing. Seeding is idempotent, so the home page's own calls
// stay no-ops.
export function ListenDot({ hidden }: { hidden: boolean }) {
  const music = useSoundtrack();
  const playing = music === "on";
  const { listenAriaLabelPlay, listenAriaLabelPause } = siteContent.menu;

  useEffect(() => {
    initSoundtrackFromStorage();
  }, []);

  // Runs inside the click, which is what lets audio start under the
  // browser's autoplay policy.
  const toggle = () => {
    if (playing) pauseSoundtrack();
    else startSoundtrack();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? listenAriaLabelPause : listenAriaLabelPlay}
      aria-pressed={playing}
      data-cursor-hover
      className={`relative h-10 w-[34px] items-center justify-center rounded-full focus-visible:rounded-full focus-visible:outline-offset-[-3px] ${
        hidden ? "hidden" : "flex"
      }`}
    >
      <span
        aria-hidden="true"
        className={`block h-2 w-2 rounded-full transition-[background-color,box-shadow] duration-300 ${
          playing ? "bg-accent" : "shadow-[inset_0_0_0_1.5px_var(--color-muted)]"
        }`}
      />
      {playing && (
        <span
          aria-hidden="true"
          className="listen-pulse pointer-events-none absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full bg-accent"
        />
      )}
    </button>
  );
}
