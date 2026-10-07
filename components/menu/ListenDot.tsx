"use client";

import { useEffect } from "react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import { noteState } from "@/lib/note";
import {
  initSoundtrackFromStorage,
  pauseSoundtrack,
  startSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";

// The Listen control inside the Menu pill: the bolt eighth, slashed in muted
// ink while nothing plays (before, paused, off) and plain in the accent while
// the soundtrack plays; the slash drawing in or out is the transition
// (NoteIcon). It mirrors lib/soundtrack, the same store the playback pill and the waveform
// read, so the three can never disagree.
//
// The pill is layout-mounted, so on a case page (where neither ListenInvite
// nor PlaybackPill mounts) this is the only reader: it seeds the stored
// choice itself, and a returning visitor who opted in sees the crossed note,
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

  // The button keeps the pill's visual size (34 by 40); the before element
  // widens the hit area to 44 by 44. It spills past the pill, which only
  // clips its content while the menu is engaged, when this button is hidden.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? listenAriaLabelPause : listenAriaLabelPlay}
      aria-pressed={playing}
      data-cursor-hover
      className={`relative h-10 w-[34px] items-center justify-center rounded-full before:absolute before:-bottom-0.5 before:-left-2 before:-right-0.5 before:-top-0.5 before:content-[''] focus-visible:rounded-full focus-visible:outline-offset-[-3px] ${
        hidden ? "hidden" : "flex"
      }`}
    >
      <NoteIcon state={noteState(music)} className="block h-4 w-[14px]" />
    </button>
  );
}
